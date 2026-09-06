const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mapBloomContext,
  isMegV3ShadowEnabled,
  evaluateMegV3Shadow,
  megV3ShadowTelemetry,
} = require('./megV2Bridge');

test('Meg v3 shadow mode consumes Bloom-safe mapped context and selects an intervention', () => {
  const context = mapBloomContext({
    cycleDay: 39,
    todayCheckin: {
      mood: 'sad',
      stress: 8,
      sleep: 6,
      pain: 2,
      symptoms: ['bloating'],
    },
    currentPhase: 'extended pattern phase',
    unrelatedPrivateField: 'must not pass through',
  });
  const shadow = evaluateMegV3Shadow({
    message: 'I am overwhelmed and I just need to vent, please just listen',
    context,
    history: [],
  });

  assert.ok(shadow);
  assert.equal(shadow.decision.intervention.selected.family, 'active_listening');
  assert.equal(shadow.decision.state.risk.level, 'low');
  assert.equal(Object.hasOwn(context, 'unrelatedPrivateField'), false);
});

test('shadow telemetry exposes decisions but never raw message or health context', () => {
  const secretPhrase = 'this raw sentence must never be logged';
  const shadow = evaluateMegV3Shadow({
    message: `${secretPhrase}; I feel anxious and overwhelmed`,
    context: { mood: 'anxious', stress: 8, sleepHours: 7 },
  });
  const telemetry = megV3ShadowTelemetry(shadow, 'trace-test');
  const serialized = JSON.stringify(telemetry);

  assert.equal(telemetry.event, 'meg_v3_shadow_decision');
  assert.equal(telemetry.traceId, 'trace-test');
  assert.ok(telemetry.interventionFamily);
  assert.ok(Array.isArray(telemetry.needs));
  assert.equal(serialized.includes(secretPhrase), false);
  assert.equal(Object.hasOwn(telemetry, 'message'), false);
  assert.equal(Object.hasOwn(telemetry, 'context'), false);
});

test('Meg v3 shadow mode can be explicitly disabled', () => {
  assert.equal(isMegV3ShadowEnabled({ MEG_V3_SHADOW_ENABLED: 'false' }), false);
  assert.equal(isMegV3ShadowEnabled({ MEG_V3_SHADOW_ENABLED: 'TRUE' }), true);
  assert.equal(isMegV3ShadowEnabled({}), true);
});
