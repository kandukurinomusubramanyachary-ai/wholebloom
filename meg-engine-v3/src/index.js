const { createTurnState } = require('./core/turnState');
const { TurnPipeline } = require('./core/TurnPipeline');
const { createUnderstandStage } = require('./stages/understand');
const { createResponsePlannerStage } = require('./strategy/responsePlanner');
const { createGenerateStage } = require('./stages/generate');
const { createGuardStage } = require('./stages/guard');
const { isUrgentCategory } = require('../../meg-engine-v2/src/safety/safetyRouter');

const ENGINE_VERSION = '0.3.0-alpha.1';

function createMegV3Engine({
  generator,
  providerOrders,
  maxResponseChars = 7000,
  beforeGenerate = [],
  afterGenerate = [],
  now,
} = {}) {
  const pipeline = new TurnPipeline([
    createUnderstandStage({ providerOrders }),
    createResponsePlannerStage(),
    ...beforeGenerate,
    createGenerateStage({ generator }),
    ...afterGenerate,
    createGuardStage({ maxChars: maxResponseChars }),
  ], { now });

  return {
    version: ENGINE_VERSION,
    pipeline,
    async turn(input, runtime = {}) {
      const state = createTurnState(input);
      const completed = await pipeline.run(state, runtime);
      const safety = completed.understanding.safety || {};
      return {
        message: completed.response.text,
        conversationId: completed.request.conversationId,
        messageId: completed.request.messageId,
        source: 'meg-v3',
        safety: safety.triggered ? safety.category : null,
        urgent: Boolean(safety.triggered && isUrgentCategory(safety.category)),
        engineVersion: ENGINE_VERSION,
        metadata: {
          intent: completed.understanding.intent,
          complexity: completed.understanding.complexity,
          confidence: completed.understanding.confidence,
          route: completed.understanding.route,
          provider: completed.response.provider,
          planObjective: completed.plan?.objective || null,
          totalMs: completed.trace.totalMs,
          stages: completed.trace.stages,
          warnings: completed.trace.warnings,
        },
        state: completed,
      };
    },
  };
}

module.exports = { createMegV3Engine, ENGINE_VERSION };
