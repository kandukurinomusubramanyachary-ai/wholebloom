const test = require('node:test');
const assert = require('node:assert/strict');
const { buildContext } = require('../src/context/contextBuilder');
const { buildMegPrompt } = require('../src/prompts/promptBuilder');

test('context builder includes relevant fields and excludes unrelated fields', () => {
  const context = buildContext({
    intent: 'diet_question',
    message: 'Why am I craving sweets?',
    context: { cycleDay: 22, sleepHours: 5, recentFood: ['skipped breakfast'], exerciseHistory: ['running'], doctorReport: 'unrelated' },
  });
  assert.equal(context.sleepHours, 5);
  assert.deepEqual(context.recentFood, ['skipped breakfast']);
  assert.equal(context.exerciseHistory, undefined);
  assert.equal(context.doctorReport, undefined);
});

test('prompt composition keeps Meg identity and relevant memory without provider details', () => {
  const [system, user] = buildMegPrompt({
    intent: 'emotional',
    context: { mood: 'stressed' },
    memories: [{ content: 'User prefers concise responses.' }],
    recentMessages: [{ role: 'user', content: 'Today has been hard.' }],
    message: 'I feel terrible today',
  });
  assert.match(system.content, /warm and emotionally intelligent/);
  assert.match(system.content, /stressed/);
  assert.match(system.content, /concise responses/);
  assert.equal(user.role, 'user');
  assert.doesNotMatch(system.content, /gemini|openrouter/i);
});
