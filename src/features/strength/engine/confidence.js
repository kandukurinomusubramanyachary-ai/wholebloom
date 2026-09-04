/**
 * Bloom Strength — visibility, confidence and framing gating.
 *
 * "Do not change states when required landmarks are below confidence
 * thresholds" (PRD §10). This module is the ONLY place that decides whether
 * the engine is allowed to interpret a frame.
 */

import { LM } from './geometry.js';
import { LANDMARK_CONFIDENCE } from './exercises.js';

/**
 * Evaluate required-landmark visibility for an exercise.
 *
 * @param {Array<object>} landmarks - smoothed landmarks (single person)
 * @param {Array<object>} requiredGroups - exercise.requiredGroups
 * @returns {{ ok: boolean, missing: string[] }}
 *   missing = labels of groups not sufficiently visible.
 */
export function evaluateVisibility(landmarks, requiredGroups) {
  if (!landmarks || landmarks.length === 0) {
    return { ok: false, missing: requiredGroups.map((g) => g.name) };
  }
  const missing = [];
  for (const group of requiredGroups) {
    const left = landmarks[group.left];
    const right = landmarks[group.right];
    const lv = left?.visibility ?? 0;
    const rv = right?.visibility ?? 0;
    const visible = group.requireBoth
      ? lv >= LANDMARK_CONFIDENCE && rv >= LANDMARK_CONFIDENCE
      : lv >= LANDMARK_CONFIDENCE || rv >= LANDMARK_CONFIDENCE;
    if (!visible) missing.push(group.name);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Infer camera view from visible pose geometry.
 * Shoulder-to-shoulder separation relative to shoulder-to-hip distance:
 * wide => front view, narrow => side view.
 *
 * @returns {'front'|'side'|null}
 */
export function inferView(landmarks) {
  if (!landmarks) return null;
  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  const lh = landmarks[LM.LEFT_HIP];
  const rh = landmarks[LM.RIGHT_HIP];
  if (!ls || !rs || !lh || !rh) return null;
  const shoulderWidth = Math.abs(ls.x - rs.x);
  const torso = Math.hypot((ls.x + rs.x) / 2 - (lh.x + rh.x) / 2, (ls.y + rs.y) / 2 - (lh.y + rh.y) / 2) || 0.0001;
  const ratio = shoulderWidth / torso;
  // Front view: shoulders appear broad. Side view: far shoulder occluded,
  // narrow. Wide deadband around oblique angles to avoid nagging.
  if (ratio >= 0.5) return 'front';
  if (ratio <= 0.35) return 'side';
  return null; // oblique / ambiguous
}

/**
 * Frame-level framing assessment (normalized image coords, y grows down).
 * Front-camera preview is MIRRORED: left/right screen directions match the
 * user's own left/right, which is what the stepping cues use.
 *
 * @param {Array<object>} landmarks
 * @param {object} [opts]
 * @param {boolean} [opts.mirrored=true] - false flips lateral cues (non-mirrored view)
 * @param {number} [opts.minHeightSpan=0.55] - min full-body span for full-body exercises
 * @param {number} [opts.maxHeightSpan=0.97]
 * @returns {{
 *   ok: boolean, instruction: string|null,
 *   bbox: {minX:number,minY:number,maxX:number,maxY:number}|null,
 *   reason: string|null
 * }}
 */
export function evaluateFraming(landmarks, opts = {}) {
  const { mirrored = true, minHeightSpan = 0.55, maxHeightSpan = 0.97 } = opts;
  if (!landmarks || landmarks.length === 0) {
    return { ok: false, instruction: null, bbox: null, reason: 'no-person' };
  }
  const visible = landmarks.filter((lm) => lm && (lm.visibility ?? 0) >= LANDMARK_CONFIDENCE);
  if (visible.length < 6) {
    return { ok: false, instruction: null, bbox: null, reason: 'no-person' };
  }
  const xs = visible.map((lm) => lm.x);
  const ys = visible.map((lm) => lm.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bbox = { minX, minY, maxX, maxY };
  const heightSpan = maxY - minY;
  const centreX = (minX + maxX) / 2;

  // Cut off at top of frame (head out of view) or bottom (feet out).
  if (minY < 0.03) {
    return { ok: false, instruction: 'frame-lower', bbox, reason: 'cut-top' };
  }
  if (maxY > 0.99) {
    return { ok: false, instruction: 'frame-higher', bbox, reason: 'cut-bottom' };
  }
  // Too close: figure overfills the frame.
  if (heightSpan > maxHeightSpan) {
    return { ok: false, instruction: 'frame-farther', bbox, reason: 'too-close' };
  }
  // Too far: figure too small to measure reliably.
  if (heightSpan < minHeightSpan) {
    return { ok: false, instruction: 'frame-closer', bbox, reason: 'too-far' };
  }
  // Lateral framing. Mirrored preview: on-screen left == user's left.
  if (centreX < 0.35) {
    return {
      ok: false,
      instruction: mirrored ? 'frame-step-right' : 'frame-step-left',
      bbox,
      reason: 'too-far-left',
    };
  }
  if (centreX > 0.65) {
    return {
      ok: false,
      instruction: mirrored ? 'frame-step-left' : 'frame-step-right',
      bbox,
      reason: 'too-far-right',
    };
  }
  return { ok: true, instruction: null, bbox, reason: null };
}

/**
 * Count distinct people returned by the pose detector. The MediaPipe pose
 * landmarker is configured for up to two poses; a second person must pause
 * evaluation immediately (PRD §10, §16).
 */
export function countPeople(poses) {
  return Array.isArray(poses) ? poses.filter((p) => p && p.landmarks && p.landmarks.length > 0).length : 0;
}
