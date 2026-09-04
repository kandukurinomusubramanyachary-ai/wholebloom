/**
 * Bloom Strength — session orchestrator.
 *
 * Wires the deterministic building blocks into one set's lifecycle:
 *   calibration -> countdown -> active set -> summary
 * with automatic pause/re-entry, multi-person pausing, sparse cues, slow-
 * inference fallback signaling, and a factual kind summary.
 *
 * Determinism: feed frames + timestamps and get reproducible results — no
 * React, no networking, no LLM. The web/native screen supplies frames from
 * MediaPipe and the clock; tests supply synthetic frames.
 *
 * Privacy: only person-0 (the primary person) is ever geometrically
 * evaluated. A second person pauses calibration and re-entry and never feeds
 * the rep machine. Nothing here persists media; persistence is the strict
 * 14-field summary (see services/strengthPrivacy.js).
 */

import { getExercise } from './exercises.js';
import { LandmarkSmoother } from './smoothing.js';
import { RepStateMachine } from './repMachine.js';
import { PositioningCoach } from './positioningCoach.js';
import { CueScheduler, CUE_PRIORITY } from './cueScheduler.js';
import { countPeople } from './confidence.js';
import { PRIVACY_VERSION } from '../services/strengthPrivacy.js';
import { SUMMARY_COPY } from '../strengthCopy.js';

export const PHASES = Object.freeze({
  IDLE: 'idle',
  CALIBRATION: 'calibration',
  COUNTDOWN: 'countdown',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
});

export const PLATFORMS = Object.freeze(['web', 'native']);

export const SLOW_INFERENCE_FPS = 8;
export const SLOW_INFERENCE_DWELL_MS = 5000;

function defaultIdFactory(exerciseId, now) {
  return `ss_${exerciseId}_${now()}`;
}

export class StrengthSession {
  /**
   * @param {object} args
   * @param {string} args.exerciseId
   * @param {string} args.mode - 'camera' | 'camera-free'
   * @param {'web'|'native'} args.platform - explicitly supplied (integration-safe)
   * @param {function} args.now - injected clock (ms)
   * @param {function} [args.createId] - id factory (exerciseId, now) => id;
   *        defaults to a deterministic `ss_<exercise>_<t>` (suitable for idempotent persistence)
   * @param {boolean} [args.mirrored=true]
   * @param {string} [args.id] - optional explicit session id (overrides factory)
   */
  constructor({
    exerciseId,
    mode,
    platform,
    now,
    mirrored = true,
    id = null,
    createId = null,
  }) {
    if (!PLATFORMS.includes(platform)) {
      throw new Error(`StrengthSession requires platform of ${PLATFORMS.join('/')}, got ${platform}`);
    }
    this.exercise = getExercise(exerciseId);
    this.exerciseId = exerciseId;
    this.mode = mode === 'camera-free' ? 'camera-free' : 'camera';
    this.platform = platform;
    this.now = now;
    this.mirrored = mirrored;
    this._createId = createId || defaultIdFactory;

    this.id = id || this._createId(exerciseId, now);
    this.phase = PHASES.IDLE;
    this.targetReps = this.exercise.targetReps;
    this.acceptedReps = 0;
    this.pauseCount = 0;
    this.cueCounts = {};
    this.completionState = null;

    this.startedAt = null;
    this.completedAt = null;
    this.activeDurationMs = 0;
    this._activeSince = null;

    this._smoother = new LandmarkSmoother();
    this._coach = new PositioningCoach({ exercise: this.exercise, now, mirrored });
    this._machine = new RepStateMachine(this.exercise, now);
    this._scheduler = new CueScheduler({ now });
    this._baseline = null;

    this._lastFrameAt = null;
    this._inferenceTimes = []; // recent frame timestamps for FPS
    this._slowSince = null;
    this._slowInferenceSignaled = false;
    this._multiPeoplePause = false;

    // Emitted events log (also returned per-frame for the UI).
    this.events = [];
  }

