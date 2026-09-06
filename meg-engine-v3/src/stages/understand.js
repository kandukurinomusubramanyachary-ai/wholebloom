const { detectSafety } = require('../../../meg-engine-v2/src/safety/safetyRouter');
const { classifyIntentDetailed } = require('../../../meg-engine-v2/src/router/intentRouter');
const { routeRequest } = require('../../../meg-engine-v2/src/router/modelRouter');
const { defineStage } = require('../core/TurnPipeline');

function routeModeForSupportMode(supportMode, requestedMode = 'auto') {
  const value = String(supportMode || '').trim().toLowerCase();
  if (value === 'doctor') return 'doctor';
  if (['understand', 'plan', 'conversation'].includes(value)) return 'smart';
  if (value === 'listen') return 'auto';
  return requestedMode || 'auto';
}

function createUnderstandStage({ providerOrders } = {}) {
  return defineStage('understand', async (state) => {
    const safety = detectSafety(state.request.message);
    const intent = classifyIntentDetailed({ message: state.request.message, safety });
    const routing = routeRequest({
      message: state.request.message,
      mode: routeModeForSupportMode(state.request.supportMode, state.request.mode),
      safety,
      intentDetails: intent,
      providerOrders,
    });

    state.understanding = {
      safety,
      intent: routing.intent,
      complexity: routing.complexity,
      confidence: routing.confidence,
      route: routing.route,
      preferredProviders: routing.preferredProviders,
      reasons: routing.reasons,
    };
    return state;
  });
}

module.exports = { createUnderstandStage, routeModeForSupportMode };
