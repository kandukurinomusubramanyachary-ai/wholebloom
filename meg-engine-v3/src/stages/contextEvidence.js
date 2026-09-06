const { defineStage } = require('../core/TurnPipeline');

const EVIDENCE_KINDS = Object.freeze({
  USER_STATEMENT: 'user_statement',
  BLOOM_LOG: 'bloom_log',
  DERIVED_OBSERVATION: 'derived_observation',
});

function compactText(value, max = 180) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function boundedNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function makeEvidence({ kind, domain, key, text, value = null, confidence = 1, source = 'bloom_context' }) {
  const clean = compactText(text);
  if (!clean) return null;
  return {
    kind,
    domain,
    key,
    text: clean,
    value,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    source,
  };
}

function buildContextEvidence(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return [];
  const items = [];
  const add = (item) => { if (item) items.push(item); };

  const cycleDay = boundedNumber(context.cycleDay, 1, 500);
  if (cycleDay !== null) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'cycle', key: 'cycle_day',
    text: `Cycle day ${cycleDay}`, value: cycleDay,
  }));

  const averageCycleLength = boundedNumber(context.averageCycleLength, 10, 120);
  if (averageCycleLength !== null) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'cycle', key: 'average_cycle_length',
    text: `Recent average cycle length: ${averageCycleLength} days`, value: averageCycleLength,
  }));

  const phase = compactText(context.currentPhase, 60);
  if (phase) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'cycle', key: 'current_phase',
    text: `Current tracked phase: ${phase}`, value: phase,
  }));

  const checkin = context.todayCheckin && typeof context.todayCheckin === 'object' && !Array.isArray(context.todayCheckin)
    ? context.todayCheckin
    : context;
  const mood = compactText(checkin.mood, 60);
  if (mood) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'wellbeing', key: 'mood',
    text: `Recent mood log: ${mood}`, value: mood,
  }));

  const sleep = boundedNumber(checkin.sleep ?? checkin.sleepHours, 0, 24);
  if (sleep !== null) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'sleep', key: 'sleep_hours',
    text: `Recent sleep log: ${sleep} hours`, value: sleep,
  }));

  const stress = boundedNumber(checkin.stress, 0, 10);
  if (stress !== null) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'wellbeing', key: 'stress',
    text: `Recent stress log: ${stress}/10`, value: stress,
  }));

  const energy = boundedNumber(checkin.energy, 0, 10);
  if (energy !== null) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'wellbeing', key: 'energy',
    text: `Recent energy log: ${energy}/10`, value: energy,
  }));

  const pain = boundedNumber(checkin.pain, 0, 10);
  if (pain !== null) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'symptom', key: 'pain',
    text: `Recent pain log: ${pain}/10`, value: pain,
  }));

  const flow = compactText(checkin.flow, 30);
  if (flow && flow !== 'none') add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'cycle', key: 'flow',
    text: `Recent bleeding log: ${flow}`, value: flow,
  }));

  const symptoms = Array.isArray(checkin.symptoms) ? checkin.symptoms : Array.isArray(context.symptoms) ? context.symptoms : [];
  for (const symptom of symptoms.slice(0, 12)) {
    const clean = compactText(symptom, 60);
    if (clean) add(makeEvidence({
      kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'symptom', key: 'symptom',
      text: `Recent symptom log: ${clean}`, value: clean,
    }));
  }

  const mealsLogged = boundedNumber(context.mealsLogged, 0, 20);
  if (mealsLogged !== null) add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'nutrition', key: 'meals_logged',
    text: `${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} logged today`, value: mealsLogged,
  }));

  if (typeof context.movementLogged === 'boolean') add(makeEvidence({
    kind: EVIDENCE_KINDS.BLOOM_LOG, domain: 'activity', key: 'movement_logged',
    text: context.movementLogged ? 'Movement was logged today' : 'No movement was logged today',
    value: context.movementLogged,
  }));

  if (Array.isArray(context.goals)) {
    for (const goal of context.goals.slice(0, 10)) {
      const clean = compactText(goal, 80);
      if (clean) add(makeEvidence({
        kind: EVIDENCE_KINDS.USER_STATEMENT, domain: 'goal', key: 'goal',
        text: `User-stated goal: ${clean}`, value: clean, source: 'bloom_profile',
      }));
    }
  }

  const derived = [
    ...(context.derivedPattern ? [context.derivedPattern] : []),
    ...(Array.isArray(context.derivedPatterns) ? context.derivedPatterns : []),
  ];
  for (const pattern of derived.slice(0, 6)) {
    if (!pattern || typeof pattern !== 'object') continue;
    const label = compactText(pattern.label, 100);
    const occurrences = boundedNumber(pattern.occurrences, 0, 1000);
    const total = boundedNumber(pattern.total, 1, 1000);
    if (!label) continue;
    const suffix = occurrences !== null && total !== null ? ` (${occurrences} of ${total} recent logs)` : '';
    add(makeEvidence({
      kind: EVIDENCE_KINDS.DERIVED_OBSERVATION, domain: 'pattern', key: 'derived_pattern',
      text: `Bloom-derived observation: ${label}${suffix}. This is an observation, not a diagnosis.`,
      value: { label, occurrences, total }, confidence: 0.6, source: 'bloom_derived',
    }));
  }

  return items;
}

function createContextEvidenceStage() {
  return defineStage('context_evidence', async (state) => {
    state.evidence = buildContextEvidence(state.context);
    return state;
  });
}

module.exports = { EVIDENCE_KINDS, buildContextEvidence, createContextEvidenceStage, makeEvidence };
