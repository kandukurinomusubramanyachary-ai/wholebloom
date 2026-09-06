class TurnStageError extends Error {
  constructor(stage, cause) {
    super(`Meg V3 stage failed: ${stage}`);
    this.name = 'TurnStageError';
    this.stage = stage;
    this.cause = cause;
    this.code = cause?.code || 'STAGE_FAILED';
  }
}

class TurnPipeline {
  constructor(stages = [], { now = () => Date.now() } = {}) {
    this.stages = stages.filter(Boolean);
    this.now = now;
  }

  async run(initialState, runtime = {}) {
    let state = initialState;
    for (const stage of this.stages) {
      if (runtime.signal?.aborted) {
        const error = new Error('request cancelled');
        error.code = 'CLIENT_ABORT';
        throw new TurnStageError(stage.name || 'unknown', error);
      }

      const name = stage.name || 'anonymous';
      const startedAt = this.now();
      try {
        const next = await stage.run(state, runtime);
        if (next) state = next;
        state.trace.stages.push({
          name,
          ok: true,
          durationMs: Math.max(0, this.now() - startedAt),
        });
      } catch (error) {
        state.trace.stages.push({
          name,
          ok: false,
          durationMs: Math.max(0, this.now() - startedAt),
          code: error?.code || error?.name || 'STAGE_FAILED',
        });

        if (stage.optional) {
          state.trace.warnings.push(`${name}:${error?.code || error?.name || 'failed'}`);
          continue;
        }
        throw new TurnStageError(name, error);
      }
    }
    state.trace.completedAt = this.now();
    state.trace.totalMs = Math.max(0, state.trace.completedAt - state.trace.startedAt);
    return state;
  }
}

function defineStage(name, run, { optional = false } = {}) {
  if (!name || typeof run !== 'function') throw new TypeError('A stage needs a name and run function.');
  return { name, run, optional };
}

module.exports = { TurnPipeline, TurnStageError, defineStage };
