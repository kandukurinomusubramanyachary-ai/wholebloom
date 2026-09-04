const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { createApp } = require('./index');
const {
  createMegV2Bridge,
  buildMegV2Environment,
  mapBloomContext,
  routeModeForSupportMode,
} = require('./megV2Bridge');
const { InMemoryBackend } = require('../meg-engine-v2/src/memory/memoryStore');

const silentLogger = { info() {}, warn() {}, error() {} };

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('Bloom context maps into the Meg V2 allowlist without leaking unrelated fields', () => {
  const mapped = mapBloomContext({
    cycleDay: 42,
    currentPhase: 'Extended pattern phase',
    averageCycleLength: 37,
    todayCheckin: {
      mood: 'anxious',
      sleep: 5,
      pain: 6,
      flow: 'light',
      journal: 'private journal text',
    },
    mealsLogged: 2,
    movementLogged: true,
    goals: ['understand my cycle'],
    email: 'private@example.test',
  });

  assert.equal(mapped.cycleDay, 42);
  assert.equal(mapped.mood, 'anxious');
  assert.equal(mapped.sleepHours, 5);
  assert.deepEqual(mapped.symptoms, ['pain 6/10', 'light bleeding']);
  assert.equal(mapped.activity, 'movement logged today');
  assert.deepEqual(mapped.goals, ['understand my cycle']);
  assert.doesNotMatch(JSON.stringify(mapped), /private journal|private@example|email|journal/i);
});

test('Bloom support modes choose sensible V2 routing without exposing provider selection to the client', () => {
  assert.equal(routeModeForSupportMode('listen'), 'auto');
  assert.equal(routeModeForSupportMode('understand'), 'smart');
  assert.equal(routeModeForSupportMode('plan'), 'smart');
  assert.equal(routeModeForSupportMode('conversation'), 'smart');
  assert.equal(routeModeForSupportMode('doctor'), 'doctor');
  assert.equal(routeModeForSupportMode('unknown'), 'auto');
});

test('Meg V2 requires explicitly configured durable storage in production', () => {
  assert.throws(
    () => buildMegV2Environment({ NODE_ENV: 'production' }),
    /MEG_V2_DATA_DIR is required in production/
  );

  const environment = buildMegV2Environment({
    NODE_ENV: 'production',
    MEG_V2_DATA_DIR: '/var/lib/bloom/meg-v2',
  });
  assert.equal(environment.DATA_DIR, '/var/lib/bloom/meg-v2');
});

test('Meg V2 bridge runs the real V2 prompt/routing pipeline with Bloom support mode and history', async () => {
  const calls = [];
  const providerManager = {
    status() { return { fake: { configured: true, state: 'CLOSED' } }; },
    async *stream(request, state) {
      calls.push(request);
      state.provider = 'fake';
      yield 'Meg V2 is connected.';
    },
  };
  const store = new InMemoryBackend();
  const bridge = createMegV2Bridge({
    environment: { NODE_ENV: 'test' },
    engineOverrides: { providerManager, store },
  });

  const result = await bridge.chat({
    uid: 'verified-user',
    body: {
      message: 'I feel overwhelmed today',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      mode: 'listen',
      language: 'en',
      context: { cycleDay: 42, todayCheckin: { mood: 'overwhelmed', sleep: 5 } },
      history: [{ role: 'assistant', content: 'I am here.' }],
      uid: 'attacker-user',
    },
  });

  assert.equal(result.message, 'Meg V2 is connected.');
  assert.equal(result.source, 'meg-v2');
  assert.equal(calls.length, 1);
  const systemPrompt = calls[0].messages[0].content;
  assert.match(systemPrompt, /explicitly chose “Just listen”/i);
  assert.match(systemPrompt, /cycleDay: 42/i);
  assert.match(systemPrompt, /I am here\./);
  assert.equal(store.messages.some((item) => item.userId === 'attacker-user'), false);
  assert.equal(store.messages.some((item) => item.userId === 'verified-user'), true);
});

test('Bloom HTTP route derives user identity only from Firebase and returns Meg V2 JSON contract', async () => {
  const calls = [];
  const bridge = {
    health() { return { engineVersion: 'test-v2', persistence: 'memory', providers: {} }; },
    async chat(input) {
      calls.push(input);
      return {
        message: 'V2 response',
        conversationId: input.body.conversationId,
        messageId: 'assistant-v2',
        source: 'meg-v2',
        safety: null,
        urgent: false,
        engineVersion: 'test-v2',
        traceId: 'trace-v2',
      };
    },
  };
  const verifyIdToken = async (token) => {
    if (token !== 'valid-token') throw new Error('bad token');
    return { uid: 'verified-user' };
  };
  const app = createApp({
    megV2Bridge: bridge,
    verifyIdToken,
    allowedOrigins: ['http://allowed.test'],
    buildStatus: 'test-build',
    logger: silentLogger,
  });

  await withServer(app, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/meg/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', conversationId: 'c1' }),
    });
    assert.equal(missing.status, 401);

    const response = await fetch(`${baseUrl}/api/meg/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
        Origin: 'http://allowed.test',
      },
      body: JSON.stringify({
        message: 'hello',
        conversationId: 'c1',
        messageId: 'm1',
        uid: 'attacker-user',
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(calls[0].uid, 'verified-user');
    assert.equal(calls[0].body.uid, 'attacker-user');
    const payload = await response.json();
    assert.equal(payload.message, 'V2 response');
    assert.equal(payload.source, 'meg-v2');
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'uid'), false);

    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    const healthPayload = await health.json();
    assert.equal(healthPayload.provider, 'meg-v2');
    assert.equal(healthPayload.engineVersion, 'test-v2');
  });
});
