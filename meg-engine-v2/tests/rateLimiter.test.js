const test = require('node:test');
const assert = require('node:assert/strict');
const { RateLimiter } = require('../src/reliability/rateLimiter');

test('rate limiter is bounded per key and resets after its window', () => {
  let now = 0; const limiter = new RateLimiter({ limit: 2, windowMs: 100, now: () => now });
  assert.equal(limiter.allow('a'), true); assert.equal(limiter.allow('a'), true); assert.equal(limiter.allow('a'), false); assert.equal(limiter.allow('b'), true);
  now = 101; assert.equal(limiter.allow('a'), true);
});
