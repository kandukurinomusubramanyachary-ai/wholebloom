const { defineStage } = require('../core/TurnPipeline');

const STOP_WORDS = new Set('the a an and or but is are am i you your my to of in on for with this that it do does why how what was were be have has had can could would should from about today very really feel feeling user'.split(' '));

function terms(value = '') {
  return new Set(String(value).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

function normalizeMemory(memory = {}) {
  const text = String(memory.text ?? memory.content ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!text) return null;
  return {
    id: memory.id || null,
    type: String(memory.type || memory.layer || 'note').slice(0, 40),
    text,
    tags: Array.isArray(memory.tags) ? memory.tags.map(String).slice(0, 12) : [],
    source: String(memory.source || 'memory_store').slice(0, 40),
    confidence: Math.max(0, Math.min(1, Number(memory.confidence ?? memory.importance ?? 0.5))),
    confirmation: ['stated', 'confirmed', 'inferred'].includes(memory.confirmation) ? memory.confirmation : 'inferred',
    createdAt: memory.createdAt || null,
    lastConfirmedAt: memory.lastConfirmedAt || null,
    expiresAt: memory.expiresAt || null,
  };
}

function ageDays(date, now) {
  const timestamp = Date.parse(date || '');
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 86400000) : 30;
}

function isExpired(memory, now) {
  const expiresAt = Date.parse(memory.expiresAt || '');
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function scoreMemory(memory, queryTerms, evidenceTerms, intent, now = Date.now()) {
  const memoryTerms = terms(`${memory.text} ${memory.tags.join(' ')}`);
  let queryOverlap = 0;
  for (const term of queryTerms) if (memoryTerms.has(term)) queryOverlap += 1;
  let evidenceOverlap = 0;
  for (const term of evidenceTerms) if (memoryTerms.has(term)) evidenceOverlap += 1;

  const semantic = queryOverlap / Math.max(1, Math.min(queryTerms.size, 10));
  const contextMatch = evidenceOverlap / Math.max(1, Math.min(evidenceTerms.size, 12));
  const confirmationBoost = memory.confirmation === 'confirmed' ? 0.18 : memory.confirmation === 'stated' ? 0.12 : 0;
  const confidenceBoost = 0.15 * memory.confidence;
  const recency = 0.12 * Math.exp(-ageDays(memory.lastConfirmedAt || memory.createdAt, now) / 45);
  const intentMatch = memory.tags.includes(intent) ? 0.12 : 0;

  return semantic * 0.5 + contextMatch * 0.2 + confirmationBoost + confidenceBoost + recency + intentMatch;
}

function retrieveTypedMemories({ memoryStore, userId, message, evidence = [], intent, limit = 6, now = Date.now() }) {
  if (!memoryStore || typeof memoryStore.listMemories !== 'function' || !userId) return [];
  const raw = memoryStore.listMemories({ userId, limit: 150 }) || [];
  const queryTerms = terms(message);
  const evidenceTerms = terms(evidence.map((item) => item.text).join(' '));

  return raw
    .map(normalizeMemory)
    .filter(Boolean)
    .filter((memory) => !isExpired(memory, now))
    .map((memory) => ({ memory, score: scoreMemory(memory, queryTerms, evidenceTerms, intent, now) }))
    .filter(({ score }) => score >= 0.16)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory, score }) => ({ ...memory, relevance: Number(score.toFixed(4)) }));
}

function createMemoryRetrievalStage({ memoryStore, limit = 6 } = {}) {
  return defineStage('memory_retrieval', async (state, runtime = {}) => {
    const activeStore = runtime.memoryStore || memoryStore;
    state.memories = retrieveTypedMemories({
      memoryStore: activeStore,
      userId: state.request.userId,
      message: state.request.message,
      evidence: state.evidence,
      intent: state.understanding.intent,
      limit,
    });
    return state;
  }, { optional: true });
}

module.exports = { terms, normalizeMemory, scoreMemory, retrieveTypedMemories, createMemoryRetrievalStage, isExpired };
