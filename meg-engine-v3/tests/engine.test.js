const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateTurn, recordOutcome } = require('../src/engine');
const { buildInterventionPreferenceProfile } = require('../src/adaptation/outcomeModel');

const fixedNow = new Date('2026-09-06T05:30:00.000Z');

test('explicit venting selects listening before advice', () => {
  const result = evaluateTurn({
    message: 'I am overwhelmed and I just need to vent, please just listen',
    context: { mood: 'sad', stress: 8, sleepHours: 6 },
    intent: 'emotional',
    now: fixedNow,
  });
  assert.equal(result.intervention.selected.family, 'active_listening');
  assert.ok(result.state.needs.includes('listen'));
  assert.ok(result.state.emotional.score >= 0.5);
});

test('low sleep can drive recovery-first support', () => {
  const result = evaluateTurn({
    message: 'I feel tired and stressed today',
    context: { mood: 'tired', stress: 6, sleepHours: 3.5 },
    intent: 'emotional',
    now: fixedNow,
  });
  assert.ok(result.state.needs.includes('recovery'));
  assert.equal(result.state.recovery.signals[0], 'very_low_sleep');
  assert.ok(['recovery_support', 'emotional_regulation'].includes(result.intervention.selected.family));
});

test('severe symptoms outrank movement coaching', () => {
  const result = evaluateTurn({
    message: 'Should I workout today?',
    context: { symptoms: ['pain 9/10'], sleepHours: 7, activity: 'no movement logged today' },
    intent: 'activity_question',
    now: fixedNow,
  });
  assert.equal(result.state.risk.level, 'elevated');
  assert.equal(result.intervention.selected.family, 'symptom_triage');
});

test('crisis language always forces safety override', () => {
  const result = evaluateTurn({
    message: 'I want to kill myself',
    context: {},
    intent: 'emotional',
    now: fixedNow,
  });
  assert.equal(result.state.risk.level, 'urgent');
  assert.equal(result.intervention.selected.family, 'safety_escalation');
  assert.equal(result.intervention.selected.requiresSafetyOverride, true);
});

test('cycle uncertainty produces cycle-understanding intervention', () => {
  const result = evaluateTurn({
    message: 'My period is late again and my cycles are irregular, what could this mean?',
    context: { cycleDay: 42, cycleVariability: 16, symptoms: ['bloating'] },
    intent: 'cycle_question',
    now: fixedNow,
  });
  assert.equal(result.intervention.selected.family, 'cycle_understanding');
  assert.ok(result.state.cycle.uncertainty >= 0.8);
});

test('outcomes create a reusable intervention preference profile', () => {
  const intervention = { id: 'listen-first-v1', family: 'active_listening' };
  const events = [
    recordOutcome({ intervention, outcome: 'helped', at: fixedNow }),
    recordOutcome({ intervention, outcome: 'helped', at: fixedNow }),
    recordOutcome({ intervention, outcome: 'partly_helped', at: fixedNow }),
  ];
  const profile = buildInterventionPreferenceProfile(events);
  assert.equal(profile.families.active_listening.count, 3);
  assert.ok(profile.families.active_listening.adjustment > 0);
  assert.equal(profile.families.active_listening.preferred, true);
});

test('bad outcomes reduce future score without overriding safety', () => {
  const intervention = { id: 'emotional-regulation-v1', family: 'emotional_regulation' };
  const outcomeEvents = [
    recordOutcome({ intervention, outcome: 'worse', at: fixedNow }),
    recordOutcome({ intervention, outcome: 'worse', at: fixedNow }),
  ];
  const result = evaluateTurn({
    message: 'I feel overwhelmed and anxious',
    context: { stress: 7, sleepHours: 5.5 },
    intent: 'emotional',
    outcomeEvents,
    now: fixedNow,
  });
  const emotional = result.intervention.candidates.find((item) => item.family === 'emotional_regulation');
  assert.ok(emotional.adaptiveAdjustment < 0);
});
