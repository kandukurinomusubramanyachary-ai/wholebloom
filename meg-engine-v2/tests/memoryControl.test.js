const test = require('node:test');
const assert = require('node:assert/strict');
const { MemoryStore } = require('../src/memory/memoryStore');

test('memory controls clear and delete scoped user data', () => {
  const store = new MemoryStore({ driver: 'memory' });
  store.addMemory({ userId: 'u', conversationId: 'c', layer: 'profile', content: 'pref', tags: [] });
  store.appendMessage({ userId: 'u', conversationId: 'c', role: 'user', content: 'hello' });
  assert.deepEqual(store.deleteConversation({ userId: 'u', conversationId: 'c' }), { messages: 1, memories: 1 });
  assert.equal(store.exportUserData({ userId: 'u' }).messages.length, 0);
});
