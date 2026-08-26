const FILTER_DEFAULTS = Object.freeze({
  minCutoff: 1.2,
  beta: 0.04,
  derivativeCutoff: 1,
  outlierBodyRatio: 0.15,
  outlierRecoveryFrames: 2,
  visibilityThreshold: 0.5,
  confidenceGraceMs: 300,
});

function alpha(cutoff, elapsedSeconds) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / Math.max(elapsedSeconds, 0.0001));
}

function createLandmarkSmoother(options = {}) {
  const config = { ...FILTER_DEFAULTS, ...options };
  const previous = new Map();

  function reset() {
    previous.clear();
  }

  function smooth(landmarks, ts, bodyHeight = 1) {
    if (!Array.isArray(landmarks)) return [];
    if (landmarks.length === 0 && previous.size > 0) {
      const grace = [];
      for (const [id, last] of previous.entries()) {
        if (ts - last.lastSeenAt <= config.confidenceGraceMs) {
          grace[id] = { ...last.value, id, visibility: 0, presence: 0, stale: true };
        } else previous.delete(id);
      }
      return grace;
    }
    return landmarks.map((landmark, index) => {
      const id = Number.isInteger(landmark?.id) ? landmark.id : index;
      const confidence = Math.min(Number(landmark?.visibility ?? 1), Number(landmark?.presence ?? 1));
      const last = previous.get(id);
      const valid = Number.isFinite(Number(landmark?.x))
        && Number.isFinite(Number(landmark?.y))
        && confidence >= config.visibilityThreshold;
      if (!valid) {
        if (last && ts - last.lastSeenAt <= config.confidenceGraceMs) {
          return {
            ...last.value,
            id,
            visibility: Number(landmark?.visibility ?? 0),
            presence: Number(landmark?.presence ?? 0),
            stale: true,
          };
        }
        previous.delete(id);
        return null;
      }

      const current = { ...landmark, id, stale: false };
      if (!last) {
        previous.set(id, { value: current, ts, lastSeenAt: ts, dx: 0, dy: 0, dz: 0, pending: null, outlierCount: 0 });
        return current;
      }

      const elapsed = Math.max(0.001, (ts - last.ts) / 1000);
      const jump = Math.hypot(current.x - last.value.x, current.y - last.value.y);
      if (jump > config.outlierBodyRatio * Math.max(bodyHeight, 0.01)) {
        const pendingDistance = last.pending
          ? Math.hypot(current.x - last.pending.x, current.y - last.pending.y)
          : Infinity;
        const outlierCount = pendingDistance <= config.outlierBodyRatio * Math.max(bodyHeight, 0.01) * 0.6
          ? last.outlierCount + 1
          : 1;
        if (outlierCount < config.outlierRecoveryFrames) {
          previous.set(id, { ...last, ts, lastSeenAt: ts, pending: current, outlierCount });
          return { ...last.value, stale: true };
        }
        previous.set(id, { value: current, ts, lastSeenAt: ts, dx: 0, dy: 0, dz: 0, pending: null, outlierCount: 0 });
        return current;
      }

      const rawDx = (current.x - last.value.x) / elapsed;
      const rawDy = (current.y - last.value.y) / elapsed;
      const rawDz = (Number(current.z || 0) - Number(last.value.z || 0)) / elapsed;
      const derivativeAlpha = alpha(config.derivativeCutoff, elapsed);
      const dx = derivativeAlpha * rawDx + (1 - derivativeAlpha) * last.dx;
      const dy = derivativeAlpha * rawDy + (1 - derivativeAlpha) * last.dy;
      const dz = derivativeAlpha * rawDz + (1 - derivativeAlpha) * last.dz;
      const cutoffX = config.minCutoff + config.beta * Math.abs(dx);
      const cutoffY = config.minCutoff + config.beta * Math.abs(dy);
      const cutoffZ = config.minCutoff + config.beta * Math.abs(dz);
      const next = {
        ...current,
        x: alpha(cutoffX, elapsed) * current.x + (1 - alpha(cutoffX, elapsed)) * last.value.x,
        y: alpha(cutoffY, elapsed) * current.y + (1 - alpha(cutoffY, elapsed)) * last.value.y,
        z: alpha(cutoffZ, elapsed) * Number(current.z || 0) + (1 - alpha(cutoffZ, elapsed)) * Number(last.value.z || 0),
      };
      previous.set(id, { value: next, ts, lastSeenAt: ts, dx, dy, dz, pending: null, outlierCount: 0 });
      return next;
    });
  }

  return { reset, smooth };
}

function estimateBodyHeight(landmarks) {
  const bodyIds = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  const visible = bodyIds
    .map((id) => landmarks?.[id])
    .filter((item) => item && Number.isFinite(Number(item.y)))
    .filter((item) => Math.min(Number(item.visibility ?? 1), Number(item.presence ?? 1)) >= 0.35);
  if (visible.length < 4) return 1;
  const ys = visible.map((item) => Number(item.y));
  return Math.max(0.01, Math.max(...ys) - Math.min(...ys));
}

module.exports = { FILTER_DEFAULTS, createLandmarkSmoother, estimateBodyHeight };
