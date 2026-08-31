const test = require('node:test');
const assert = require('node:assert/strict');
const { detectSafety } = require('../src/safety/safetyRouter');
const { guardResponse } = require('../src/guards/responseGuard');

test('ordinary language does not trigger emergency safety', () => {
  assert.equal(detectSafety('I nearly died laughing at that meme').triggered, false);
  assert.equal(detectSafety('There is a little bleeding at the end of my period').triggered, false);
});

test('specific safety categories and health boundaries trigger deterministically', () => {
  assert.equal(detectSafety('I am pregnant and have heavy bleeding').category, 'pregnancy_emergency');
  assert.equal(detectSafety('Can you diagnose me with PCOS?').category, 'diagnosis_request');
  assert.equal(detectSafety('Should I increase my metformin dose?').category, 'medication_request');
  assert.equal(guardResponse('Take 500 mg tonight and stop your prescription.', { safety: true, safetyCategory: 'medication_request' }).ok, false);
});
