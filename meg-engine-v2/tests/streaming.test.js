const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderManager } = require('../src/providers/providerManager');

async function collect(stream) { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return chunks; }

test('provider manager exposes tokens before the stream completes', async () => {
  let completed = false;
  const manager = new ProviderManager({ providers: { mock: { isConfigured: () => true, async *stream() { yield 'first'; await new Promise((resolve) => setTimeout(resolve, 20)); yield 'second'; completed = true; } } }, config: { retries: 0, timeouts: { FAST: 1000 } } });
  const iterator = manager.stream({ providerNames: ['mock'], route: 'FAST', messages: [] }, {});
  const first = await iterator.next();
  assert.equal(first.value, 'first');
  assert.equal(completed, false);
  const rest = await collect(iterator);
  assert.deepEqual(rest, ['second']);
});
