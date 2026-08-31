const test = require('node:test');
const assert = require('node:assert/strict');
const { detectSafety, safetyFallback } = require('../src/safety/safetyRouter');

test('red-flag medical language triggers before routing', () => {
  assert.deepEqual(detectSafety('I have severe pelvic pain and feel faint'), {
    triggered: true, category: 'urgent_medical', reason: 'red_flag_symptom',
  });
  assert.equal(detectSafety('I have mild cramps today').triggered, false);
});

test('self-harm safety response is deterministic and action-oriented', () => {
  const result = detectSafety("I don't want to live anymore");
  assert.equal(result.category, 'self_harm');
  assert.match(safetyFallback(result.category), /immediate|emergency/i);
});
