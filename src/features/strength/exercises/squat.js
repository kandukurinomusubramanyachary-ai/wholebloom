const { angle, midpoint, point, velocity } = require('../engine/jointAngles');

const THRESHOLDS = Object.freeze({
  standing: 165,
  descend: 160,
  bottom: 110,
  rising: 135,
  hipFinish: 165,
  hipDrift: 0.05,
  slowVelocity: 120,
});

function sideIds(side) {
  return side === 'right'
    ? { shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30 }
    : { shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29 };
}

function measure(landmarks, baseline = {}, history = {}) {
  const ids = sideIds(baseline.activeSide || 'left');
  const kneeAngle = angle(point(landmarks, ids.hip), point(landmarks, ids.knee), point(landmarks, ids.ankle));
  const hipAngle = angle(point(landmarks, ids.shoulder), point(landmarks, ids.hip), point(landmarks, ids.knee));
  const hipMid = midpoint(point(landmarks, 23), point(landmarks, 24));
  return {
    kneeAngle,
    hipAngle,
    hipX: hipMid?.x ?? null,
    kneeVelocity: velocity(kneeAngle, history.previousMeasurements?.kneeAngle, history.ts - history.previousTs),
  };
}

function nextState(state, values, baseline = {}) {
  if (!Number.isFinite(values.kneeAngle)) return state;
  if (state === 'standing' && values.kneeAngle < THRESHOLDS.descend - 5) return 'descending';
  if (state === 'descending' && values.kneeAngle <= THRESHOLDS.bottom) return 'bottom';
  if (state === 'bottom' && values.kneeAngle >= THRESHOLDS.rising + 5) return 'rising';
  const baselineHipX = baseline.hipMid?.x ?? baseline.hipX ?? values.hipX;
  const hipStable = !Number.isFinite(baselineHipX) || Math.abs(values.hipX - baselineHipX) <= THRESHOLDS.hipDrift;
  if (state === 'rising' && values.kneeAngle >= THRESHOLDS.standing && values.hipAngle >= THRESHOLDS.hipFinish && hipStable) return 'standing';
  return state;
}

const config = Object.freeze({
  id: 'bodyweight-squat-v1',
  exerciseVersion: 1,
  reviewStatus: 'pending-pro',
  camera: 'side-view',
  resetState: 'standing',
  requiredLandmarks: [11, 12, 23, 24, 25, 26, 27, 28, 29, 30],
  requiredLandmarksFor: (baseline) => {
    const ids = sideIds(baseline.activeSide || 'left');
    return [ids.shoulder, 23, 24, ids.knee, ids.ankle, ids.heel];
  },
  thresholds: THRESHOLDS,
  calibrationChecks: { fullBody: true, stillHold: true, camera: 'side-view' },
  measurements: ['kneeAngle', 'hipAngle', 'kneeVelocity', 'hipX'],
  states: ['standing', 'descending', 'bottom', 'rising'],
  measure,
  nextState,
  acceptsRep: (from) => from === 'rising',
  cues: [
    { id: 'slowDown', priority: 70, cooldownMs: 10000, maxPerSession: 6, text: 'Slow the movement down.', condition: ({ measurements }) => Math.abs(measurements.kneeVelocity) > THRESHOLDS.slowVelocity },
    { id: 'finishStanding', priority: 70, cooldownMs: 10000, maxPerSession: 6, text: 'Stand tall to finish the rep.', condition: ({ measurements, state }) => state === 'rising' && measurements.kneeAngle >= 145 && measurements.kneeAngle < 160 },
  ],
  stopConditions: ['pain', 'dizzy', 'faint', 'unusually_breathless', 'unwell'],
});

module.exports = config;
