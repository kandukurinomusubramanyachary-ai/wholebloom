const test = require('node:test');
const assert = require('node:assert/strict');
const { ResponseCache } = require('../src/cache/responseCache');

test('cache is limited to stable educational queries and honors TTL/versioning', () => {
  let now = 0;
  const cache = new ResponseCache({ ttlMs: 100, promptVersion: 'p1', knowledgeVersion: 'k1', now: () => now });
  const request = { intent: 'simple_health', message: 'What is PCOS?', language: 'en', safety: { triggered: false } };
  assert.equal(cache.isCacheable(request), true);
  cache.set(request, 'education'); assert.equal(cache.get(request), 'education');
  now = 101; assert.equal(cache.get(request), null);
  assert.equal(cache.isCacheable({ intent: 'emotional', message: 'I feel sad', safety: { triggered: false } }), false);
  cache.set(request, 'old'); assert.equal(cache.get({ ...request, promptVersion: 'p2' }), null);
});
