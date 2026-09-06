const test = require('node:test');
const assert = require('node:assert/strict');
const { createMegV3Engine } = require('../src');
const { createTurnState, TurnInputError } = require('../src/core/turnState');
const { TurnPipeline, defineStage, TurnStageError } = require('../src/core/TurnPipeline');

const baseInput = {
  userId: 'user-1',
  conversationId: 'conversation-1',
  messageId: 'message-1',
  language: 'en',
};

test('turn state rejects missing required identity and message fields', () => {
  assert.throws(() => createTurnState({ conversationId: 'c', message: 'hello' }), TurnInputError);
  assert.throws(() => createTurnState({ userId: 'u', conversationId: 'c', message: '   ' }), TurnInputError);
});

test('listen mode becomes an emotional-presence response plan', async () => {
  const engine = createMegV3Engine({
    generator: async ({ plan }) => ({ text: `objective:${plan.objective}`, provider: 'test-provider' }),
  });
  const result = await engine.turn({
    ...baseInput,
    message: 'I feel overwhelmed and I just need someone to listen',
    supportMode: 'listen',
  });

  assert.equal(result.source, 'meg-v3');
  assert.equal(result.metadata.planObjective, 'emotional_presence');
  assert.equal(result.metadata.provider, 'test-provider');
  assert.equal(result.safety, null);
  assert.equal(result.metadata.stages.every((stage) => stage.ok), true);
});

test('plan mode explicitly constrains the response to a small realistic plan', async () => {
  const engine = createMegV3Engine({
    generator: async ({ plan }) => ({ text: plan.mustInclude.join(' | '), provider: 'test-provider' }),
  });
  const result = await engine.turn({
    ...baseInput,
    message: 'I could not follow anything today. What should I do now?',
    supportMode: 'plan',
  });

  assert.equal(result.metadata.planObjective, 'small_realistic_plan');
  assert.match(result.message, /one or two realistic next steps/i);
});

test('urgent self-harm safety bypasses the configured generator', async () => {
  let generatorCalls = 0;
  const engine = createMegV3Engine({
    generator: async () => {
      generatorCalls += 1;
      return 'this must never be used';
    },
  });
  const result = await engine.turn({
    ...baseInput,
    message: 'I want to kill myself',
    supportMode: 'listen',
  });

  assert.equal(generatorCalls, 0);
  assert.equal(result.safety, 'self_harm');
  assert.equal(result.urgent, true);
  assert.equal(result.metadata.provider, 'deterministic-safety');
  assert.match(result.message, /immediate/i);
});

test('health questions are planned as explanations and buffered for validation', async () => {
  const engine = createMegV3Engine({
    generator: async ({ plan }) => ({ text: `policy:${plan.streamingPolicy}`, provider: 'test-provider' }),
  });
  const result = await engine.turn({
    ...baseInput,
    message: 'Why has my cycle been irregular for the last three months?',
    supportMode: 'understand',
  });

  assert.equal(result.metadata.planObjective, 'explain_with_context');
  assert.match(result.message, /buffer_then_validate/);
});

test('optional stage failures are isolated and recorded', async () => {
  const state = createTurnState({ ...baseInput, message: 'hello' });
  const pipeline = new TurnPipeline([
    defineStage('optional_failure', async () => {
      const error = new Error('temporary');
      error.code = 'TEMPORARY';
      throw error;
    }, { optional: true }),
    defineStage('continues', async (current) => {
      current.response.text = 'ok';
      return current;
    }),
  ]);

  const result = await pipeline.run(state);
  assert.equal(result.response.text, 'ok');
  assert.deepEqual(result.trace.warnings, ['optional_failure:TEMPORARY']);
});

test('required stage failures identify the failed boundary', async () => {
  const state = createTurnState({ ...baseInput, message: 'hello' });
  const pipeline = new TurnPipeline([
    defineStage('required_failure', async () => {
      const error = new Error('failed');
      error.code = 'BROKEN';
      throw error;
    }),
  ]);

  await assert.rejects(() => pipeline.run(state), (error) => {
    assert.equal(error instanceof TurnStageError, true);
    assert.equal(error.stage, 'required_failure');
    assert.equal(error.code, 'BROKEN');
    return true;
  });
});

test('Bloom context is converted into typed evidence before generation', async () => {
  let receivedEvidence = null;
  const engine = createMegV3Engine({
    generator: async ({ evidence }) => {
      receivedEvidence = evidence;
      return { text: 'I can use the context carefully.', provider: 'test-provider' };
    },
  });

  await engine.turn({
    ...baseInput,
    message: 'Help me understand today',
    supportMode: 'understand',
    context: {
      cycleDay: 42,
      todayCheckin: { mood: 'overwhelmed', sleep: 5, pain: 6 },
      goals: ['feel more energetic'],
      derivedPattern: { label: 'sleep is often lower before difficult days', occurrences: 3, total: 5 },
    },
  });

  assert.ok(receivedEvidence.some((item) => item.kind === 'bloom_log' && item.key === 'cycle_day'));
  assert.ok(receivedEvidence.some((item) => item.kind === 'user_statement' && item.domain === 'goal'));
  const derived = receivedEvidence.find((item) => item.kind === 'derived_observation');
  assert.ok(derived);
  assert.ok(derived.confidence < 1);
  assert.match(derived.text, /not a diagnosis/i);
});

test('typed memory retrieval filters expired memories and ranks relevant confirmed memory', async () => {
  let receivedMemories = null;
  const memoryStore = {
    listMemories() {
      return [
        { id: '1', text: 'User prefers concise responses.', tags: ['communication', 'emotional'], confirmation: 'confirmed', confidence: 0.95, createdAt: new Date().toISOString() },
        { id: '2', text: 'User likes very long explanations.', tags: ['communication'], confirmation: 'inferred', confidence: 0.2, expiresAt: '2020-01-01T00:00:00.000Z' },
        { id: '3', text: 'User prefers vegetarian meal ideas.', tags: ['diet'], confirmation: 'stated', confidence: 0.9, createdAt: new Date().toISOString() },
      ];
    },
  };
  const engine = createMegV3Engine({
    memoryStore,
    generator: async ({ memories }) => {
      receivedMemories = memories;
      return { text: 'I hear you.', provider: 'test-provider' };
    },
  });

  await engine.turn({
    ...baseInput,
    message: 'I feel overwhelmed, please keep this concise',
    supportMode: 'listen',
  });

  assert.equal(receivedMemories.some((memory) => memory.id === '2'), false);
  assert.equal(receivedMemories[0].id, '1');
  assert.equal(receivedMemories[0].confirmation, 'confirmed');
});
