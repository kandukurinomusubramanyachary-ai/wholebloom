const { defineStage } = require('../core/TurnPipeline');

const SUPPORT_PLANS = Object.freeze({
  listen: {
    objective: 'emotional_presence',
    tone: ['warm', 'grounded', 'non-judgmental'],
    maxQuestions: 1,
    mustInclude: ['acknowledge the feeling before advice'],
    mustAvoid: ['unsolicited fixing', 'forced positivity', 'clinical overload'],
  },
  understand: {
    objective: 'explain_with_context',
    tone: ['warm', 'clear', 'calm'],
    maxQuestions: 1,
    mustInclude: ['separate logged facts from possibilities', 'use plain language'],
    mustAvoid: ['diagnosis claims', 'false certainty'],
  },
  plan: {
    objective: 'small_realistic_plan',
    tone: ['encouraging', 'practical', 'gentle'],
    maxQuestions: 1,
    mustInclude: ['give one or two realistic next steps'],
    mustAvoid: ['long checklists', 'perfection framing'],
  },
  conversation: {
    objective: 'prepare_real_world_words',
    tone: ['natural', 'calm', 'supportive'],
    maxQuestions: 1,
    mustInclude: ['give usable wording when enough context exists'],
    mustAvoid: ['manipulative scripts', 'overexplaining'],
  },
  doctor: {
    objective: 'doctor_preparation',
    tone: ['clear', 'organized', 'reassuring'],
    maxQuestions: 1,
    mustInclude: ['organize relevant observations', 'suggest useful questions for the clinician'],
    mustAvoid: ['diagnosing', 'changing prescribed treatment'],
  },
});

function planFromIntent(intent) {
  if (intent === 'emotional') return SUPPORT_PLANS.listen;
  if (intent === 'doctor_prep') return SUPPORT_PLANS.doctor;
  if (['simple_health', 'complex_health', 'cycle_question', 'diet_question', 'symptom_question', 'activity_question'].includes(intent)) {
    return SUPPORT_PLANS.understand;
  }
  return {
    objective: 'natural_conversation',
    tone: ['warm', 'concise', 'human'],
    maxQuestions: 1,
    mustInclude: [],
    mustAvoid: ['robotic filler'],
  };
}

function createResponsePlannerStage() {
  return defineStage('plan_response', async (state) => {
    const safety = state.understanding.safety || {};
    if (safety.triggered) {
      state.plan = {
        objective: 'safety_first',
        tone: ['calm', 'direct', 'supportive'],
        maxQuestions: safety.category === 'self_harm' ? 1 : 0,
        mustInclude: [safety.behavior || 'follow the applicable safety boundary'],
        mustAvoid: ['diagnosis', 'reassurance that dismisses risk', 'delaying appropriate care'],
        streamingPolicy: 'buffer_then_validate',
        rationale: [`safety:${safety.category}`],
      };
      return state;
    }

    const requested = String(state.request.supportMode || '').trim().toLowerCase();
    const base = SUPPORT_PLANS[requested] || planFromIntent(state.understanding.intent);
    const highStakes = ['doctor_prep', 'complex_health', 'cycle_question'].includes(state.understanding.intent);

    state.plan = {
      ...base,
      tone: [...base.tone],
      mustInclude: [...base.mustInclude],
      mustAvoid: [...base.mustAvoid],
      streamingPolicy: highStakes ? 'buffer_then_validate' : 'stream_after_prefix_guard',
      contextPolicy: {
        useOnlySuppliedOrRetrievedFacts: true,
        distinguishTrackedFromDerived: true,
        preferRecentRelevantContext: true,
      },
      rationale: [
        `intent:${state.understanding.intent}`,
        `route:${state.understanding.route}`,
        requested ? `support_mode:${requested}` : 'support_mode:auto',
      ],
    };
    return state;
  });
}

module.exports = { SUPPORT_PLANS, planFromIntent, createResponsePlannerStage };
