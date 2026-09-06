const { familyAdjustment } = require('../adaptation/outcomeModel');

function candidate(id, family, score, goal, stance, actions, responseConstraints = []) {
  return { id, family, score, goal, stance, actions, responseConstraints };
}

function baseCandidates({ state, intent = 'casual', message = '' } = {}) {
  const list = [];
  const needs = new Set(state?.needs || []);
  const emotional = Number(state?.emotional?.score) || 0;
  const recovery = Number(state?.recovery?.strain) || 0;
  const physical = Number(state?.physical?.score) || 0;
  const cycleUncertainty = Number(state?.cycle?.uncertainty) || 0;

  if (state?.risk?.level === 'urgent') {
    return [candidate(
      'safety-escalation-v1',
      'safety_escalation',
      1,
      'Keep the user safe and route to the existing Meg safety response path.',
      'calm, direct, non-judgmental',
      ['Do not continue normal coaching.', 'Use the existing deterministic safety router.', 'Encourage immediate real-world support when appropriate.'],
      ['No diagnosis.', 'No persuasion to remain in chat instead of seeking help.'],
    )];
  }

  if (needs.has('listen')) {
    list.push(candidate(
      'listen-first-v1',
      'active_listening',
      0.92,
      'Help the user feel heard before trying to solve anything.',
      'warm, brief, reflective',
      ['Reflect the core feeling.', 'Ask at most one gentle question.', 'Do not give unsolicited advice.'],
      ['Keep it short.', 'Do not over-explain.'],
    ));
  }

  if (emotional >= 0.5 || intent === 'emotional') {
    list.push(candidate(
      'emotional-regulation-v1',
      'emotional_regulation',
      0.62 + emotional * 0.26,
      'Reduce immediate emotional load without dismissing the user.',
      'grounded, validating, low-pressure',
      ['Acknowledge the feeling.', 'Offer one small next step only if welcome.', 'Preserve the user’s agency.'],
      ['Avoid therapy-like claims.', 'Avoid generic motivational speeches.'],
    ));
  }

  if (physical >= 0.6 || needs.has('symptom_clarification')) {
    list.push(candidate(
      'symptom-triage-v1',
      'symptom_triage',
      0.7 + physical * 0.22,
      'Clarify symptom severity and identify whether medical attention may be appropriate.',
      'clear, cautious, non-alarming',
      ['Ask only the minimum useful clarifying question.', 'Mention red flags only when relevant.', 'Separate observation from diagnosis.'],
      ['Do not diagnose PCOS or another condition.', 'Do not prescribe medication.'],
    ));
  }

  if (recovery >= 0.65 && physical < 0.8) {
    list.push(candidate(
      'recovery-first-v1',
      'recovery_support',
      0.58 + recovery * 0.24,
      'Lower physiological load and make the next action easier.',
      'gentle, practical, permission-giving',
      ['Prioritize rest, hydration, food, or reducing task intensity.', 'Offer one achievable action.'],
      ['Do not frame rest as failure.', 'Do not push exercise when pain or exhaustion is high.'],
    ));
  }

  if (needs.has('cycle_understanding') || intent === 'cycle_question') {
    list.push(candidate(
      'cycle-understanding-v1',
      'cycle_understanding',
      0.6 + cycleUncertainty * 0.25,
      'Explain what the tracked pattern may mean while preserving uncertainty.',
      'educational, calm, specific',
      ['Use the user’s actual tracked signals.', 'State uncertainty explicitly.', 'Suggest what to track next.'],
      ['No deterministic period-date claims for irregular cycles.', 'No diagnosis.'],
    ));
  }

  if (needs.has('nutrition_support') || intent === 'diet_question') {
    list.push(candidate(
      'nutrition-support-v1',
      'nutrition_support',
      0.62,
      'Offer a realistic nutrition action matched to the current context.',
      'practical, shame-free, flexible',
      ['Prefer substitutions and additions over restriction.', 'Account for cravings, stress, and sleep when available.'],
      ['Avoid moralizing food.', 'Avoid rigid calorie or weight-loss prescriptions.'],
    ));
  }

  if (needs.has('movement_support') || intent === 'activity_question') {
    const score = physical >= 0.6 || recovery >= 0.8 ? 0.38 : 0.62;
    list.push(candidate(
      'movement-support-v1',
      'movement_support',
      score,
      'Help the user choose movement that matches today’s capacity.',
      'encouraging, low-pressure, specific',
      ['Prefer gentle movement when recovery is strained.', 'Respect pain and symptom context.', 'Offer a small starting dose.'],
      ['Do not push through significant pain.', 'Do not imply exercise is a cure.'],
    ));
  }

  if (needs.has('doctor_prep') || intent === 'doctor_prep') {
    list.push(candidate(
      'doctor-prep-v1',
      'doctor_prep',
      0.88,
      'Turn the user’s tracked information into useful questions and observations for a clinician.',
      'organized, factual, concise',
      ['Separate observations, questions, and timeline.', 'Highlight uncertainty and notable changes.'],
      ['Do not interpret lab values beyond safe general education.', 'Do not replace clinical care.'],
    ));
  }

  if (!list.length || intent === 'casual') {
    list.push(candidate(
      'conversation-v1',
      'conversation',
      0.45,
      'Understand what the user needs from Meg right now.',
      'natural, warm, curious',
      ['Respond naturally.', 'Ask one useful question only when needed.'],
      ['Do not force health advice into a casual conversation.'],
    ));
  }

  return list;
}

function chooseIntervention({ state, intent = 'casual', message = '', preferenceProfile = null } = {}) {
  const candidates = baseCandidates({ state, intent, message }).map((item) => {
    if (item.family === 'safety_escalation') return { ...item, adaptiveAdjustment: 0, finalScore: 1 };
    const adaptiveAdjustment = familyAdjustment(preferenceProfile, item.family);
    const finalScore = Math.max(0, Math.min(1, item.score + adaptiveAdjustment));
    return { ...item, adaptiveAdjustment, finalScore };
  });

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  const selected = candidates[0];
  return {
    version: 'meg-intervention-policy-v3.0',
    selected: {
      ...selected,
      requiresSafetyOverride: selected.family === 'safety_escalation',
      rationale: {
        needs: state?.needs || [],
        evidence: state?.evidence || [],
        risk: state?.risk || { level: 'low', flags: [] },
      },
    },
    candidates: candidates.map(({ id, family, score, adaptiveAdjustment, finalScore }) => ({ id, family, score, adaptiveAdjustment, finalScore })),
  };
}

module.exports = { chooseIntervention, baseCandidates };
