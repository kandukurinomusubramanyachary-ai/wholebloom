const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeError } = require('../src/providers/provider');

test('provider errors normalize to retryable and permanent classes', () => {
  assert.equal(normalizeError(Object.assign(new Error('rate'), { status: 429 }), 'x').retryable, true);
  assert.equal(normalizeError(Object.assign(new Error('bad key'), { status: 401 }), 'x').retryable, false);
  assert.equal(normalizeError(Object.assign(new Error('timeout'), { name: 'AbortError' }), 'x').code, 'TIMEOUT');
});
