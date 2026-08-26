const { assertPrivacySafeObject, serializeStrengthSummary } = require('../engine/strengthPrivacy');

function pruneOutbox(items, now = Date.now(), maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && now - Number(item.queuedAt || 0) <= maxAgeMs)
    .map((item) => ({
      summary: serializeStrengthSummary(item.summary),
      queuedAt: Number(item.queuedAt),
      attempts: Math.max(0, Number(item.attempts || 0)),
    }));
}

function enqueueSummary(items, summary, now = Date.now()) {
  const safe = serializeStrengthSummary(summary);
  const next = [
    ...(Array.isArray(items) ? items : []).filter((item) => item?.summary?.id !== safe.id),
    { summary: safe, queuedAt: now, attempts: 0 },
  ];
  assertPrivacySafeObject(next);
  return next;
}

module.exports = { enqueueSummary, pruneOutbox };
