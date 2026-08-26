const SUMMARY_KEYS = Object.freeze([
  'id', 'exerciseId', 'exerciseVersion', 'startedAt', 'completedAt',
  'durationSeconds', 'targetReps', 'acceptedReps', 'pauseCount', 'cueCounts',
  'completionState', 'platform', 'privacyVersion',
]);

const REQUIRED_SUMMARY_KEYS = Object.freeze([
  'id', 'exerciseId', 'exerciseVersion', 'startedAt', 'durationSeconds',
  'targetReps', 'acceptedReps', 'pauseCount', 'completionState', 'platform', 'privacyVersion',
]);

const FORBIDDEN_KEY_PATTERN = /(landmark|frame|video|audio|image|screenshot|point|coordinate|measurement|bodymetric)/i;

function assertPrivacySafeObject(value, path = 'payload') {
  if (!value || typeof value !== 'object') return true;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) throw new Error(`privacy_forbidden_key:${path}.${key}`);
    if (typeof item === 'string' && item.length > 4096 && /^[A-Za-z0-9+/=\s]+$/.test(item)) {
      throw new Error(`privacy_large_blob:${path}.${key}`);
    }
    assertPrivacySafeObject(item, `${path}.${key}`);
  }
  return true;
}

function finiteInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function cleanCueCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key))
    .map(([key, count]) => [key, finiteInteger(count)]));
}

function serializeStrengthSummary(input) {
  const source = input || {};
  const summary = {
    id: String(source.id || '').slice(0, 160),
    exerciseId: String(source.exerciseId || '').slice(0, 80),
    exerciseVersion: finiteInteger(source.exerciseVersion, 1),
    startedAt: source.startedAt,
    completedAt: source.completedAt,
    durationSeconds: finiteInteger(source.durationSeconds),
    targetReps: finiteInteger(source.targetReps),
    acceptedReps: finiteInteger(source.acceptedReps),
    pauseCount: finiteInteger(source.pauseCount),
    cueCounts: cleanCueCounts(source.cueCounts),
    completionState: ['completed', 'stopped', 'abandoned'].includes(source.completionState) ? source.completionState : 'abandoned',
    platform: source.platform === 'web' ? 'web' : 'native',
    privacyVersion: 1,
  };
  for (const key of REQUIRED_SUMMARY_KEYS) {
    if (summary[key] === undefined || summary[key] === null || summary[key] === '') throw new Error(`strength_summary_missing:${key}`);
  }
  if (!summary.completedAt) delete summary.completedAt;
  if (!Object.keys(summary.cueCounts).length) delete summary.cueCounts;
  assertPrivacySafeObject(summary);
  if (Object.keys(summary).some((key) => !SUMMARY_KEYS.includes(key))) throw new Error('strength_summary_extra_key');
  return summary;
}

module.exports = { FORBIDDEN_KEY_PATTERN, REQUIRED_SUMMARY_KEYS, SUMMARY_KEYS, assertPrivacySafeObject, serializeStrengthSummary };
