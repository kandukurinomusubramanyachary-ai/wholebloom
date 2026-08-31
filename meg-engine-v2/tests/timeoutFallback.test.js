const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderManager } = require('../src/providers/providerManager');

async function text(manager) { let output = ''; for await (const token of manager.stream({ providerNames: ['slow', 'fast'], route: 'FAST', messages: [] }, {})) output += token; return output; }

test('timeout is bounded and falls back to the next provider', async () => {
  const manager = new ProviderManager({ providers: {
    slow: { isConfigured: () => true, async *stream({ signal }) { await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 100); signal.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('timeout'), { name: 'AbortError' })); }, { once: true }); }); } },
    fast: { isConfigured: () => true, async *stream() { yield 'fallback'; } },
  }, config: { retries: 0, timeouts: { FAST: 10 }, circuit: { failureThreshold: 3 } } });
  assert.equal(await text(manager), 'fallback');
});
