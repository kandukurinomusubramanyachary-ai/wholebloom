const test = require('node:test');
const assert = require('node:assert/strict');
const { createRepStateMachine } = require('../src/features/strength/engine/repStateMachine');
const { createCueScheduler } = require('../src/features/strength/engine/cueScheduler');
const { createLandmarkSmoother } = require('../src/features/strength/engine/landmarkSmoothing');
const { createCoverTransform, mapNormalizedPoint } = require('../src/features/strength/engine/poseTransform');
const {
  SUMMARY_KEYS,
  assertPrivacySafeObject,
  serializeStrengthSummary,
} = require('../src/features/strength/engine/strengthPrivacy');
const { EXERCISES } = require('../src/features/strength/exercises');
const { enqueueSummary, pruneOutbox } = require('../src/features/strength/services/strengthOutbox');

function repeat(value, count = 5) {
  return Array.from({ length: count }, () => ({ ...value }));
}

const sequences = {
  'bodyweight-squat-v1': {
    reset: { kneeAngle: 170, hipAngle: 170, hipX: 0.5, kneeVelocity: 0 },
    phases: [
      { kneeAngle: 150, hipAngle: 145, hipX: 0.5, kneeVelocity: -50 },
      { kneeAngle: 100, hipAngle: 110, hipX: 0.5, kneeVelocity: -30 },
      { kneeAngle: 145, hipAngle: 150, hipX: 0.5, kneeVelocity: 40 },
      { kneeAngle: 170, hipAngle: 170, hipX: 0.5, kneeVelocity: 20 },
    ],
  },
  'wall-pushup-v1': {
    reset: { elbowAngle: 170, elbowVelocity: 0, hipDeviation: 0 },
    phases: [
      { elbowAngle: 145, elbowVelocity: -40, hipDeviation: 0 },
      { elbowAngle: 95, elbowVelocity: -30, hipDeviation: 0 },
      { elbowAngle: 145, elbowVelocity: 35, hipDeviation: 0 },
      { elbowAngle: 170, elbowVelocity: 20, hipDeviation: 0 },
    ],
  },
  'side-leg-raise-v1': {
    reset: { abduction: 5, abductionVelocity: 0, shoulderMidX: 0.5 },
    phases: [
      { abduction: 26, abductionVelocity: 30, shoulderMidX: 0.5 },
      { abduction: 35, abductionVelocity: 20, shoulderMidX: 0.5 },
      { abduction: 14, abductionVelocity: -25, shoulderMidX: 0.5 },
      { abduction: 5, abductionVelocity: -10, shoulderMidX: 0.5 },
    ],
  },
};

function drive(engine, frames, startTs = 0, stepMs = 100) {
  const events = [];
  let ts = startTs;
  for (const measurements of frames) {
    ts += stepMs;
    events.push(...engine.process({ ts, measurements, confident: true, poseCount: 1 }).events);
  }
  return { events, ts };
}

for (const exercise of EXERCISES) {
  test(`${exercise.id} counts exactly ten complete deterministic reps`, () => {
    const engine = createRepStateMachine(exercise, { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } });
    const definition = sequences[exercise.id];
    const frames = repeat(definition.reset);
    for (let rep = 0; rep < 10; rep += 1) {
      for (const phase of definition.phases) frames.push(...repeat(phase));
    }
    const result = drive(engine, frames);
    assert.equal(result.events.filter((event) => event.type === 'repAccepted').length, 10);
    assert.equal(engine.snapshot().reps, 10);
  });

  test(`${exercise.id} does not count five partial movements`, () => {
    const engine = createRepStateMachine(exercise, { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } });
    const definition = sequences[exercise.id];
    const frames = repeat(definition.reset);
    for (let rep = 0; rep < 5; rep += 1) frames.push(...repeat(definition.phases[0]), ...repeat(definition.reset));
    drive(engine, frames);
    assert.equal(engine.snapshot().reps, 0);
  });

  test(`${exercise.id} ignores jitter inside its reset deadband`, () => {
    const engine = createRepStateMachine(exercise, { activeSide: 'left', hipX: 0.5, shoulderMid: { x: 0.5 } });
    const reset = sequences[exercise.id].reset;
    const jittered = Array.from({ length: 20 }, (_, index) => Object.fromEntries(
      Object.entries(reset).map(([key, value]) => [key, typeof value === 'number' ? value + (index % 2 ? 4 : -4) : value])
    ));
    const result = drive(engine, jittered);
    assert.equal(result.events.filter((event) => event.type === 'stateChanged').length, 0);
    assert.equal(engine.snapshot().reps, 0);
  });
}

