/**
 * Bloom Strength — landmark smoothing, one-frame jump rejection and
 * sustained-relocation reseeding.
 *
 * Deterministic, frame-sequential EMA filter. The smoother holds the last
 * accepted pose per tracked person and:
 *   1. Rejects implausible SINGLE-FRAME jumps (occlusion flicker / MediaPipe
 *      identity swaps) so geometry cannot fire a state transition on noise.
 *   2. Detects SUSTAINED relocation (the same landmark "jumps" for several
 *      consecutive frames — the person genuinely moved, or the tracker locked
 *      a new identity). Rather than hold a stale high-visibility ghost forever
 *      (which would keep coaching a position the user left), it RESEEDS to the
 *      new location and forces that landmark's confidence to zero for a short
 *      confirmation window. Visibility gating then freezes rep evaluation
 *      until the new pose is stable and confidence is restored.
 */

import { clamp } from './geometry.js';

const DEFAULT_OPTIONS = Object.freeze({
  /** EMA factor for position when a landmark is continuously visible. */
  alpha: 0.45,
  /** Max per-frame displacement (fraction of torso height) before a landmark
   *  is treated as an identity-swap jump and held rather than followed. */
  maxJumpTorsoFraction: 1.5,
  /** Landmarks below this visibility are held from the last good value. */
  visibilityThreshold: 0.5,
  /** Consecutive jump frames at/above which a relocation is accepted as real
   *  and the landmark is reseeded (instead of held indefinitely). */
  sustainedJumpFrames: 3,
  /** After a reseed, frames the landmark is held below confidence so rep
   *  evaluation stays frozen until the new pose confirms. */
  reseedConfirmFrames: 2,
  /** Visibility reported for a reseeding landmark during the confirm window. */
  reseedVisibility: 0,
});

export class LandmarkSmoother {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    /** @type {Array<{x:number,y:number,z:number,visibility:number}>|null} */
    this.previous = null;
    this.framesSincePerson = 0;
    /** Per-landmark consecutive-jump streak. */
    this._jumpStreak = [];
    /** Per-landmark remaining low-confidence frames after a reseed. */
    this._reseedHold = [];
  }

  reset() {
    this.previous = null;
    this.framesSincePerson = 0;
    this._jumpStreak = [];
    this._reseedHold = [];
  }

  /**
   * Smooth one frame's landmarks for a single person.
   * @param {Array<{x:number,y:number,z?:number,visibility?:number}>|null} raw
   * @param {number} [torsoHeight] Shoulder-to-hip distance (normalized units).
   * @returns {{
   *   landmarks: Array<object>|null,
   *   jumped: boolean[],
   *   invalidated: boolean[],
   *   reseeded: boolean[],
   *   personVisible: boolean
   * }}
   */
  smooth(raw, torsoHeight = 0.25) {
    if (!raw || raw.length === 0) {
      this.framesSincePerson += 1;
      // No person: drop streak state so a reappearing pose is judged fresh.
      this._jumpStreak = [];
      this._reseedHold = [];
      return { landmarks: null, jumped: [], invalidated: [], reseeded: [], personVisible: false };
    }
    this.framesSincePerson = 0;
    const threshold = this.options.visibilityThreshold;
    const maxJump = Math.max(0.05, torsoHeight * this.options.maxJumpTorsoFraction);
    const n = raw.length;
    if (this._jumpStreak.length !== n) {
      this._jumpStreak = new Array(n).fill(0);
      this._reseedHold = new Array(n).fill(0);
    }

    if (!this.previous) {
      // First accepted frame: trust it verbatim (seed).
      this.previous = raw.map((lm) => this._normalize(lm));
      return {
        landmarks: this.previous,
        jumped: new Array(n).fill(false),
        invalidated: new Array(n).fill(false),
        reseeded: new Array(n).fill(false),
        personVisible: true,
      };
    }

    const jumped = new Array(n).fill(false);
    const invalidated = new Array(n).fill(false);
    const reseeded = new Array(n).fill(false);

    const out = raw.map((lm, i) => {
      const cur = this._normalize(lm);
      const prev = this.previous[i] || cur;
      const visible = (cur.visibility ?? 0) >= threshold;

      if (!visible) {
        // Occluded/low confidence: hold last good value, but mark its
        // visibility down so confidence gating does not trust it. A jump
        // cannot be assessed through occlusion — reset the streak.
        this._jumpStreak[i] = 0;
        return { ...prev, visibility: Math.min(prev.visibility ?? 0, cur.visibility ?? 0) };
      }

      const disp = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const isJump = disp > maxJump;

      if (!isJump) {
        // Consistent movement (or stationary). Clear the jump streak.
        this._jumpStreak[i] = 0;
        const blended = this._blend(prev, cur);
        if (this._reseedHold[i] > 0) {
          // Freshly reseeded: position is allowed to settle but confidence is
          // held below threshold for the confirmation window so rep eval
          // stays frozen until the relocated pose proves stable.
          this._reseedHold[i] -= 1;
          reseeded[i] = true;
          return { ...blended, visibility: Math.min(blended.visibility, this.options.reseedVisibility + 0.15) };
        }
        return blended;
      }

      // A jump. A short streak is flicker/swap noise -> hold. A sustained
      // streak is genuine relocation -> reseed and invalidate confidence.
      this._jumpStreak[i] += 1;
      if (this._jumpStreak[i] < this.options.sustainedJumpFrames) {
        // Reject the one/few-frame jump: hold the previous (still confident
        // for this brief flicker window) position.
        jumped[i] = true;
        return prev;
      }

      // Sustained relocation. Reseed to the new location but report zero
      // confidence this frame and for the confirmation window, so the engine
      // does not coach a ghost and rep evaluation freezes until restored.
      jumped[i] = true;
      invalidated[i] = true;
      reseeded[i] = true;
      this._jumpStreak[i] = 0;
      this._reseedHold[i] = this.options.reseedConfirmFrames;
      this.previous[i] = { ...cur };
      return { ...cur, visibility: this.options.reseedVisibility };
    });

    this.previous = out;
    return { landmarks: out, jumped, invalidated, reseeded, personVisible: true };
  }

  _blend(prev, cur) {
    const a = this.options.alpha;
    return {
      x: prev.x + (cur.x - prev.x) * a,
      y: prev.y + (cur.y - prev.y) * a,
      z: (prev.z ?? 0) + ((cur.z ?? 0) - (prev.z ?? 0)) * a,
      visibility: prev.visibility + ((cur.visibility ?? 0) - (prev.visibility ?? 0)) * a,
    };
  }

  _normalize(lm) {
    return {
      x: lm.x,
      y: lm.y,
      z: lm.z ?? 0,
      visibility: clamp(lm.visibility ?? 0, 0, 1),
    };
  }
}
