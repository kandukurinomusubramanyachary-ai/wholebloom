const { buildV3Prompt } = require('../prompts/composer');

function temperatureForPlan(plan = {}, route = 'FAST') {
  if (route === 'DOCTOR' || route === 'SAFETY') return 0.35;
  if (['explain_with_context', 'doctor_preparation'].includes(plan.objective)) return 0.42;
  if (plan.objective === 'emotional_presence') return 0.68;
  return 0.55;
}

function createProviderGenerator({
  providerManager,
  tokenBudget = 4800,
  maxOutputTokens = 900,
  promptVersion = 'meg-v3-prompt-alpha.1',
} = {}) {
  if (!providerManager || typeof providerManager.stream !== 'function') {
    throw new TypeError('Meg V3 provider generator requires a ProviderManager-compatible stream().');
  }

  return async function providerGenerator(payload = {}) {
    const understanding = payload.understanding || {};
    const route = understanding.route || 'FAST';
    const messages = buildV3Prompt({
      ...payload,
      tokenBudget,
      promptVersion,
    });
    const providerState = {};
    let text = '';

    for await (const token of providerManager.stream({
      providerNames: understanding.preferredProviders || [],
      route,
      messages,
      temperature: temperatureForPlan(payload.plan, route),
      maxTokens: maxOutputTokens,
      signal: payload.signal,
    }, providerState)) {
      text += token;
    }

    return {
      text,
      provider: providerState.provider || null,
      meta: {
        route,
        retries: providerState.retries || 0,
        fallbacks: providerState.fallbacks || 0,
        providerConnectMs: providerState.providerConnectMs || null,
        providerLatencyMs: providerState.providerLatencyMs || null,
        promptVersion,
      },
    };
  };
}

module.exports = { createProviderGenerator, temperatureForPlan };
