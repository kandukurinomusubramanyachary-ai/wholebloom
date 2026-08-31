const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryStore } = require('../src/memory/memoryStore');
const { retrieveRelevantMemories } = require('../src/memory/memoryRetriever');
const { extractMemories } = require('../src/memory/memoryExtractor');

test('memory store retrieves relevant episodic memory, not unrelated history', () => {
  const store = new MemoryStore({ driver: 'memory' });
  store.addMemory({ userId: 'u1', layer: 'episodic', content: 'Sleep has been poor this week.', tags: ['sleep'], importance: 0.8 });
  store.addMemory({ userId: 'u1', layer: 'episodic', content: 'User enjoys walking after dinner.', tags: ['activity'], importance: 0.8 });
  const result = retrieveRelevantMemories({ store, userId: 'u1', message: 'Why am I craving sweets?', context: { sleepHours: 5 }, intent: 'diet_question' });
  assert.equal(result.length, 1);
  assert.match(result[0].content, /Sleep/);
});

test('memory extractor only emits small deterministic facts', () => {
  const memories = extractMemories({ message: 'I prefer vegetarian meals. My goal is to sleep better.', context: { sleepHours: 5 }, intent: 'diet_question' });
  assert.equal(memories.some((memory) => memory.layer === 'profile' && /vegetarian/.test(memory.content)), true);
  assert.equal(memories.some((memory) => memory.layer === 'profile' && /sleep better/.test(memory.content)), true);
  assert.equal(memories.some((memory) => memory.layer === 'episodic' && /5 hours/.test(memory.content)), true);
});
