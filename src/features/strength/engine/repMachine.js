/**
 * Bloom Strength — deterministic repetition state machine.
 *
 * PRD §10 rep engine rules implemented here:
 *  - Explicit states with minimum transition frames and minimum hold time.
 *  - Deadbands/hysteresis live in each exercise's classify() thresholds.
 *  - A rep counts ONLY after a complete cycle returns to the reset state.
 *  - Partial movements and jitter never count.
 *  - The machine does not move when fed no metrics (confidence gating feeds
 *    null) — callers must stop calling update() while tracking is lost.
 *  - Movement calculations are pure and independent of React/networking.
 */

export class RepStateMachine {
  /**
   * @param {object} exercise - exercise definition
   * @param {function} now - injected clock returning ms
   */
  constructor(exercise, now) {
    this.exercise = exercise;
    this.now = now;
    const cfg = exercise.machine;
    this.cfg = cfg;
    this.state = cfg.resetState;
    this.candidate = cfg.resetState;
    this._candidateSince = null;
    this._cycleStartTime = null;
    this._peakEnteredAt = null;
    this._lastMetrics = null;
    this._lastMetricsAt = null;
    this._cycleReversals = 0;
    this._lastDirection = null;
    this._movementStartedAt = null;
    this.acceptedReps = 0;
    this.partialAttempts = 0;
    this._visited = new Set([cfg.resetState]);
  }

  reset() {
    this.state = this.cfg.resetState;
    this.candidate = this.cfg.resetState;
    this._candidateSince = null;
    this._cycleStartTime = null;
    this._peakEnteredAt = null;
    this._movementStartedAt = null;
    this._lastMetrics = null;
    this._lastMetricsAt = null;
    this._cycleReversals = 0;
    this._lastDirection = null;
    this.acceptedReps = 0;
    this.partialAttempts = 0;
    this._visited = new Set([this.cfg.resetState]);
  }

  /**
   * Advance one frame.
   * @param {object} metrics - output of exercise.measure(landmarks)
   * @param {number} dtMs - elapsed time since the previous fed frame
   * @returns {{
   *   state: string, acceptedReps: number, repCompleted: boolean,
   *   partial: boolean, metrics: object, cycleReversals: number,
   *   reachedPeak: boolean
   * }}
   */
  update(metrics, dtMs) {
    const t = this.now();
    // Attach deterministic angle rates (deg/s) for velocity-sensitive cues.
    if (metrics) {
      metrics.rates = this._rates(metrics, dtMs, t);
    }

    if (!metrics || metrics[this.cfg.angleField] === null) {
      // Not enough signal this frame: freeze everything. No state change,
      // no counter change. Caller gates this via confidence, but the machine
      // is defensive too.
      return this._snapshot({ repCompleted: false, partial: false, reachedPeak: false });
    }

    const desired = this.exercise.classify(metrics, this.state);
    let reachedPeak = false;

    if (desired === this.candidate) {
      this._candidateSince = this._candidateSince ?? t;
    } else {
      this._candidateSince = t;
      this.candidate = desired;
    }

    // Minimum transition frames + minimum hold time for the peak state.
    const holdMs =
      desired === this.cfg.peakState ? this.cfg.minPeakHoldMs : 0;
    const candidateFor = t - (this._candidateSince ?? t);
    const framesGate = this._minFramesGate(desired);

    let enteredReset = false;
    // Capture cycle context BEFORE the transition clears the visited set.
    const willTransition = desired !== this.state && candidateFor >= holdMs && framesGate;
    const cycleBefore = {
      visited: new Set(this._visited),
      start: this._cycleStartTime,
      peakAt: this._peakEnteredAt,
    };
    // Anchor a new cycle from the moment the driving angle first leaves the
    // reset band (even if the angle passes through a mid-state too quickly to
    // register a transition). resetThreshold is the edge of the reset band
    // for the driving angle (below = moving, since all three exercises flex).
    if (this._cycleStartTime === null) {
      const angle = metrics[this.cfg.angleField];
      const threshold = this.cfg.resetThreshold ?? 165;
      if (typeof angle === 'number' && angle < threshold) {
        this._cycleStartTime = this._movementStartedAt ?? t;
      } else if (typeof angle === 'number' && angle >= threshold) {
        this._movementStartedAt = t;
      }
    }

    if (willTransition) {
      if (desired === this.cfg.resetState) enteredReset = true;
      this._transition(desired, t);
      if (desired === this.cfg.peakState) {
        this._peakEnteredAt = t;
        if (this._cycleStartTime === null) this._cycleStartTime = t;
        reachedPeak = true;
      }
    }

    // Track jitter/tremor: direction reversals of the driving angle within
    // one cycle (used by the "maintain control" cue).
    const rate = metrics.rates?.[this.cfg.angleField] ?? 0;
    const direction =
      Math.abs(rate) < this.cfg.holdVelocityDegPerSec
        ? 'hold'
        : rate < 0
          ? 'neg'
          : 'pos';
    if (
      direction !== 'hold' &&
      this._lastDirection !== null &&
      direction !== this._lastDirection &&
      this.state !== this.cfg.resetState
    ) {
      this._cycleReversals += 1;
    }
    if (direction !== 'hold') this._lastDirection = direction;

    let repCompleted = false;
    let partial = false;

    // Rep completes only when a full cycle returns to reset. Use the cycle
    // context captured before the transition cleared the visited set.
    const cycleReachedPeak =
      enteredReset &&
      (cycleBefore.visited.has(this.cfg.peakState) || cycleBefore.peakAt !== null);
    const cycleBeganOut = enteredReset && cycleBefore.visited.size > 1;

    if (this.state === this.cfg.resetState && cycleReachedPeak) {
      const cycleMs = cycleBefore.start ? t - cycleBefore.start : Infinity;
      if (cycleMs >= this.cfg.minCycleMs) {
        this.acceptedReps += 1;
        repCompleted = true;
      } else {
        // Completed the geometry too fast to be a deliberate rep — treat as
        // jitter/partial, never count it.
        partial = true;
        this.partialAttempts += 1;
      }
      this._beginCycle(t);
    } else if (this.state === this.cfg.resetState && cycleBeganOut) {
      // Returned to reset WITHOUT reaching the peak: a partial movement.
      partial = true;
      this.partialAttempts += 1;
      this._beginCycle(t);
    } else if (this.state === this.cfg.resetState) {
      // Still standing/extended/neutral at the start.
      if (this._cycleStartTime === null) this._beginCycle(t);
    }

    this._lastMetrics = metrics;
    this._lastMetricsAt = t;
    return this._snapshot({ repCompleted, partial, reachedPeak });
  }

