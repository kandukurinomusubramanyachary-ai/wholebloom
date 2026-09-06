const { safetyFallback, isUrgentCategory } = require('../../../meg-engine-v2/src/safety/safetyRouter');
const { defineStage } = require('../core/TurnPipeline');

function normalizeGenerated(result) {
  if (typeof result === 'string') return { text: result, provider: null };
  if (result && typeof result.text === 'string') {
    return { text: result.text, provider: result.provider || null };
  }
  return { text: '', provider: null };
}

function createGenerateStage({ generator } = {}) {
  return defineStage('generate', async (state, runtime = {}) => {
    const safety = state.understanding.safety || {};
    if (safety.triggered && isUrgentCategory(safety.category)) {
      state.response.text = safetyFallback(safety.category);
      state.response.provider = 'deterministic-safety';
      return state;
    }

    const activeGenerator = runtime.generator || generator;
    if (typeof activeGenerator !== 'function') {
      const error = new Error('No Meg V3 generator is configured.');
      error.code = 'GENERATOR_REQUIRED';
      throw error;
    }

    const generated = normalizeGenerated(await activeGenerator({
      request: state.request,
      context: state.context,
      history: state.history,
      understanding: state.understanding,
      plan: state.plan,
      signal: runtime.signal,
    }));
    if (!generated.text.trim()) {
      const error = new Error('The configured generator returned an empty response.');
      error.code = 'EMPTY_RESPONSE';
      throw error;
    }

    state.response.text = generated.text.trim();
    state.response.provider = generated.provider;
    return state;
  });
}

module.exports = { createGenerateStage, normalizeGenerated };
