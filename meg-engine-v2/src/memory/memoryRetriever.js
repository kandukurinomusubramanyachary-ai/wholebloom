const STOP_WORDS = new Set('the a an and or but is are am i you your my to of in on for with this that it do does why how what was were be have has had can could would should from about today very really feel feeling user'.split(' '));
const CATEGORY_BY_INTENT = {
  emotional: ['mood', 'wellbeing', 'sleep'], diet_question: ['diet', 'cravings', 'sleep'], cycle_question: ['cycle', 'period', 'symptom'], symptom_question: ['symptom', 'sleep', 'mood'], doctor_prep: ['cycle', 'period', 'symptom', 'goal'], simple_health: ['health'], complex_health: ['health', 'cycle', 'symptom'],
};

function terms(text = '') {
  return new Set(String(text).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

function ageDays(createdAt, now = Date.now()) {
  const timestamp = Date.parse(createdAt || '');
  if (!Number.isFinite(timestamp)) return 30;
  return Math.max(0, (now - timestamp) / 86400000);
}

function scoreMemory(memory, queryTerms, intent, now = Date.now()) {
  const memoryTerms = terms(`${memory.content} ${(memory.tags || []).join(' ')}`);
  let overlap = 0;
  for (const term of queryTerms) if (memoryTerms.has(term)) overlap += 1;
  const semantic = overlap / Math.max(1, Math.min(queryTerms.size, 10));
  const categories = CATEGORY_BY_INTENT[intent] || [];
  const categoryMatch = categories.some((category) => (memory.tags || []).includes(category)) ? 0.25 : 0;
  const recency = 0.12 * Math.exp(-ageDays(memory.createdAt, now) / 30);
  const importance = semantic || categoryMatch ? Math.min(0.12, Number(memory.importance || 0) / 8) : 0;
  return { score: semantic + categoryMatch + recency + importance, semantic, categoryMatch, recency, importance };
}

function similarity(a, b) {
  const left = terms(a.content);
  const right = terms(b.content);
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

function retrieveRelevantMemories({ store, userId, message, context = {}, intent, limit = 5, now = Date.now() } = {}) {
  if (!store || !userId) return [];
  const queryTerms = terms(`${message} ${JSON.stringify(context)}`);
  const memories = store.listMemories({ userId, limit: 100 });
  const ranked = memories.map((memory) => ({ memory, metrics: scoreMemory(memory, queryTerms, intent, now) }))
    .filter(({ metrics }) => metrics.semantic > 0 || metrics.categoryMatch > 0)
    .sort((a, b) => b.metrics.score - a.metrics.score || String(b.memory.createdAt).localeCompare(String(a.memory.createdAt)));
  const selected = [];
  for (const item of ranked) {
    if (selected.some((existing) => similarity(existing, item.memory) > 0.85)) continue;
    selected.push(item.memory);
    if (selected.length >= limit) break;
  }
  for (const memory of selected) store.markMemoryUsed(memory.id);
  return selected;
}

module.exports = { retrieveRelevantMemories, terms, scoreMemory, ageDays, similarity };
