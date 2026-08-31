const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreResponse } = require('../src/quality/qualityScorer');

test('quality scorer exposes deterministic dimensions and human review placeholders', () => {
  const score = scoreResponse('You deserve support. PCOS can affect cycle timing, but a clinician can assess your symptoms.', {});
  assert.equal(typeof score.overall, 'number');
  assert.equal(score.humanReview.factualQuality, null);
  assert.ok(score.dimensions.warmth > 0.5);
});