test('low confidence pauses without producing form cues', () => {
  const exercise = EXERCISES[0];
  const engine = createRepStateMachine(exercise, { activeSide: 'left' });
  const events = [];
  for (let ts = 0; ts <= 2100; ts += 100) events.push(...engine.process({ ts, landmarks: [], poseCount: 1 }).events);
  assert.equal(events.filter((event) => event.type === 'pauseRequested' && event.reason === 'low_confidence').length, 1);
  assert.equal(events.some((event) => event.type === 'cueCondition'), false);
});

test('a second pose pauses the rep engine immediately', () => {
  const engine = createRepStateMachine(EXERCISES[0], { activeSide: 'left' });
  const result = engine.process({ ts: 100, landmarks: [], poseCount: 2 });
  assert.deepEqual(result.events, [{ type: 'pauseRequested', reason: 'multi_person' }]);
});

test('cue scheduler preempts by priority and enforces cooldown and rate limits', () => {
  const scheduler = createCueScheduler({ cueMinimumGapMs: 3000, cueWindowLimit: 4 });
  const form = { id: 'form', priority: 70, cooldownMs: 10000, text: 'Form cue.' };
  const tracking = { id: 'tracking', priority: 90, cooldownMs: 1000, text: 'Tracking cue.' };
  assert.equal(scheduler.schedule([form], 0).cue.id, 'form');
  const preempt = scheduler.schedule([tracking], 500);
  assert.equal(preempt.cue.id, 'tracking');
  assert.equal(preempt.cancel, true);
  assert.equal(scheduler.schedule([form], 4000), null);
  assert.equal(scheduler.schedule([form], 11000).cue.id, 'form');
  assert.equal(scheduler.schedule([form], 12000), null);
  assert.deepEqual(scheduler.snapshot(), { form: 2, tracking: 1 });
});

test('landmark smoothing rejects a large one-frame body-relative jump', () => {
  const smoother = createLandmarkSmoother();
  const first = smoother.smooth([{ id: 11, x: 0.2, y: 0.2, visibility: 1 }], 0, 0.6);
  const second = smoother.smooth([{ id: 11, x: 0.9, y: 0.9, visibility: 1 }], 100, 0.6);
  assert.equal(first[0].x, 0.2);
  assert.equal(second[0].x, 0.2);
  assert.equal(second[0].y, 0.2);
});

test('landmark smoothing recovers after a sustained legitimate position change', () => {
  const smoother = createLandmarkSmoother();
  smoother.smooth([{ id: 11, x: 0.2, y: 0.2, visibility: 1, presence: 1 }], 0, 0.6);
  const rejected = smoother.smooth([{ id: 11, x: 0.8, y: 0.8, visibility: 1, presence: 1 }], 100, 0.6);
  const recovered = smoother.smooth([{ id: 11, x: 0.81, y: 0.79, visibility: 1, presence: 1 }], 200, 0.6);
  assert.equal(rejected[0].x, 0.2);
  assert.equal(rejected[0].stale, true);
  assert.equal(recovered[0].x, 0.81);
  assert.equal(recovered[0].y, 0.79);
  assert.equal(recovered[0].stale, false);
});

test('landmark smoothing provides a short visual grace then hides missing points', () => {
  const smoother = createLandmarkSmoother({ confidenceGraceMs: 300 });
  smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 1, presence: 1 }], 0, 0.6);
  const grace = smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 0.1, presence: 0.1 }], 250, 0.6);
  const hidden = smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 0.1, presence: 0.1 }], 301, 0.6);
  assert.equal(grace[0].stale, true);
  assert.equal(hidden[0], null);
});

