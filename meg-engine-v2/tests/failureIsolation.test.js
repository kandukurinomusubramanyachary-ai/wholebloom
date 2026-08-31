const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');

function request(port) { return new Promise((resolve, reject) => { const req = http.request({ hostname: '127.0.0.1', port, path: '/v2/chat', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => { let body = ''; res.on('data', (chunk) => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body })); }); req.on('error', reject); req.end(JSON.stringify({ userId: 'u', conversationId: 'c', message: 'hello' })); }); }

test('memory and persistence failures do not turn provider answer into a 500', async () => {
  const broken = { getRecentMessages: () => { throw new Error('db read'); }, listMemories: () => { throw new Error('memory read'); }, appendMessage: () => { throw new Error('db write'); }, saveProviderMetric: () => { throw new Error('metrics'); }, addMemory() {}, markMemoryUsed() {} };
  const app = createApp({ config: { nodeEnv: 'test', maxMessageChars: 10000, maxResponseChars: 6000, memoryLimit: 5, recentMessageLimit: 8, tokenBudget: 1000, features: { streaming: true, cache: false }, providerOrders: { FAST: ['mock'], SMART: ['mock'], SAFETY: ['mock'], DOCTOR: ['mock'], LOCAL: ['mock'] }, auth: { apiKey: '' }, heartbeatMs: 0 }, store: broken, providerManager: { status: () => ({}), async *stream(_request, state) { state.provider = 'mock'; yield 'safe answer'; } } });
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  try { const result = await request(server.address().port); assert.equal(result.status, 200); assert.match(result.body, /safe answer/); } finally { await new Promise((resolve) => server.close(resolve)); }
});
