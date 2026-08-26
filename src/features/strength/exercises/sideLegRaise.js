const { deviationFromVertical, midpoint, point, velocity } = require('../engine/jointAngles');

const THRESHOLDS = Object.freeze({
  neutral: 15,
  raising: 20,
  top: 30,
  lowering: 20,
  activeLegDeviation: 10,
  torsoDrift: 0.08,
  lowerVelocity: 90,
});

function resolveSide(landmarks, baseline = {}) {
  if (baseline.activeSide) return baseline.activeSide;
  const left = deviationFromVertical(point(landmarks, 23), point(landmarks, 27)) || 0;
  const right = deviationFromVertical(point(landmarks, 24), point(landmarks, 28)) || 0;
  return left >= right ? 'left' : 'right';
}

function measure(landmarks, baseline = {}, history = {}) {
  const side = resolveSide(landmarks, baseline);
  const hipId = side === 'right' ? 24 : 23;
  const ankleId = side === 'right' ? 28 : 27;
  const abduction = deviationFromVertical(point(landmarks, hipId), point(landmarks, ankleId));
  const shoulderMid = midpoint(point(landmarks, 11), point(landmarks, 12));
  return {
    activeSide: side,
    abduction,
    shoulderMidX: shoulderMid?.x ?? null,
    abductionVelocity: velocity(abduction, history.previousMeasurements?.abduction, history.ts - history.previousTs),
  };
}

function nextState(state, values) {
  if (!Number.isFinite(values.abduction)) return state;
  if (state === 'neutral' && values.abduction >= THRESHOLDS.raising + 5) return 'raising';
  if (state === 'raising' && values.abduction >= THRESHOLDS.top) return 'top';
  if (state === 'top' && values.abduction <= THRESHOLDS.lowering - 5) return 'lowering';
  if (state === 'lowering' && values.abduction <= THRESHOLDS.neutral) return 'neutral';
  return state;
}

const config = Object.freeze({
  id: 'side-leg-raise-v1',
  exerciseVersion: 1,
  reviewStatus: 'pending-pro',
  camera: 'front-view',
  resetState: 'neutral',
  requiredLandmarks: [11, 12, 23, 24, 25, 26, 27, 28],
  thresholds: THRESHOLDS,
  calibrationChecks: { fullBody: true, stillHold: true, camera: 'front-view' },
  measurements: ['abduction', 'abductionVelocity', 'shoulderMidX'],
  states: ['neutral', 'raising', 'top', 'lowering'],
  measure,
  nextState,
  acceptsRep: (from) => from === 'lowering',
  cues: [
    { id: 'torsoSteady', priority: 70, cooldownMs: 10000, maxPerSession: 6, text: 'Keep your torso a little steadier.', condition: ({ measurements, baseline }) => Math.abs(measurements.shoulderMidX - (baseline.shoulderMid?.x ?? measurements.shoulderMidX)) > THRESHOLDS.torsoDrift },
    { id: 'lowerSlowly', priority: 70, cooldownMs: 10000, maxPerSession: 6, text: 'Lower the leg slowly.', condition: ({ measurements, state }) => state === 'lowering' && Math.abs(measurements.abductionVelocity) > THRESHOLDS.lowerVelocity },
    { id: 'returnCentre', priority: 70, cooldownMs: 15000, maxPerSession: 4, text: 'Return to the centre before the next rep.', condition: ({ measurements, state }) => state !== 'neutral' && measurements.abduction < 10 },
  ],
  stopConditions: ['pain', 'dizzy', 'faint', 'unusually_breathless', 'unwell'],
});

module.exports = config;
