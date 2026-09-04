/**
 * Bloom Strength — positioning coach.
 *
 * Guides the user into the required camera angle ONE INSTRUCTION AT A TIME,
 * holds a stable valid pose for two seconds before advancing, and — during an
 * active set — turns loss of view into plain positioning help or a pause
 * rather than a form judgment (PRD §7.1, §10, §16).
 */

import { evaluateVisibility, evaluateFraming, inferView } from './confidence.js';

const HOLD_READY_MS = 2000; // PRD: stable valid pose held for two seconds
const PAUSE_DWELL_MS = 4000; // low-confidence dwell before automatic pause
const REENTRY_HOLD_MS = 1500; // stable re-entry before resuming

/** View mismatch instruction ids, per required view. */
const VIEW_INSTRUCTION = Object.freeze({
  side: 'turn-side',
  front: 'turn-front',
});

export class PositioningCoach {
  /**
   * @param {object} args
   * @param {object} args.exercise - exercise definition
   * @param {function} args.now - injected clock, returns ms
   * @param {boolean} [args.mirrored=true]
   */
  constructor({ exercise, now, mirrored = true }) {
    this.exercise = exercise;
    this.now = now;
    this.mirrored = mirrored;
    this.ready = false;
    this._readySince = null;
    this.paused = false;
    this._badSince = null;
    this._reentrySince = null;
    this._lastInstruction = null;
    this._holdPrompted = false;
    this.lastBaseline = null;
    /** Camera view direction locked in at calibration; a set never re-asks
     *  for the angle mid-movement (the silhouette compresses with flexion). */
    this.lockedView = null;
  }

  reset() {
    this.ready = false;
    this._readySince = null;
    this.paused = false;
    this._badSince = null;
    this._reentrySince = null;
    this._lastInstruction = null;
    this._holdPrompted = false;
    this.lastBaseline = null;
    this.lockedView = null;
  }

  /**
   * Calibration-phase update. Returns one instruction id (or null when the
   * frame is already good). Advances to ready after HOLD_READY_MS stable.
   *
   * @param {Array<object>|null} landmarks - smoothed landmarks for person 1
   * @returns {{ instruction: string|null, ready: boolean, baseline: object|null }}
   */
  updateCalibration(landmarks) {
    const t = this.now();
    const instruction = this._firstProblem(landmarks, { calibration: true });

    if (instruction) {
      this._readySince = null;
      this.ready = false;
      this._holdPrompted = false;
      // Only surface a *new* instruction; the UI keeps showing the current
      // one so the user is not flooded with changing text.
      const emit = instruction !== this._lastInstruction;
      this._lastInstruction = instruction;
      return { instruction: emit ? instruction : null, ready: false, baseline: null };
    }
    this._holdPrompted = true;

    this._lastInstruction = null;
    if (this._readySince === null) {
      this._readySince = t;
      this._holdPrompted = false;
    }
    if (t - this._readySince >= HOLD_READY_MS) {
      if (!this.ready) {
        this.ready = true;
        this.lockedView = inferView(landmarks);
        this.lastBaseline = this._captureBaseline(landmarks);
      }
      return { instruction: null, ready: true, baseline: this.lastBaseline };
    }
    // Stable but hold not yet complete. 'hold-steady' is a progress prompt,
    // not a problem — emit once at the start, then stay quiet until ready.
    const holdInstruction = this._holdPrompted ? null : 'hold-steady';
    this._holdPrompted = true;
    return { instruction: holdInstruction, ready: false, baseline: null };
  }

  /**
   * Active-set tracking check. Framing/visibility problems become tracking
   * cues first, then an automatic pause after the dwell.
   *
   * @param {Array<object>|null} landmarks
   * @returns {{ tracking: boolean, cue: string|null, paused: boolean, autoPause: boolean, resumeReady: boolean }}
   */
  updateTracking(landmarks) {
    const t = this.now();
    if (this.paused) {
      // Re-entry: require stable confident framing before resuming.
      const problem = this._firstProblem(landmarks, { calibration: false });
      if (problem) {
        this._reentrySince = null;
        return { tracking: false, cue: problem, paused: true, autoPause: false, resumeReady: false };
      }
      if (this._reentrySince === null) this._reentrySince = t;
      if (t - this._reentrySince >= REENTRY_HOLD_MS) {
        this.paused = false;
        this._badSince = null;
        this._reentrySince = null;
        return { tracking: true, cue: 'resume', paused: false, autoPause: false, resumeReady: true };
      }
      return { tracking: false, cue: null, paused: true, autoPause: false, resumeReady: false };
    }

    const problem = this._firstProblem(landmarks, { calibration: false });
    if (problem) {
      if (this._badSince === null) this._badSince = t;
      const dwell = t - this._badSince;
      const cue = problem; // tracking/framing cue (never a form cue)
      if (dwell >= PAUSE_DWELL_MS) {
        this.paused = true;
        this._reentrySince = null;
        return { tracking: false, cue: 'auto-pause', paused: true, autoPause: true, resumeReady: false };
      }
      return { tracking: false, cue, paused: false, autoPause: false, resumeReady: false };
    }

    this._badSince = null;
    return { tracking: true, cue: null, paused: false, autoPause: false, resumeReady: false };
  }

  /** Manually resume after an explicit user pause. */
  beginResume() {
    this.paused = true;
    this._reentrySince = null;
  }

  /** Enter the paused/re-entry state (auto-pause, hidden, multi-person). */
  markPaused() {
    this.paused = true;
    this._reentrySince = null;
    this._badSince = null;
  }

  /**
   * A second person is in frame. Calibration must never advance and the
   * stable-hold timer must reset until ONLY the primary person is present:
   * a valid 2s hold is required from scratch once the extra person leaves.
   */
  blockForExtraPerson() {
    this._readySince = null;
    this.ready = false;
    this._holdPrompted = false;
    this._lastInstruction = null;
    this._reentrySince = null;
    this._badSince = null;
    // Do NOT set paused here: mid-set re-entry and calibration are gated by
    // the session on people >= 2. Resetting the hold timer is enough.
  }

  /**
   * Ordered problem detection — first hit wins (one instruction at a time).
   * Priority: view angle > framing > landmark visibility.
   */
  _firstProblem(landmarks, { calibration }) {
    const framing = evaluateFraming(landmarks, { mirrored: this.mirrored });
    if (framing.reason === 'no-person') return 'find-person';
    if (framing.instruction) return framing.instruction;

    const required = this.exercise.cameraView;
    if (calibration) {
      const view = inferView(landmarks);
      if (view && view !== required) return VIEW_INSTRUCTION[required];
      // An oblique/unreadable view blocks calibration only.
      if (view === null) return VIEW_INSTRUCTION[required];
    }
    // Mid-set: the view was accepted at calibration and the user does not
    // move the phone mid-rep; flexion compresses the silhouette and must not
    // re-trigger a turn cue (lockedView holds the accepted direction).

    const visibility = evaluateVisibility(landmarks, this.exercise.requiredGroups);
    if (!visibility.ok) {
      // Map missing groups to the exercise's restore-visibility cue.
      return `restore-${this.exercise.visibilityCueLabel}`;
    }
    return null;
  }

  _captureBaseline(landmarks) {
    const metrics = this.exercise.measure(landmarks);
    return {
      shoulderHipDrift: metrics.shoulderHipDrift ?? null,
      kneeAngle: metrics.kneeAngle ?? null,
      elbowAngle: metrics.elbowAngle ?? null,
      workingHipAngle: metrics.workingHipAngle ?? null,
      capturedAt: this.now(),
    };
  }
}