  /** Begin calibration (after camera permission granted). */
  start() {
    this.phase = PHASES.CALIBRATION;
    this.startedAt = this.now();
    this._emit({ type: 'phase', phase: this.phase });
    return this.phase;
  }

  /** Move from calibration to countdown once positioning is ready. */
  beginCountdown() {
    if (this.phase !== PHASES.CALIBRATION) return null;
    // Hard gate (camera mode only): never advance unless the coach completed
    // the stable single-person hold. A second person (or an unfinished hold)
    // keeps the session in calibration regardless of caller transitions.
    // Camera-free mode has no camera calibration, so it skips the hold.
    if (this.mode !== 'camera-free' && !this._coach.ready) return null;
    this.phase = PHASES.COUNTDOWN;
    this._activeSince = null;
    this._emit({ type: 'phase', phase: this.phase });
    return this.phase;
  }

  /** Called by the UI when the 3-2-1 finishes. Calibration cues are guidance
   *  only — the active set's cue counts start fresh here. */
  beginActive() {
    if (this.phase !== PHASES.COUNTDOWN) return null;
    this.phase = PHASES.ACTIVE;
    this._activeSince = this.now();
    this._lastFrameAt = null;
    this._scheduler.reset();
    this.cueCounts = {};
    this._emit({ type: 'phase', phase: this.phase });
    return this.phase;
  }

  userPause() {
    if (this.phase !== PHASES.ACTIVE) return;
    this._enterPause('user');
  }

  /**
   * User taps Resume. The set STAYS paused until the positioning coach
   * confirms stable re-entry (resumeReady); re-entry hold time is never
   * counted as active movement and the rep state stays frozen throughout.
   */
  userResume() {
    if (this.phase !== PHASES.PAUSED) return;
    this._coach.beginResume();
    // phase remains PAUSED; feedPoses() flips it to ACTIVE only on resumeReady.
    this._emit({ type: 'resume-requested' });
  }

  /** User stops early. */
  stop() {
    if (this.phase === PHASES.ENDED) return this.buildSummary();
    this._closeActiveDuration();
    this.phase = PHASES.ENDED;
    this.completedAt = this.now();
    const completed = this.acceptedReps >= this.targetReps;
    this.completionState = completed ? 'completed' : 'stopped';
    this._scheduler.silence();
    this._emit({ type: 'stopped', state: this.completionState });
    return this.buildSummary();
  }

  /** User navigates away / logs out / fatal error before any result. */
  abandon() {
    this._closeActiveDuration();
    this.phase = PHASES.ENDED;
    this.completedAt = this.now();
    this.completionState = 'abandoned';
    this._scheduler.silence();
    return this.buildSummary();
  }

  /** Page hidden / tab backgrounded: pause and cancel speech (PRD §16). */
  onHidden() {
    if (this.phase === PHASES.ACTIVE) {
      this._enterPause('hidden');
    }
    this._scheduler.silence();
  }

  _enterPause(reason) {
    this._closeActiveDuration();
    this.phase = PHASES.PAUSED;
    this.pauseCount += 1;
    this._coach.markPaused();
    const cancel = this._scheduler.silence();
    this._emit({ type: 'paused', reason, cancel });
  }

  /** Offer cues to the scheduler and sync the session's cueCounts from it. */
  _offer(frame) {
    const { speak, cancel } = this._scheduler.offer(frame);
    this.cueCounts = { ...this._scheduler.cueCounts };
    return { speak, cancel };
  }

