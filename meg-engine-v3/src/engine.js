const { estimateState } = require('./state/stateEstimator');
const { chooseIntervention } = require('./interventions/interventionPolicy');
const { createOutcomeEvent, buildInterventionPreferenceProfile } = require('./adaptation/outcomeModel');

function evaluateTurn({
  message = '',
  context = {},
  intent = 'casual',
  recentMessages = [],
  memories = [],
  outcomeEvents = [],
  now = new Date(),
} = {}) {
  const state = estimateState({ message, context, recentMessages, memories, now });
  const preferenceProfile = buildInterventionPreferenceProfile(outcomeEvents);
  const intervention = chooseIntervention({ state, intent, message, preferenceProfile });

  return {
    version: 'meg-adaptive-engine-v3.0',
    state,
    preferenceProfile,
    intervention,
    promptContext: buildPromptContext({ state, intervention: intervention.selected }),
  };
}

function buildPromptContext({ state, intervention } = {}) {
  if (!state || !intervention) return '';
  const evidence = (state.evidence || []).slice(0, 8).join(', ') || 'limited current evidence';
  const actions = (intervention.actions || []).map((item) => `- ${item}`).join('\n');
  const constraints = (intervention.responseConstraints || []).map((item) => `- ${item}`).join('\n');
  return [
    '[MEG V3 DECISION]',
    `Current needs: ${(state.needs || []).join(', ') || 'conversation'}`,
    `Risk level: ${state.risk?.level || 'low'}`,
    `State confidence: ${Number(state.confidence || 0).toFixed(2)}`,
    `Evidence: ${evidence}`,
    `Selected intervention: ${intervention.family}`,
    `Goal: ${intervention.goal}`,
    `Stance: ${intervention.stance}`,
    'Actions:',
    actions || '- Respond naturally.',
    'Constraints:',
    constraints || '- Stay within Bloom safety boundaries.',
    '[END MEG V3 DECISION]',
  ].join('\n');
}

function recordOutcome({ intervention, outcome, at, note } = {}) {
  return createOutcomeEvent({ intervention, outcome, at, note });
}

module.exports = {
  evaluateTurn,
  buildPromptContext,
  recordOutcome,
};
