const { checkBodyFraming } = require('./bodyFraming');

const POSITIONING_DEFAULTS = Object.freeze({
  issueDwellMs: 350,
  readyHoldMs: 2000,
  uiMinimumGapMs: 200,
});

function evaluateFrame(frame, cameraView, mirrored) {
  if (frame.poseCount > 1) {
    return { ok: false, reason: 'multi_person', instruction: 'One person at a time, please.' };
  }
  const result = checkBodyFraming(frame.landmarks, cameraView, { mirrored });
  return result;
}

function createPositioningCoach(options = {}) {
  const config = { ...POSITIONING_DEFAULTS, ...options };
  const evaluate = config.evaluate || ((frame) => evaluateFrame(frame, config.cameraView, config.mirrored));
  let candidateReason;
  let candidateSince = null;
  let stableResult = null;
  let goodSince = null;
  let lastPublishedAt = -Infinity;
  let lastPublishedInstruction = null;

  function reset() {
    candidateReason = undefined;
    candidateSince = null;
    stableResult = null;
    goodSince = null;
    lastPublishedAt = -Infinity;
    lastPublishedInstruction = null;
  }

  function process(frame) {
    const ts = Number(frame?.ts || 0);
    const result = evaluate(frame || {});
    const reason = result.ok ? null : (result.reason || 'no_pose');

    if (reason !== candidateReason) {
      candidateReason = reason;
      candidateSince = ts;
    }

    if (result.ok) {
      if (goodSince === null) goodSince = ts;
    } else goodSince = null;

    const dwellMs = stableResult === null || reason === 'multi_person' ? 0 : config.issueDwellMs;
    if (stableResult === null || ts - candidateSince >= dwellMs) stableResult = { ...result, reason };

    const ready = Boolean(result.ok && goodSince !== null && ts - goodSince >= config.readyHoldMs);
    const instruction = stableResult?.instruction || result.instruction;
    const instructionChanged = instruction !== lastPublishedInstruction;
    const shouldPublish = instructionChanged && ts - lastPublishedAt >= config.uiMinimumGapMs;
    if (shouldPublish) {
      lastPublishedAt = ts;
      lastPublishedInstruction = instruction;
    }

    return {
      ...stableResult,
      ready,
      shouldPublish,
      stableForMs: candidateSince === null ? 0 : Math.max(0, ts - candidateSince),
      readyProgress: result.ok && goodSince !== null
        ? Math.min(1, Math.max(0, ts - goodSince) / config.readyHoldMs)
        : 0,
    };
  }

  return { process, reset };
}

module.exports = { POSITIONING_DEFAULTS, createPositioningCoach, evaluateFrame };
