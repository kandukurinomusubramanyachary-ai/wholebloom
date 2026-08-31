const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderManager } = require('../src/providers/providerManager');

test('client AbortSignal reaches the provider and does not fall through', async () => {
  const controller = new AbortController(); let providerSignal;
  const manager = new ProviderManager({ providers: { mock: { isConfigured: () => true, async *stream({ signal }) { providerSignal = signal; yield 'prefix'; await new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })), { once: true }); setTimeout(resolve, 100); }); } } }, config: { retries: 0, timeouts: { FAST: 1000 } } });
  const iterator = manager.stream({ providerNames: ['mock'], route: 'FAST', messages: [], signal: controller.signal }, {});
  assert.equal((await iterator.next()).value, 'prefix');
  controller.abort();
  await assert.rejects(() => iterator.next(), (error) => error.code === 'CLIENT_ABORT' || error.code === 'STREAM_ERROR');
  assert.equal(providerSignal.aborted, true);
});
