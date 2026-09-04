/**
 * Bloom Strength — geometry helpers.
 *
 * Pure functions over MediaPipe Pose landmarks. No DOM, no camera, no network.
 * Landmark shape: { x: number, y: number, z: number, visibility: number }
 * with x/y/z normalized to roughly [0, 1] image space (y grows downward, like
 * the image coordinate system MediaPipe uses).
 */

export const LM = Object.freeze({
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
});

/** Euclidean distance between two landmarks in normalized image units. */
export function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Interior angle (degrees, 0–180) at vertex `b` formed by a–b–c.
 * 180 = fully extended/straight; smaller = more flexed.
 */
export function angleDeg(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return null;
  let cos = dot / (m1 * m2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Midpoint of two landmarks. */
export function midpoint(a, b) {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0),
  };
}

/**
 * Pick the more visible of a left/right landmark pair. MediaPipe labels are
 * person-relative; in a side view one side is usually much better observed.
 * Returns { landmark, side } or { landmark: null, side: null }.
 */
export function bestSide(landmarks, leftIndex, rightIndex, threshold = 0.5) {
  const left = landmarks[leftIndex];
  const right = landmarks[rightIndex];
  const lv = left?.visibility ?? -1;
  const rv = right?.visibility ?? -1;
  if (lv < threshold && rv < threshold) {
    return { landmark: null, side: null };
  }
  if (lv >= rv) return { landmark: left, side: 'left' };
  return { landmark: right, side: 'right' };
}

/** Average x position of a set of landmark indices. */
export function averageX(landmarks, indices) {
  let sum = 0;
  let n = 0;
  for (const i of indices) {
    const lm = landmarks[i];
    if (lm) {
      sum += lm.x;
      n += 1;
    }
  }
  return n === 0 ? null : sum / n;
}

/**
 * Vertical deviation (normalized units) of a point from the straight line
 * defined by two anchor points. Used to check "move the body as one line".
 */
export function verticalDeviationFromLine(p, lineA, lineB) {
  if (!p || !lineA || !lineB) return Number.POSITIVE_INFINITY;
  const dx = lineB.x - lineA.x;
  if (Math.abs(dx) < 1e-6) {
    return Math.abs(p.x - lineA.x);
  }
  const slope = (lineB.y - lineA.y) / dx;
  const expectedY = lineA.y + slope * (p.x - lineA.x);
  return Math.abs(p.y - expectedY);
}

/** Clamp a number to a range. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
