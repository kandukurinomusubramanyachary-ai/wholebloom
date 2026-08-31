const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');
const { MemoryStore } = require('../src/memory/memoryStore');
const { ResponseCache } = require('../src/cache/responseCache');

function request(port, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/v2/chat', method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

test('POST /v2/chat returns start, token, and done SSE events', async () => {
  const config = {
    nodeEnv: 'test', maxMessageChars: 10000, maxResponseChars: 6000, dataDir: '/tmp/meg-test', cacheTtlMs: 1000,
    features: { streaming: true, cache: true, localFallback: true },
    providerOrders: { FAST: ['mock'], SMART: ['mock'], SAFETY: ['mock'], DOCTOR: ['mock'], LOCAL: ['mock'] },
  };
  const app = createApp({
    config,
    store: new MemoryStore({ driver: 'memory' }),
    cache: new ResponseCache({ ttlMs: 1000 }),
    providerManager: {
      status: () => ({ mock: { configured: true, circuitOpen: false, failures: 0 } }),
      async *stream(_request, state) { state.provider = 'mock'; state.providerLatencyMs = 1; yield 'Hello '; await new Promise((resolve) => setTimeout(resolve, 5)); yield 'there.'; },
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const result = await request(server.address().port, { userId: 'u1', conversationId: 'c1', message: 'Hello Meg', context: {} });
    assert.equal(result.status, 200);
    assert.match(result.text, /event: start/);
    assert.match(result.text, /event: token/);
    assert.match(result.text, /Hello/);
    assert.match(result.text, /event: done/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
