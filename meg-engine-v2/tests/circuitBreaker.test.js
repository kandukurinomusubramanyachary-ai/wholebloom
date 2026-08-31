const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderManager, CIRCUIT_STATES } = require('../src/providers/providerManager');

async function failGenerate(manager) { await assert.rejects(() => manager.generate({ providerNames: ['mock'], route: 'FAST', messages: [] })); }

test('circuit breaker transitions CLOSED to OPEN to HALF_OPEN to CLOSED', async () => {
  let now = 0;
  let calls = 0;
  let healthy = false;
  const provider = { isConfigured: () => true, async *stream() { calls += 1; if (!healthy) throw Object.assign(new Error('down'), { status: 503 }); yield 'ok'; } };
  const manager = new ProviderManager({ providers: { mock: provider }, now: () => now, config: { retries: 0, circuit: { failureThreshold: 1, cooldownMs: 100, rollingWindowMs: 1000, rollingMinimumRequests: 10 } } });
  await failGenerate(manager);
  assert.equal(manager.status().mock.state, CIRCUIT_STATES.OPEN);
  await failGenerate(manager);
  assert.equal(calls, 1);
  now = 101;
  assert.equal(manager.status().mock.state, CIRCUIT_STATES.HALF_OPEN);
  healthy = true;
  assert.equal(await manager.generate({ providerNames: ['mock'], route: 'FAST', messages: [] }), 'ok');
  assert.equal(manager.status().mock.state, CIRCUIT_STATES.CLOSED);
});

test('permanent authentication errors do not retry the same provider', async () => {
  let calls = 0;
  const manager = new ProviderManager({ providers: { bad: { isConfigured: () => true, async *stream() { calls += 1; throw Object.assign(new Error('bad key'), { status: 401, retryable: false }); } }, good: { isConfigured: () => true, async *stream() { yield 'ok'; } } }, config: { retries: 3, retry: { baseDelayMs: 0 } } });
  assert.equal(await manager.generate({ providerNames: ['bad', 'good'], route: 'FAST', messages: [] }), 'ok');
  assert.equal(calls, 1);
});
