const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyIntent } = require('../src/router/intentRouter');
const { routeRequest } = require('../src/router/modelRouter');

test('deterministic intent router identifies core categories', () => {
  assert.equal(classifyIntent({ message: 'I feel overwhelmed and sad today' }), 'emotional');
  assert.equal(classifyIntent({ message: 'Why am I craving sweets?' }), 'diet_question');
  assert.equal(classifyIntent({ message: 'My period is 18 days late and I have cramps and spotting' }), 'cycle_question');
  assert.equal(classifyIntent({ message: 'I have a doctor appointment next week, what should I ask?' }), 'doctor_prep');
  assert.equal(classifyIntent({ message: 'What is PCOS?' }), 'simple_health');
});

test('model router selects smart, safety, and local routes', () => {
  assert.equal(routeRequest({ intent: 'complex_health', safety: {}, providerOrders: { SMART: ['openrouter'] } }).route, 'SMART');
  assert.equal(routeRequest({ intent: 'safety', safety: { triggered: true }, providerOrders: { SAFETY: ['groq'] } }).preferredProviders[0], 'groq');
  assert.equal(routeRequest({ intent: 'casual', mode: 'local', safety: {}, providerOrders: { LOCAL: ['ollama'] } }).route, 'LOCAL');
});
