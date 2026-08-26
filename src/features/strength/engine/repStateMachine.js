const { requiredLandmarksVisible } = require('./bodyFraming');
const { STRENGTH_DEFAULTS } = require('../constants');

function createRepStateMachine(exerciseConfig, baseline = {}, options = {}) {
  if (!exerciseConfig || typeof exerciseConfig.measure !== 'function' || typeof exerciseConfig.nextState !== 'function') {
    throw new Error('A deterministic exercise config is required.');
  }
  const config = { ...STRENGTH_DEFAULTS, ...options };
  let state = exerciseConfig.resetState;
  let pendingState = null;
  let pendingFrames = 0;
  let pendingSince = null;
  let cycleStartedAt = null;
  let lowConfidenceSince = null;
  let pausedReason = null;
  let reentryFrames = 0;
  let previousMeasurements = null;
  let previousTs = null;
  let reps = 0;

  function reset() {
    state = exerciseConfig.resetState;
    pendingState = null;
    pendingFrames = 0;
    pendingSince = null;
    cycleStartedAt = null;
    lowConfidenceSince = null;
    pausedReason = null;
    reentryFrames = 0;
    previousMeasurements = null;
    previousTs = null;
    reps = 0;
  }

  function pause(reason, events) {
    if (pausedReason !== reason) events.push({ type: 'pauseRequested', reason });
    pausedReason = reason;
    reentryFrames = 0;
  }

  function process(frame) {
    const ts = Number(frame?.ts);
    if (!Number.isFinite(ts)) throw new Error('Frame timestamp must be finite.');
    const events = [];
    const poseCount = Number.isInteger(frame.poseCount) ? frame.poseCount : frame.poses?.length;
    if (poseCount > 1) {
      pause('multi_person', events);
      return { events, state: 'paused', reps, measurements: previousMeasurements };
    }

    const required = typeof exerciseConfig.requiredLandmarksFor === 'function'
      ? exerciseConfig.requiredLandmarksFor(baseline)
      : exerciseConfig.requiredLandmarks;
    const confidence = frame.measurements
      ? { ok: frame.confident !== false, missing: [] }
      : requiredLandmarksVisible(frame.landmarks, required, config.visibilityThreshold);
    if (!confidence.ok) {
      if (lowConfidenceSince === null) lowConfidenceSince = ts;
      if (ts - lowConfidenceSince >= config.lowConfidenceMs) pause('low_confidence', events);
      return { events, state: pausedReason ? 'paused' : state, reps, measurements: previousMeasurements };
    }
    lowConfidenceSince = null;
    if (pausedReason) {
      reentryFrames += 1;
      if (reentryFrames < config.reentryFrames) return { events, state: 'paused', reps, measurements: previousMeasurements };
      events.push({ type: 'stateChanged', from: 'paused', to: state });
      pausedReason = null;
      reentryFrames = 0;
    }

    const measurements = frame.measurements || exerciseConfig.measure(
      frame.landmarks,
      baseline,
      { previousMeasurements, previousTs, ts }
    );
    const candidate = exerciseConfig.nextState(state, measurements, baseline);
    if (candidate && candidate !== state) {
      if (candidate !== pendingState) {
        pendingState = candidate;
        pendingFrames = 1;
        pendingSince = ts;
      } else {
        pendingFrames += 1;
      }
      if (pendingFrames >= config.transitionFrames && ts - pendingSince >= config.transitionHoldMs) {
        const from = state;
        state = candidate;
        pendingState = null;
        pendingFrames = 0;
        pendingSince = null;
        events.push({ type: 'stateChanged', from, to: state });
        if (from === exerciseConfig.resetState && state !== exerciseConfig.resetState) cycleStartedAt = ts;
        if (state === exerciseConfig.resetState && from !== exerciseConfig.resetState) {
          const cycleMs = cycleStartedAt === null ? 0 : ts - cycleStartedAt;
          if (exerciseConfig.acceptsRep(from, measurements, baseline) && cycleMs >= config.minimumCycleMs) {
            reps += 1;
            events.push({ type: 'repAccepted', count: reps, durationMs: cycleMs });
          }
          cycleStartedAt = null;
        }
      }
    } else {
      pendingState = null;
      pendingFrames = 0;
      pendingSince = null;
    }

    for (const cue of exerciseConfig.cues || []) {
      if (cue.condition({ measurements, state, baseline, ts })) {
        events.push({ type: 'cueCondition', id: cue.id, cue });
      }
    }
    previousMeasurements = measurements;
    previousTs = ts;
    return { events, state, reps, measurements };
  }

  return { process, reset, snapshot: () => ({ state, reps, pausedReason }) };
}

module.exports = { createRepStateMachine };