  _transition(newState, t) {
    const prev = this.state;
    this.state = newState;
    if (newState === this.cfg.resetState) {
      this._visited = new Set([this.cfg.resetState]);
    } else {
      this._visited.add(newState);
    }
    if (this._cycleStartTime === null && newState !== this.cfg.resetState) {
      this._cycleStartTime = t;
    }
    // Reversal counter resets when a fresh movement out of reset begins.
    if (prev === this.cfg.resetState && newState !== this.cfg.resetState) {
      this._cycleReversals = 0;
      this._lastDirection = null;
    }
  }

  _beginCycle(t) {
    this._visited = new Set([this.cfg.resetState]);
    this._cycleStartTime = null;
    this._movementStartedAt = t;
    this._cycleReversals = 0;
    this._lastDirection = null;
    this._peakEnteredAt = null;
  }

  _minFramesGate(desired) {
    // Frame-rate independent gate: the candidate must have persisted for at
    // least minFramesPerState frames worth of wall time (assumes 12 fps
    // default inference rate — deterministic against injected clock).
    const gateMs = (this.cfg.minFramesPerState / 12) * 1000;
    return this.now() - (this._candidateSince ?? this.now()) >= gateMs;
  }

  _rates(metrics, dtMs, t) {
    const rates = {};
    if (this._lastMetrics && this._lastMetricsAt && dtMs > 0) {
      for (const field of ['kneeAngle', 'elbowAngle', 'workingHipAngle']) {
        const cur = metrics[field];
        const prev = this._lastMetrics[field];
        if (typeof cur === 'number' && typeof prev === 'number') {
          rates[field] = ((cur - prev) / dtMs) * 1000;
        }
      }
    }
    return rates;
  }

  _snapshot({ repCompleted, partial, reachedPeak }) {
    return {
      state: this.state,
      acceptedReps: this.acceptedReps,
      repCompleted,
      partial,
      reachedPeak,
      metrics: this._lastMetrics,
      cycleReversals: this._cycleReversals,
      partialAttempts: this.partialAttempts,
    };
  }
}
