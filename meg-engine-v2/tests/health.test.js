const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');
const { MemoryStore } = require('../src/memory/memoryStore');

function get(port, path) { return new Promise((resolve, reject) => { http.get({ hostname: '127.0.0.1', port, path }, (res) => { let body = ''; res.on('data', (chunk) => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body })); }).on('error', reject); }); }

test('health distinguishes configured providers without exposing credentials', async () => {
  const app = createApp({ config: { nodeEnv: 'test', engineVersion: '0.2.0', features: { streaming: true }, auth: { apiKey: '' } }, store: new MemoryStore({ driver: 'memory' }), providerManager: { status: () => ({ gemini: { configured: false, state: 'CLOSED' } }), healthCheck: async () => ({ gemini: { configured: false, available: false } }) } });
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  try { const result = await get(server.address().port, '/health'); assert.equal(result.status, 200); assert.match(result.body, /meg-engine-v2/); assert.doesNotMatch(result.body, /API_KEY|secret/); } finally { await new Promise((resolve) => server.close(resolve)); }
});