test('landmark smoothing keeps the last pose briefly when detection drops a frame', () => {
  const smoother = createLandmarkSmoother({ confidenceGraceMs: 300 });
  smoother.smooth([{ id: 11, x: 0.4, y: 0.3, visibility: 1, presence: 1 }], 0, 0.6);
  const grace = smoother.smooth([], 200, 0.6);
  const hidden = smoother.smooth([], 301, 0.6);
  assert.equal(grace[11].stale, true);
  assert.equal(hidden[11], undefined);
});

test('cover transform aligns a landscape camera with a portrait preview crop', () => {
  const transform = createCoverTransform({
    sourceWidth: 960,
    sourceHeight: 720,
    viewWidth: 300,
    viewHeight: 400,
  });
  assert.equal(Math.round(transform.renderedWidth), 533);
  assert.equal(Math.round(transform.offsetX), -117);
  assert.deepEqual(mapNormalizedPoint({ x: 0.5, y: 0.5 }, transform), { x: 150, y: 200 });
});

test('cover transform mirrors overlay geometry in preview coordinates', () => {
  const transform = createCoverTransform({
    sourceWidth: 960,
    sourceHeight: 720,
    viewWidth: 300,
    viewHeight: 400,
    mirrored: true,
  });
  const left = mapNormalizedPoint({ x: 0.25, y: 0.5 }, transform);
  const right = mapNormalizedPoint({ x: 0.75, y: 0.5 }, transform);
  assert.ok(left.x > right.x);
  assert.equal(Math.round(left.x + right.x), 300);
  assert.equal(left.y, 200);
});

test('strength summary serializer emits only the privacy allowlist', () => {
  const summary = serializeStrengthSummary({
    id: 'session-1', exerciseId: 'bodyweight-squat-v1', exerciseVersion: 1,
    startedAt: '2026-08-24T00:00:00.000Z', completedAt: '2026-08-24T00:03:04.000Z',
    durationSeconds: 184, targetReps: 8, acceptedReps: 8, pauseCount: 1,
    cueCounts: { finishStanding: 2 }, completionState: 'completed', platform: 'web',
    landmarks: [{ x: 1 }], video: 'forbidden',
  });
  assert.deepEqual(Object.keys(summary).sort(), [...SUMMARY_KEYS].sort());
  assert.equal(Object.hasOwn(summary, 'landmarks'), false);
  assert.equal(Object.hasOwn(summary, 'video'), false);
});

test('privacy scan blocks media and geometry keys at any depth', () => {
  for (const value of [
    { landmarks: [] }, { nested: { cameraFrame: 'x' } }, { payload: { audio: 'x' } },
    { result: { coordinates: [1, 2] } }, { screenshot: 'x' },
  ]) assert.throws(() => assertPrivacySafeObject(value), /privacy_forbidden_key/);
});

test('outbox keeps only allowlisted summaries and expires old retries', () => {
  const now = Date.parse('2026-08-24T12:00:00.000Z');
  const summary = {
    id: 'session-outbox', exerciseId: 'wall-pushup-v1', exerciseVersion: 1,
    startedAt: '2026-08-24T11:58:00.000Z', completedAt: '2026-08-24T12:00:00.000Z',
    durationSeconds: 120, targetReps: 8, acceptedReps: 6, pauseCount: 1,
    completionState: 'stopped', platform: 'web', privacyVersion: 1,
  };
  const queue = enqueueSummary([], { ...summary, cameraFrames: ['forbidden'] }, now);
  assert.equal(queue.length, 1);
  assert.equal(Object.hasOwn(queue[0].summary, 'cameraFrames'), false);
  assert.deepEqual(pruneOutbox([
    ...queue,
    { summary: { ...summary, id: 'expired' }, queuedAt: now - 8 * 24 * 60 * 60 * 1000, attempts: 4 },
  ], now), queue);
});
