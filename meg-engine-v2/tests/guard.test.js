const test = require('node:test');
const assert = require('node:assert/strict');
const { guardResponse } = require('../src/guards/responseGuard');

test('response guard trims excessive questions and generic disclaimers', () => {
  const result = guardResponse('As an AI, I can help. You definitely have PCOS? Are you okay?', { maxChars: 500 });
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.text, /^As an AI/i);
  assert.equal((result.text.match(/\?/g) || []).length, 1);
  assert.ok(result.issues.includes('multiple_questions'));
});
