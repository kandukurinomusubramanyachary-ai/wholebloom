const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderManager } = require('../src/providers/providerManager');

async function collect(stream) { let text = ''; for await (const token of stream) text += token; return text; }

test('provider manager retries once then falls back without repeating the broken provider forever', async () => {
  let firstCalls = 0;
  const providers = {
    first: {
      isConfigured: () => true,
      async *stream() { firstCalls += 1; throw Object.assign(new Error('rate limit'), { status: 429, retryable: true }); },
    },
    second: {
      isConfigured: () => true,
      async *stream() { yield 'fallback '; yield 'reply'; },
    },
  };
  const manager = new ProviderManager({ providers, config: { retries: 1, circuit: { failureThreshold: 5, cooldownMs: 1000 }, timeouts: { FAST: 1000 } } });
  const state = {};
  const result = await collect(manager.stream({ providerNames: ['first', 'second'], route: 'FAST', messages: [] }, state));
  assert.equal(result, 'fallback reply');
  assert.equal(firstCalls, 2);
  assert.equal(state.provider, 'second');
  assert.equal(state.fallbacks, 1);
});