  /**
   * Feed one pose-detector result.
   * @param {Array<{landmarks: Array<object>}>} poses - up to two poses; only
   *        poses[0] (the primary person) is ever geometrically evaluated.
   * @returns {object} frame result for the UI (state, cues, rep count)
   */
  feedPoses(poses) {
    const t = this.now();
    const people = countPeople(poses);

    // Effective inference rate is driven by the detector loop calling
    // feedPoses each inference (target 10–15/s; gate at <8/s for 5s).
    this._inferenceTimes.push(t);
    if (this._inferenceTimes.length > 60) this._inferenceTimes.shift();

    const emittedCues = [];

    // PRIORITY 1 — multiple people. Only person-0 is ever processed; when a
    // second person is present:
    //   - calibration must NOT advance,
    //   - an active set pauses,
    //   - a paused/re-entry set must NOT resume.
    if (people >= 2) {
      this._coach.blockForExtraPerson();
      if (this.phase === PHASES.ACTIVE) {
        if (!this._multiPeoplePause) {
          this._multiPeoplePause = true;
          this._enterPause('multiple-people');
        }
      }
      // The system cue is throttled by the scheduler (announce once, then
      // re-announce only after the repeat window) rather than every frame.
      const { speak } = this._offer({
        candidates: [{ id: 'multiple-people', priority: CUE_PRIORITY.system }],
      });
      if (speak) emittedCues.push(speak);
      return this._result(t, {
        cues: emittedCues,
        tracking: false,
        paused: true,
        multiplePeople: true,
      });
    }

    if (this.phase === PHASES.CALIBRATION) {
      const primary = poses && poses[0] ? poses[0].landmarks : null;
      const { landmarks } = this._smoother.smooth(primary, this._torsoHeight(primary));
      const cal = this._coach.updateCalibration(landmarks);
      if (cal.ready) {
        this._baseline = cal.baseline;
        this._emit({ type: 'calibration-ready' });
      } else if (cal.instruction) {
        // Calibration guidance passes through the scheduler (gap/cooldown)
        // instead of being pushed every detector frame.
        const { speak } = this._offer({
          candidates: [{ id: cal.instruction, priority: CUE_PRIORITY.tracking }],
        });
        if (speak) emittedCues.push(speak);
      }
      return this._result(t, {
        cues: emittedCues,
        calibrationReady: cal.ready,
        instruction: cal.instruction,
      });
    }

    if (this.phase === PHASES.PAUSED) {
      const primary = poses && poses[0] ? poses[0].landmarks : null;
      const { landmarks } = this._smoother.smooth(primary, this._torsoHeight(primary));
      const track = this._coach.updateTracking(landmarks);
      if (track.resumeReady) {
        // Resume ONLY on a stable single person. Active time resumes here;
        // the re-entry hold was paused and not counted.
        this.phase = PHASES.ACTIVE;
        this._activeSince = this.now();
        this._multiPeoplePause = false;
        this._lastFrameAt = null; // first post-resume frame: dt is 0
        this._emit({ type: 'resumed' });
      }
      // Re-entry tracking cues go through the scheduler too.
      if (track.cue) {
        const { speak } = this._offer({
          candidates: [{ id: track.cue, priority: CUE_PRIORITY.tracking }],
        });
        if (speak) emittedCues.push(speak);
      }
      return this._result(t, {
        cues: emittedCues,
        tracking: track.tracking,
        paused: true,
      });
    }

    if (this.phase !== PHASES.ACTIVE) {
      return this._result(t, { cues: [], tracking: false });
    }

    // ACTIVE phase
    if (this._activeSince === null) this._activeSince = t;
    const primary = poses && poses[0] ? poses[0].landmarks : null;
    const smooth = this._smoother.smooth(primary, this._torsoHeight(primary));
    const landmarks = smooth.landmarks;
    const track = this._coach.updateTracking(landmarks);

    if (!track.tracking) {
      // Lost view / relocation / insufficient confidence: positioning help or
      // auto-pause. NEVER a form correction. The rep machine is not called,
      // so state/count freeze.
      if (track.autoPause) {
        this._enterPause('auto');
      }
      const candidates = [];
      if (track.cue) candidates.push({ id: track.cue, priority: CUE_PRIORITY.tracking });
      const { speak } = this._offer({ candidates });
      if (speak) emittedCues.push(speak);
      return this._result(t, { cues: emittedCues, tracking: false, paused: track.paused });
    }

    // Confident frame: measure + advance the deterministic machine.
    const dtMs = this._lastFrameAt ? t - this._lastFrameAt : 0;
    this._lastFrameAt = t;
    const metrics = this.exercise.measure(landmarks);
    const machineResult = this._machine.update(metrics, dtMs);

    const candidates = [];

    // Form cues (priority 3) — one persistent reviewed condition at a time.
    const formCueDefs = this.exercise.formCues(
      machineResult.metrics,
      { state: machineResult.state, cycleReversals: machineResult.cycleReversals },
      this._baseline,
    );
    for (const fc of formCueDefs) {
      if (fc.active) candidates.push({ id: fc.id, priority: CUE_PRIORITY.form });
    }

    let repCompleted = false;
    if (machineResult.repCompleted) {
      this.acceptedReps = machineResult.acceptedReps;
      repCompleted = true;
    }
    if (machineResult.partial) {
      this._emit({ type: 'partial-rep' });
    }

    const offerEncouragement =
      this.acceptedReps === Math.max(2, Math.floor(this.targetReps / 2));

    const { speak } = this._offer({
      candidates,
      repCompleted,
      repNumber: this.acceptedReps,
      offerEncouragement,
    });
    if (speak) emittedCues.push(speak);

    let setComplete = false;
    if (this.acceptedReps >= this.targetReps) {
      this._closeActiveDuration();
      this.phase = PHASES.ENDED;
      this.completedAt = this.now();
      this.completionState = 'completed';
      setComplete = true;
      this._emit({ type: 'set-complete' });
    }

    return this._result(t, {
      cues: emittedCues,
      tracking: true,
      repCompleted,
      setComplete,
      machineState: machineResult.state,
    });
  }

