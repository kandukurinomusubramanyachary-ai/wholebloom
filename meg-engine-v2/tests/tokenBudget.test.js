const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMegPrompt } = require('../src/prompts/promptBuilder');
const { estimateTokens } = require('../src/utils/tokenBudget');

test('prompt composer respects a bounded token budget and preserves latest message', () => {
  const prompt = buildMegPrompt({ intent: 'complex_health', tokenBudget: 900, message: 'Please explain my cycle and symptoms in detail. ' + 'latest '.repeat(500), recentMessages: Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'old context '.repeat(100) })), memories: Array.from({ length: 10 }, (_, i) => ({ content: `memory ${i} ` + 'detail '.repeat(100) })) });
  assert.ok(prompt.every((item) => estimateTokens(item.content) <= 950));
  assert.match(prompt[1].content, /latest/);
  assert.match(prompt[0].content, /You are Meg/);
});
