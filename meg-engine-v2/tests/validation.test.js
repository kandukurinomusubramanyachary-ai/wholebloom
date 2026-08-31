const test = require('node:test');
const assert = require('node:assert/strict');
const { validateChatBody } = require('../src/utils/validation');

test('chat validation rejects missing identifiers and unsupported mode', () => {
  const result = validateChatBody({ message: 'hi', mode: 'unknown' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /userId/);
  assert.match(result.errors.join(' '), /mode/);
});