  /** Camera-free mode: manual +1. Same respectful summary. */
  manualRep() {
    if (this.mode !== 'camera-free') return { acceptedReps: this.acceptedReps };
    if (this.phase === PHASES.IDLE) this.start();
    if (this.phase === PHASES.CALIBRATION || this.phase === PHASES.COUNTDOWN) {
      this.beginCountdown();
      this.beginActive();
    }
    if (this.phase !== PHASES.ACTIVE) return { acceptedReps: this.acceptedReps };
    if (this._activeSince === null) this._activeSince = this.now();
    this.acceptedReps = Math.min(this.targetReps, this.acceptedReps + 1);
    const { speak } = this._offer({
      candidates: [],
      repCompleted: true,
      repNumber: this.acceptedReps,
      offerEncouragement: this.acceptedReps === Math.max(2, Math.floor(this.targetReps / 2)),
    });
    let setComplete = false;
    if (this.acceptedReps >= this.targetReps) {
      this._closeActiveDuration();
      this.phase = PHASES.ENDED;
      this.completedAt = this.now();
      this.completionState = 'completed';
      setComplete = true;
    }
    return {
      acceptedReps: this.acceptedReps,
      setComplete,
      cue: speak || null,
    };
  }

  /**
   * Slow-inference check, called by the detector loop. Returns true once when
   * effective rate drops below 8/s for 5s so the UI can offer camera-free.
   */
  checkSlowInference() {
    const t = this.now();
    const recent = this._inferenceTimes.filter((ts) => ts > t - 10000);
    if (recent.length >= 2) {
      const span = recent[recent.length - 1] - recent[0];
      const fps = span > 0 ? (recent.length - 1) / (span / 1000) : 99;
      if (fps < SLOW_INFERENCE_FPS) {
        if (this._slowSince === null) this._slowSince = t;
        if (t - this._slowSince >= SLOW_INFERENCE_DWELL_MS && !this._slowInferenceSignaled) {
          this._slowInferenceSignaled = true;
          return true;
        }
      } else {
        this._slowSince = null;
      }
    }
    return false;
  }

