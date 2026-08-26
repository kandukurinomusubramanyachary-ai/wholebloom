const { angle, distance, point, velocity } = require('../engine/jointAngles');

const THRESHOLDS = Object.freeze({
  extended: 160,
  closest: 100,
  pressing: 135,
  hipBaselineTolerance: 0.1,
  hipCueTolerance: 0.15,
  slowVelocity: 150,
});

function sideIds(side) {
  return side === 'right'
    ? { ear: 8, shoulder: 12, elbow: 14, wrist: 16, hip: 24, ankle: 28 }
    : { ear: 7, shoulder: 11, elbow: 13, wrist: 15, hip: 23, ankle: 27 };
}

function lineDistance(pointValue, start, end) {
  if (!pointValue || !start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 0.0001;
  return Math.abs(dy * pointValue.x - dx * pointValue.y + end.x * start.y - end.y * start.x) / length;
}

function measure(landmarks, baseline = {}, history = {}) {
  const ids = sideIds(baseline.activeSide || 'left');
  const shoulder = point(landmarks, ids.shoulder);
  const hip = point(landmarks, ids.hip);
  const ankle = point(landmarks, ids.ankle);
  const elbowAngle = angle(shoulder, point(landmarks, ids.elbow), point(landmarks, ids.wrist));
  const torsoLength = distance(shoulder, hip) || 0.0001;
  const hipDeviation = lineDistance(hip, shoulder, ankle) / torsoLength;
  return {
    elbowAngle,
    hipDeviation,
    elbowVelocity: velocity(elbowAngle, history.previousMeasurements?.elbowAngle, history.ts - history.previousTs),
  };
}

function nextState(state, values, baseline = {}) {
  if (!Number.isFinite(values.elbowAngle)) return state;
  if (state === 'armsExtended' && values.elbowAngle < THRESHOLDS.extended - 5) return 'lowering';
  if (state === 'lowering' && values.elbowAngle <= THRESHOLDS.closest) return 'closest';
  if (state === 'closest' && values.elbowAngle >= THRESHOLDS.pressing + 5) return 'pressing';
  const deviationBaseline = baseline.hipDeviation ?? 0;
  const stable = Math.abs(values.hipDeviation - deviationBaseline) <= THRESHOLDS.hipBaselineTolerance;
  if (state === 'pressing' && values.elbowAngle >= THRESHOLDS.extended && stable) return 'armsExtended';
  return state;
}

const config = Object.freeze({
  id: 'wall-pushup-v1',
  exerciseVersion: 1,
  reviewStatus: 'pending-pro',
  camera: 'side-view',
  resetState: 'armsExtended',
  requiredLandmarks: [7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 27, 28],
  requiredLandmarksFor: (baseline) => Object.values(sideIds(baseline.activeSide || 'left')),
  thresholds: THRESHOLDS,
  calibrationChecks: { fullBody: true, stillHold: true, camera: 'side-view' },
  measurements: ['elbowAngle', 'elbowVelocity', 'hipDeviation'],
  states: ['armsExtended', 'lowering', 'closest', 'pressing'],
  measure,
  nextState,
  acceptsRep: (from) => from === 'pressing',
  cues: [
    { id: 'wholeBody', priority: 70, cooldownMs: 10000, maxPerSession: 6, text: 'Bring your whole body toward the wall together.', condition: ({ measurements, baseline }) => Math.abs(measurements.hipDeviation - (baseline.hipDeviation ?? 0)) > THRESHOLDS.hipCueTolerance },
    { id: 'finishArms', priority: 70, cooldownMs: 10000, maxPerSession: 6, text: 'Finish by extending your arms.', condition: ({ measurements, state }) => state === 'pressing' && measurements.elbowAngle >= 145 && measurements.elbowAngle < 160 },
    { id: 'slowDown', priority: 70, cooldownMs: 10000, maxPerSession: 6, text: 'Slow down and keep the rep controlled.', condition: ({ measurements }) => Math.abs(measurements.elbowVelocity) > THRESHOLDS.slowVelocity },
  ],
  stopConditions: ['pain', 'dizzy', 'faint', 'unusually_breathless', 'unwell'],
});

module.exports = config;
