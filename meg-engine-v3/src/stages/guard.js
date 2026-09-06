const { guardResponse } = require('../../../meg-engine-v2/src/guards/responseGuard');
const { safetyFallback } = require('../../../meg-engine-v2/src/safety/safetyRouter');
const { defineStage } = require('../core/TurnPipeline');

function createGuardStage({ maxChars = 7000 } = {}) {
  return defineStage('guard_response', async (state) => {
    const safety = state.understanding.safety || {};
    const guarded = guardResponse(state.response.text, {
      maxChars,
      safety: Boolean(safety.triggered),
      safetyCategory: safety.category,
    });

    if (!guarded.ok) {
      if (safety.triggered) {
        state.response.text = safetyFallback(safety.category || 'diagnosis_request');
        state.response.provider = 'deterministic-safety';
        state.response.guarded = true;
        state.trace.warnings.push(`response_replaced:${guarded.reason || 'guard_failed'}`);
        return state;
      }
      const error = new Error('Meg V3 response failed the output guard.');
      error.code = 'RESPONSE_GUARD_FAILED';
      error.reason = guarded.reason || null;
      throw error;
    }

    state.response.text = guarded.text;
    state.response.guarded = true;
    return state;
  });
}

module.exports = { createGuardStage };
