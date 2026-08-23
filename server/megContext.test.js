const assert = require('node:assert/strict');
const test = require('node:test');
const {
  MAX_CONTEXT_BLOCK_LENGTH,
  MAX_CONTEXT_BLOCK_LINES,
  MegContextValidationError,
  buildUserContextBlock,
  cleanMegContext,
} = require('./megContext');
const {
  MEG_MODES,
  MODE_INSTRUCTIONS,
  buildModeInstruction,
  cleanMegMode,
} = require('./megModes');

test('valid Meg context is sanitized and rendered as short natural observations', () => {
  const context = cleanMegContext({
    cycleDay: 18,
    averageCycleLength: 32,
    currentPhase: 'Later cycle',
    todayCheckin: {
      mood: ' low ',
      energy: 3,
      sleep: 5,
      pain: 6,
      flow: 'light',
      privateNote: 'must not escape',
    },
    mealsLogged: 2,
    movementLogged: true,
    goals: ['understand my cycle', 'steady energy'],
    trackingMode: 'pcos',
    email: 'private@example.test',
    isAdmin: true,
  });

  assert.deepEqual(context, {
    cycleDay: 18,
    averageCycleLength: 32,
    currentPhase: 'luteal',
    todayCheckin: { mood: 'low', energy: 3, sleep: 5, pain: 6, flow: 'light' },
    mealsLogged: 2,
    movementLogged: true,
    goals: ['understand my cycle', 'steady energy'],
    trackingMode: 'pcos',
  });

  const block = buildUserContextBlock(context);
  assert.match(block, /Current cycle day: 18 \(luteal phase\)\./);
  assert.match(block, /Average cycle length: about 32 days\./);
  assert.match(block, /mood low/);
  assert.match(block, /energy 3\/10/);
  assert.match(block, /sleep 5h/);
  assert.match(block, /pain\/cramps 6\/10/);
  assert.match(block, /2 meals today and movement today/);
  assert.match(block, /focus is understanding PCOS or irregular cycles/);
  assert.match(block, /observations, never a diagnosis/);
  assert.ok(block.length <= MAX_CONTEXT_BLOCK_LENGTH);
  assert.ok(block.split('\n').length <= MAX_CONTEXT_BLOCK_LINES);
  assert.doesNotMatch(block, /private|email|admin/i);
});

test('missing Meg context fields are omitted instead of described as unknown or absent', () => {
  const context = cleanMegContext({
    todayCheckin: { mood: 'calm' },
    mealsLogged: 0,
    movementLogged: false,
  });
  const block = buildUserContextBlock(context);

  assert.match(block, /mood calm/);
  assert.doesNotMatch(block, /cycle|meal|movement|unknown|none logged/i);
});

test('non-object and empty Meg context values clean to null', () => {
  for (const value of [undefined, null, false, 4, 'context', [], {}]) {
    assert.equal(cleanMegContext(value), null);
  }
  assert.equal(buildUserContextBlock(null), '');
});

test('oversized and malformed allowed Meg context fields are rejected', () => {
  const invalidContexts = [
    { cycleDay: 0 },
    { cycleDay: 501 },
    { cycleDay: 4.5 },
    { averageCycleLength: 121 },
    { currentPhase: 'administrator phase' },
    { todayCheckin: [] },
    { todayCheckin: { mood: 'x'.repeat(61) } },
    { todayCheckin: { energy: 11 } },
    { todayCheckin: { sleep: -1 } },
    { todayCheckin: { pain: '7' } },
    { todayCheckin: { flow: 'flooding' } },
    { mealsLogged: 21 },
    { movementLogged: 'yes' },
    { goals: Array.from({ length: 11 }, () => 'goal') },
    { goals: ['x'.repeat(61)] },
    { goals: [''] },
    { goals: [null] },
    { trackingMode: 'admin' },
  ];

  invalidContexts.forEach((context) => {
    assert.throws(() => cleanMegContext(context), MegContextValidationError);
  });
});

test('unknown nested and top-level fields cannot pass through Meg context', () => {
  const cleaned = cleanMegContext({
    uid: 'another-user',
    token: 'secret',
    profile: { email: 'private@example.test' },
    todayCheckin: { mood: 'okay', journal: 'private journal body' },
  });

  assert.deepEqual(cleaned, { todayCheckin: { mood: 'okay' } });
  assert.equal(JSON.stringify(cleaned).includes('private'), false);
  assert.equal(JSON.stringify(cleaned).includes('secret'), false);
  assert.equal(JSON.stringify(cleaned).includes('another-user'), false);
});

test('every supported Meg mode cleans and builds its dedicated instruction', () => {
  assert.deepEqual(Object.keys(MEG_MODES), [
    'listen',
    'understand',
    'plan',
    'conversation',
    'doctor',
  ]);
  Object.keys(MEG_MODES).forEach((mode) => {
    assert.equal(cleanMegMode(mode), mode);
    assert.equal(buildModeInstruction(mode), MODE_INSTRUCTIONS[mode]);
    assert.ok(MODE_INSTRUCTIONS[mode].length > 20);
  });
});

test('invalid Meg modes are treated as absent', () => {
  for (const mode of [undefined, null, '', 'LISTEN', 'diagnose', 1, {}]) {
    assert.equal(cleanMegMode(mode), null);
    assert.equal(buildModeInstruction(mode), '');
  }
});
