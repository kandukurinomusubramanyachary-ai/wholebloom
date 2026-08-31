const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');
const { MemoryStore } = require('../src/memory/memoryStore');

function send(port, body) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: '/v2/chat', method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' } }, (response) => { let text = ''; response.on('data', (chunk) => { text += chunk; }); response.on('end', () => resolve({ status: response.statusCode, text })); });
    request.on('error', reject); request.end(JSON.stringify(body));
  });
}

function testApp(providerManager, store) {
  return createApp({
    config: { nodeEnv: 'test', maxMessageChars: 10000, maxResponseChars: 6000, recentMessageLimit: 8, memoryLimit: 5, tokenBudget: 4200, idempotencyStaleMs: 120000, engineVersion: 'test', promptVersion: 'test', routerVersion: 'test', knowledgeVersion: 'test', auth: { apiKey: '' }, features: { streaming: true, cache: false, localFallback: true }, providerOrders: { FAST: ['mock'], SMART: ['mock'], SAFETY: ['mock'], DOCTOR: ['mock'], LOCAL: ['mock'] }, heartbeatMs: 0 },
    store, providerManager,
  });
}

test('same messageId generates once and completed retry replays the result', async () => {
  let calls = 0;
  const providerManager = { async *stream(_request, state) { calls += 1; state.provider = 'mock'; yield 'one '; await new Promise((resolve) => setTimeout(resolve, 30)); yield 'answer'; }, status: () => ({}) };
  const store = new MemoryStore({ driver: 'memory' });
  const app = testApp(providerManager, store); const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const body = { userId: 'u', conversationId: 'c', messageId: 'm-1', message: 'Hello there' };
  try {
    const [first, second] = await Promise.all([send(server.address().port, body), send(server.address().port, body)]);
    assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(calls, 1);
    assert.match(second.text, /deduplicated/);
    assert.match(second.text, /\"conversationId\":\"c\"/);
    const messages = store.getRecentMessages({ userId: 'u', conversationId: 'c', limit: 10 });
    assert.equal(messages.length, 2);
    const replay = await send(server.address().port, body);
    assert.equal(replay.status, 200); assert.equal(calls, 1); assert.match(replay.text, /one/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('same messageId with different content is rejected', async () => {
  const store = new MemoryStore({ driver: 'memory' });
  const app = testApp({ async *stream(_request, state) { state.provider = 'mock'; yield 'ok'; }, status: () => ({}) }, store); const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = { userId: 'u2', conversationId: 'c2', messageId: 'm-2', message: 'First' };
    assert.equal((await send(server.address().port, base)).status, 200);
    assert.equal((await send(server.address().port, { ...base, message: 'Different' })).status, 409);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
