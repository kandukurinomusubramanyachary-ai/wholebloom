const { guardResponse } = require('../guards/responseGuard');

function clamp(value) { return Math.max(0, Math.min(1, value)); }
function scoreResponse(text, { safety = false, safetyCategory } = {}) {
  const value = String(text || '').trim();
  const guarded = guardResponse(value, { safety, safetyCategory });
  const sentences = value.split(/[.!?]+/).filter(Boolean);
  const avgSentenceLength = sentences.length ? value.length / sentences.length : value.length;
  const dimensions = {
    specificity: clamp((value.length > 80 ? 0.45 : 0.15) + (/\b(PCOS|cycle|period|sleep|symptom|clinician|doctor)\b/i.test(value) ? 0.4 : 0)),
    warmth: clamp(/\b(sorry|glad|with you|deserve|gently|together|support)\b/i.test(value) ? 0.8 : 0.35),
    clarity: clamp(avgSentenceLength < 280 ? 0.85 : 0.55),
    conciseness: clamp(value.length <= 1200 ? 0.9 : 0.5),
    safety: guarded.ok ? 1 : 0,
    personalityConsistency: clamp(!/\b(as an ai|language model|system message)\b/i.test(value) ? 0.85 : 0.1),
  };
  const values = Object.values(dimensions);
  return { dimensions, overall: values.reduce((sum, item) => sum + item, 0) / values.length, valid: guarded.ok, humanReview: { factualQuality: null, memoryRelevance: null, reviewer: null } };
}

module.exports = { scoreResponse };