  /**
   * Build the full session result. Persistence must go through
   * strengthPrivacy.serializeSessionSummary (via StrengthOutbox.saveSession),
   * which strips the display-only block; the display block renders the
   * summary screen and never persists.
   */
  buildSummary() {
    if (this.completedAt === null) this.completedAt = this.now();
    const durationSeconds = Math.max(0, Math.round(this.activeDurationMs / 1000));
    const observation = this._observation(durationSeconds);
    const nextFocus = this._nextFocus();
    return {
      id: this.id,
      exerciseId: this.exerciseId,
      exerciseVersion: this.exercise.exerciseVersion,
      startedAt: this.startedAt ?? this.completedAt,
      completedAt: this.completedAt,
      durationSeconds,
      targetReps: this.targetReps,
      acceptedReps: this.acceptedReps,
      pauseCount: this.pauseCount,
      cueCounts: this.cueCounts,
      completionState: this.completionState ?? 'abandoned',
      platform: this.platform,
      mode: this.mode,
      privacyVersion: PRIVACY_VERSION,
      // Display-only. Explicitly handled (stripped) at the privacy boundary;
      // it never enters the outbox / Firestore / analytics.
      display: {
        observation,
        nextFocus,
        title:
          this.completionState === 'completed'
            ? SUMMARY_COPY.completedTitle
            : this.completionState === 'stopped'
              ? SUMMARY_COPY.stoppedTitle
              : '',
      },
    };
  }

  _observation() {
    if (this.acceptedReps === 0 && this.mode === 'camera') {
      return SUMMARY_COPY.observationNone;
    }
    const parts = [SUMMARY_COPY.observationCount(this.acceptedReps)];
    if (this.pauseCount > 0 && this.mode === 'camera') {
      parts.push(SUMMARY_COPY.observationPauses(this.pauseCount));
    }
    const controlCues =
      (this.cueCounts['form-squat-control'] ?? 0) +
      (this.cueCounts['form-pushup-body-line'] ?? 0);
    if (this.acceptedReps >= this.targetReps && controlCues === 0 && this.pauseCount <= 1) {
      parts.push(SUMMARY_COPY.observationSteady);
    }
    return parts.join(' ');
  }

  _nextFocus() {
    if (this.acceptedReps === 0) return null;
    const formEntries = Object.entries(this.cueCounts)
      .filter(([k]) => k.startsWith('form-'))
      .sort((a, b) => b[1] - a[1]);
    if (formEntries.length === 0) return null;
    const [topCue] = formEntries[0];
    return SUMMARY_COPY[`next-focus-${topCue}`] ?? SUMMARY_COPY.nextFocusGeneric;
  }

  _torsoHeight(landmarks) {
    if (!landmarks) return 0.25;
    const m = this.exercise.measure(landmarks);
    return m.torsoHeight ?? 0.25;
  }

  _closeActiveDuration() {
    if (this._activeSince !== null) {
      this.activeDurationMs += this.now() - this._activeSince;
      this._activeSince = null;
    }
  }

  _emit(event) {
    this.events.push({ at: this.now(), ...event });
  }

  _result(t, extra) {
    return {
      at: t,
      phase: this.phase,
      acceptedReps: this.acceptedReps,
      targetReps: this.targetReps,
      cues: extra.cues || [],
      tracking: extra.tracking ?? null,
      paused: extra.paused ?? false,
      multiplePeople: extra.multiplePeople ?? false,
      calibrationReady: extra.calibrationReady ?? false,
      instruction: extra.instruction ?? null,
      repCompleted: extra.repCompleted ?? false,
      setComplete: extra.setComplete ?? false,
      machineState: extra.machineState ?? this._machine.state,
      offerCameraFree: this._slowInferenceSignaled,
    };
  }
}
