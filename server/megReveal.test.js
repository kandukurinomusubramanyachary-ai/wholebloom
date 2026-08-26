const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createMegRevealPlan,
  revealPacingForWait,
} = require('../src/services/megReveal');

function words(value) {
  return String(value || '').match(/\S+/gu) || [];
}

test('normal Meg reveal starts with exactly three complete words', () => {
  const plan = createMegRevealPlan('You followed the whole plan and expected change.', 1200);
  assert.equal(plan[0].text, 'You followed the');
  assert.equal(words(plan[0].text).length, 3);
});

test('Meg reveal final frame exactly equals the original reply', () => {
  const reply = 'Cycle raakapovadam itself mentally exhausting untundi — and that matters.';
  const plan = createMegRevealPlan(reply, 2200);
  assert.equal(plan.at(-1).text, reply);
});

test('Meg reveal does not duplicate its final frame', () => {
  const reply = 'One small step can make tomorrow feel more manageable.';
  const plan = createMegRevealPlan(reply, 1000);
  assert.equal(plan.filter((frame) => frame.text === reply).length, 1);
});

test('long provider waits use larger chunks and shorter delays', () => {
  assert.deepEqual(revealPacingForWait(2000), {
    maximumWaitMs: 3500,
    wordsPerFrame: 3,
    baseDelayMs: 48,
  });
  assert.deepEqual(revealPacingForWait(7000), {
    maximumWaitMs: Infinity,
    wordsPerFrame: 9,
    baseDelayMs: 24,
  });
});

test('first Meg reveal frame remains three words at every wait threshold', () => {
  const reply = 'One two three four five six seven eight nine ten eleven twelve.';
  [0, 3499, 3500, 6000, 6001, 12000].forEach((wait) => {
    assert.equal(words(createMegRevealPlan(reply, wait)[0].text).length, 3);
  });
});

test('punctuation creates a slightly longer reveal pause', () => {
  const plain = createMegRevealPlan('One two three four five six seven eight nine ten.', 1000);
  const punctuated = createMegRevealPlan('One two three, four five six seven eight nine ten.', 1000);
  assert.ok(punctuated[0].delayMs > plain[0].delayMs);
});

test('short Meg replies display safely in one complete frame', () => {
  assert.deepEqual(createMegRevealPlan('I am here.', 500), [
    { text: 'I am here.', delayMs: 0, wordCount: 3 },
  ]);
});

test('Tenglish and Unicode text remain unchanged', () => {
  const reply = 'Periods raavatledu — chala irritation ostundi, kada?';
  const plan = createMegRevealPlan(reply, 4100);
  assert.equal(plan.at(-1).text, reply);
});

test('newlines and multiple spaces do not corrupt the completed answer', () => {
  const reply = 'You tried  hard.\n\nThat effort still matters.';
  const plan = createMegRevealPlan(reply, 800);
  assert.equal(plan.at(-1).text, reply);
});
