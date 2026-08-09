const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const { createApp } = require('./index');
const {
  MEG_QA_FAILURE_CATEGORY,
  createServerMegQaTiming,
  isMegQaTimingEnabled,
  validTraceId,
} = require('./megQaTiming');
const {
  MEG_QA_DURATION_KEYS,
  MEG_QA_FIELD_ORDER,
  sanitizeMegQaTiming,
  writeMegQaTiming,
} = require('./safeLogger');
const {
  PROVIDER_OPENAI_COMPATIBLE,
  createMegProvider,
} = require('./megProvider');

const TRACE_ID = '123e4567-e89b-42d3-a456-426614174000';
const CANARIES = [
  'MESSAGE_CANARY_private-health-text',
  'UID_CANARY_user-secret',
  'EMAIL_CANARY_person@example.test',
  'TOKEN_CANARY_eyJhbGciOiJIUzI1NiJ9',
  'API_KEY_CANARY_sk-secret',
  'CONVERSATION_CANARY_secret',
  'MESSAGE_ID_CANARY_secret',
  'ERROR_CANARY_provider-body-secret',
];

function parseMegQaLine(line) {
  assert.match(line, /^\[meg-qa\] \{.+\}$/);
  return JSON.parse(line.slice('[meg-qa] '.length));
}

async function withApp(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function captureConsole(callback) {
  const methods = ['log', 'warn', 'error'];
  const originals = Object.fromEntries(methods.map((method) => [method, console[method]]));
  const lines = [];
  for (const method of methods) {
    console[method] = (...args) => lines.push(args.join(' '));
  }
  try {
    await callback(lines);
  } finally {
    for (const method of methods) console[method] = originals[method];
  }
  return lines;
}

function routeBody() {
  return {
    message: CANARIES[0],
    history: [{ role: 'user', content: CANARIES[2] }],
    conversationId: CANARIES[5],
    messageId: CANARIES[6],
    mode: 'listen',
    language: 'en',
  };
}

async function postRoute(baseUrl, traceId = TRACE_ID) {
  return fetch(`${baseUrl}/api/meg/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CANARIES[3]}`,
      'Content-Type': 'application/json',
      'X-Meg-Trace-Id': traceId,
    },
    body: JSON.stringify(routeBody()),
  });
}

function successfulPersistence(calls) {
  return {
    async persistUserMessage(input) {
      calls.user.push(input);
      return {
        completedAssistantText: null,
        conversationId: input.conversationId,
        assistantMessageId: `assistant-${input.messageId}`,
      };
    },
    async persistAssistantMessage(input) {
      calls.assistant.push(input);
      return {
        text: input.text,
        conversationId: input.conversationId,
        messageId: `assistant-${input.messageId}`,
        source: 'openai-compatible',
        safety: null,
      };
    },
  };
}

test('Meg QA flag is strict and OFF performs no clock, UUID, or emission work', () => {
  assert.equal(isMegQaTimingEnabled({}), false);
  assert.equal(isMegQaTimingEnabled({ MEG_QA_TIMING: '0' }), false);
  assert.equal(isMegQaTimingEnabled({ MEG_QA_TIMING: 'true' }), false);
  assert.equal(isMegQaTimingEnabled({ MEG_QA_TIMING: '1' }), true);
  const calls = { clock: 0, uuid: 0, emit: 0 };
  const timing = createServerMegQaTiming({
    enabled: false,
    requestedTraceId: TRACE_ID,
    now() { calls.clock += 1; return 1; },
    uuid() { calls.uuid += 1; return TRACE_ID; },
    emit() { calls.emit += 1; },
  });
  assert.equal(timing, null);
  assert.deepEqual(calls, { clock: 0, uuid: 0, emit: 0 });
});

test('route flag OFF emits nothing and does not expose a trace', async () => {
  const calls = { user: [], assistant: [], provider: [] };
  const app = createApp({
    megQaTimingEnabled: false,
    megProvider: {
      id: 'test-provider',
      timeoutMs: 1000,
      async chat(input) {
        calls.provider.push(input);
        return 'Safe synthetic reply.';
      },
    },
    megPersistence: successfulPersistence(calls),
    verifyIdToken: async () => ({ uid: CANARIES[1] }),
    allowedOrigins: [],
    buildStatus: 'test',
  });

  const lines = await captureConsole(async () => {
    await withApp(app, async (baseUrl) => {
      const response = await postRoute(baseUrl);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(JSON.stringify(body).includes(TRACE_ID), false);
    });
  });

  assert.deepEqual(lines.filter((line) => line.startsWith('[meg-qa] ')), []);
  assert.equal(Object.hasOwn(calls.provider[0], 'qaTiming'), false);
  assert.equal(Object.hasOwn(calls.provider[0], 'qaPhase'), false);
  assert.equal(JSON.stringify(calls.user).includes(TRACE_ID), false);
  assert.equal(JSON.stringify(calls.assistant).includes(TRACE_ID), false);
});

test('successful route emits one aggregate line and keeps trace out of provider, persistence, and response bodies', async () => {
  const calls = { user: [], assistant: [], providerHttp: [] };
  const provider = createMegProvider({
    id: PROVIDER_OPENAI_COMPATIBLE,
    endpoint: 'https://provider.example/v1/chat/completions',
    apiKey: CANARIES[4],
    model: 'qa-model',
    timeoutMs: 1000,
  }, {
    fetchImpl: async (url, options) => {
      calls.providerHttp.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { choices: [{ message: { content: 'Safe synthetic reply.' } }] };
        },
      };
    },
  });
  const app = createApp({
    megQaTimingEnabled: true,
    megProvider: provider,
    megPersistence: successfulPersistence(calls),
    verifyIdToken: async () => ({ uid: CANARIES[1] }),
    allowedOrigins: [],
    buildStatus: 'test',
  });

  let responseBody;
  const lines = await captureConsole(async () => {
    await withApp(app, async (baseUrl) => {
      const response = await postRoute(baseUrl);
      responseBody = await response.json();
      assert.equal(response.status, 200);
    });
  });

  const qaLines = lines.filter((line) => line.startsWith('[meg-qa] '));
  assert.equal(qaLines.length, 1);
  const aggregate = parseMegQaLine(qaLines[0]);
  assert.equal(aggregate.trace_id, TRACE_ID);
  assert.equal(aggregate.status, 200);
  assert.equal(aggregate.failure_category, MEG_QA_FAILURE_CATEGORY.NONE);
  assert.equal(aggregate.revision_triggered, 0);
  for (const field of [
    'server_auth_ms',
    'user_msg_persist_ms',
    'provider_headers_ms',
    'provider_body_ms',
    'provider_total_ms',
    'assistant_msg_persist_ms',
    'server_total_ms',
  ]) {
    assert.equal(Number.isInteger(aggregate[field]) && aggregate[field] >= 1, true);
  }
  assert.equal(JSON.stringify(responseBody).includes(TRACE_ID), false);
  assert.equal(JSON.stringify(calls.user).includes(TRACE_ID), false);
  assert.equal(JSON.stringify(calls.assistant).includes(TRACE_ID), false);
  assert.equal(calls.providerHttp[0].options.body.includes(TRACE_ID), false);
  assert.equal(JSON.stringify(calls.providerHttp[0].options.headers).includes(TRACE_ID), false);
  for (const canary of CANARIES) {
    assert.equal(lines.join('\n').includes(canary), false);
  }
});

test('rewrite-triggered success emits revision timing in the same single aggregate line', async () => {
  const traceId = '223e4567-e89b-42d3-a456-426614174000';
  const calls = { user: [], assistant: [] };
  let providerCalls = 0;
  const provider = createMegProvider({
    id: PROVIDER_OPENAI_COMPATIBLE,
    endpoint: 'https://provider.example/v1/chat/completions',
    apiKey: CANARIES[4],
    model: 'qa-model',
    timeoutMs: 1000,
  }, {
    fetchImpl: async () => {
      providerCalls += 1;
      const content = providerCalls === 1
        ? `- ${'word '.repeat(121)}`
        : 'Safe revised reply.';
      return {
        ok: true,
        status: 200,
        async json() {
          return { choices: [{ message: { content } }] };
        },
      };
    },
  });
  const app = createApp({
    megQaTimingEnabled: true,
    megProvider: provider,
    megPersistence: successfulPersistence(calls),
    verifyIdToken: async () => ({ uid: CANARIES[1] }),
    allowedOrigins: [],
    buildStatus: 'test',
  });

  const lines = await captureConsole(async () => {
    await withApp(app, async (baseUrl) => {
      const response = await postRoute(baseUrl, traceId);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).message, 'Safe revised reply.');
    });
  });

  const qaLines = lines.filter((line) => line.startsWith('[meg-qa] '));
  assert.equal(providerCalls, 2);
  assert.equal(qaLines.length, 1);
  const aggregate = parseMegQaLine(qaLines[0]);
  assert.equal(aggregate.trace_id, traceId);
  assert.equal(aggregate.revision_triggered, 1);
  assert.equal(
    Number.isInteger(aggregate.revision_provider_total_ms)
      && aggregate.revision_provider_total_ms >= 1,
    true
  );
  assert.equal(aggregate.status, 200);
  assert.equal(aggregate.failure_category, MEG_QA_FAILURE_CATEGORY.NONE);
});

test('route failure taxonomy is numeric and no PII canary reaches any console line', async () => {
  const scenarios = [
    { name: 'auth', status: 401, category: MEG_QA_FAILURE_CATEGORY.AUTH },
    { name: 'network', status: 503, category: MEG_QA_FAILURE_CATEGORY.NETWORK },
    { name: 'provider_4xx', status: 502, category: MEG_QA_FAILURE_CATEGORY.PROVIDER_4XX },
    { name: 'provider_5xx', status: 502, category: MEG_QA_FAILURE_CATEGORY.PROVIDER_5XX },
    { name: 'timeout', status: 504, category: MEG_QA_FAILURE_CATEGORY.PROVIDER_TIMEOUT },
    { name: 'parse', status: 502, category: MEG_QA_FAILURE_CATEGORY.PARSE },
    { name: 'user_persistence', status: 503, category: MEG_QA_FAILURE_CATEGORY.PERSISTENCE },
    { name: 'assistant_persistence', status: 503, category: MEG_QA_FAILURE_CATEGORY.PERSISTENCE },
    { name: 'unknown', status: 503, category: MEG_QA_FAILURE_CATEGORY.UNKNOWN },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    const traceId = `123e4567-e89b-42d3-a456-42661417400${index}`;
    const calls = { user: [], assistant: [] };
    const provider = scenario.name === 'unknown'
      ? {
          id: 'test-provider',
          timeoutMs: 1000,
          async chat() { throw new Error(CANARIES[7]); },
        }
      : createMegProvider({
          id: PROVIDER_OPENAI_COMPATIBLE,
          endpoint: 'https://provider.example/v1/chat/completions',
          apiKey: CANARIES[4],
          model: 'qa-model',
          timeoutMs: 1000,
        }, {
          fetchImpl: async () => {
            if (scenario.name === 'network') throw new Error(CANARIES[7]);
            if (scenario.name === 'timeout') {
              const error = new Error(CANARIES[7]);
              error.name = 'AbortError';
              throw error;
            }
            const providerStatus = scenario.name === 'provider_4xx'
              ? 429
              : scenario.name === 'provider_5xx'
                ? 503
                : 200;
            return {
              ok: providerStatus === 200,
              status: providerStatus,
              async json() {
                if (scenario.name === 'parse') throw new Error(CANARIES[7]);
                if (providerStatus !== 200) {
                  return { error: { message: CANARIES[7] } };
                }
                return { choices: [{ message: { content: 'Safe synthetic reply.' } }] };
              },
            };
          },
        });
    const persistence = successfulPersistence(calls);
    if (scenario.name === 'user_persistence') {
      persistence.persistUserMessage = async () => { throw new Error(CANARIES[7]); };
    }
    if (scenario.name === 'assistant_persistence') {
      persistence.persistAssistantMessage = async () => {
        throw new Error(CANARIES[7]);
      };
    }
    const app = createApp({
      megQaTimingEnabled: true,
      megProvider: provider,
      megPersistence: persistence,
      verifyIdToken: async () => {
        if (scenario.name === 'auth') throw new Error(CANARIES[7]);
        return { uid: CANARIES[1] };
      },
      allowedOrigins: [],
      buildStatus: 'test',
    });

    let responseBody;
    const lines = await captureConsole(async () => {
      await withApp(app, async (baseUrl) => {
        const response = await postRoute(baseUrl, traceId);
        responseBody = await response.json();
        assert.equal(response.status, scenario.status, scenario.name);
      });
    });
    const qaLines = lines.filter((line) => line.startsWith('[meg-qa] '));
    assert.equal(qaLines.length, 1, `${scenario.name}: aggregate count`);
    const aggregate = parseMegQaLine(qaLines[0]);
    assert.equal(aggregate.trace_id, traceId, `${scenario.name}: trace`);
    assert.equal(aggregate.status, scenario.status, `${scenario.name}: status`);
    assert.equal(
      aggregate.failure_category,
      scenario.category,
      `${scenario.name}: failure category`
    );
    if (['network', 'timeout'].includes(scenario.name)) {
      assert.equal(
        Number.isInteger(aggregate.provider_total_ms) && aggregate.provider_total_ms >= 1,
        true,
        `${scenario.name}: provider total`
      );
    }
    assert.equal(JSON.stringify(responseBody).includes(traceId), false);
    assert.equal(JSON.stringify(calls).includes(traceId), false);
    for (const canary of CANARIES) {
      assert.equal(lines.join('\n').includes(canary), false, `${scenario.name}: ${canary}`);
    }
  }
});

test('Meg QA sanitizer emits only fixed fields and applies minimum-one rounding', () => {
  const payload = {
    trace_id: TRACE_ID,
    client_token_acquisition_ms: 0,
    client_http_total_ms: 1.51,
    tap_to_visible_reply_ms: -20,
    client_local_persist_ms: 10.49,
    server_auth_ms: 0.49,
    user_msg_persist_ms: 1.5,
    provider_headers_ms: 2.4,
    provider_body_ms: 3.6,
    provider_total_ms: 6,
    revision_provider_total_ms: 9.5,
    assistant_msg_persist_ms: 10.5,
    server_total_ms: 11.5,
    revision_triggered: 1,
    status: 200.4,
    failure_category: MEG_QA_FAILURE_CATEGORY.NONE,
    message: CANARIES[0],
    uid: CANARIES[1],
    email: CANARIES[2],
    token: CANARIES[3],
    api_key: CANARIES[4],
    conversationId: CANARIES[5],
    messageId: CANARIES[6],
    err: { message: CANARIES[7], stack: CANARIES[0] },
    unknown_metric_ms: 99,
  };
  const sanitized = sanitizeMegQaTiming(payload);
  assert.deepEqual(Object.keys(sanitized), ['trace_id', ...MEG_QA_FIELD_ORDER]);
  assert.deepEqual([...MEG_QA_DURATION_KEYS].map((key) => sanitized[key]), [
    1, 2, 1, 10, 1, 2, 2, 4, 6, 10, 11, 12,
  ]);
  assert.equal(sanitized.revision_triggered, 1);
  assert.equal(sanitized.status, 200);
  assert.equal(sanitized.failure_category, 0);
  const serialized = JSON.stringify(sanitized);
  for (const canary of CANARIES) assert.equal(serialized.includes(canary), false);
  assert.equal(serialized.includes('unknown_metric_ms'), false);
  assert.deepEqual(sanitizeMegQaTiming({ ...payload, trace_id: CANARIES[0] }), {});
});

test('Meg QA writer emits one prefixed JSON line and cannot emit arbitrary errors', () => {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    assert.equal(writeMegQaTiming({
      trace_id: TRACE_ID,
      server_total_ms: 0.1,
      revision_triggered: 0,
      status: 503,
      failure_category: MEG_QA_FAILURE_CATEGORY.UNKNOWN,
      arbitrary: CANARIES.join('|'),
      err: { message: CANARIES[7], stack: CANARIES[0] },
    }), true);
  } finally {
    console.log = originalLog;
  }
  assert.equal(lines.length, 1);
  assert.deepEqual(parseMegQaLine(lines[0]), {
    trace_id: TRACE_ID,
    server_total_ms: 1,
    revision_triggered: 0,
    status: 503,
    failure_category: MEG_QA_FAILURE_CATEGORY.UNKNOWN,
  });
  for (const canary of CANARIES) assert.equal(lines[0].includes(canary), false);
});

test('server aggregate uses a fake clock, keeps provider arithmetic, and emits once', () => {
  const clock = [100, 100.2, 102.6, 102.6, 106.1, 106.1, 110.2];
  const emitted = [];
  const timing = createServerMegQaTiming({
    enabled: true,
    requestedTraceId: TRACE_ID,
    now: () => {
      assert.notEqual(clock.length, 0, 'fake clock exhausted');
      return clock.shift();
    },
    uuid() { throw new Error('valid client trace must not invoke UUID fallback'); },
    emit: (payload) => emitted.push(sanitizeMegQaTiming(payload)),
  });
  const providerStart = timing.mark();
  timing.recordDuration('provider_headers_ms', providerStart);
  const bodyStart = timing.mark();
  timing.recordDuration('provider_body_ms', bodyStart);
  timing.recordDuration('provider_total_ms', providerStart);
  timing.finish(200);
  timing.finish(500);
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0], {
    trace_id: TRACE_ID,
    provider_headers_ms: 2,
    provider_body_ms: 4,
    provider_total_ms: 6,
    server_total_ms: 10,
    revision_triggered: 0,
    status: 200,
    failure_category: MEG_QA_FAILURE_CATEGORY.NONE,
  });
  assert.equal(validTraceId(emitted[0].trace_id), true);
  assert.ok(Math.abs(
    emitted[0].provider_total_ms
      - emitted[0].provider_headers_ms
      - emitted[0].provider_body_ms
  ) <= 4);
});

test('provider measures dispatch-to-headers and body with the injected fake clock', async () => {
  const emitted = [];
  const ticks = [0, 10, 14, 20, 25];
  const timing = createServerMegQaTiming({
    enabled: true,
    requestedTraceId: TRACE_ID,
    now: () => ticks.shift(),
    emit: (payload) => emitted.push(sanitizeMegQaTiming(payload)),
  });
  const provider = createMegProvider({
    id: PROVIDER_OPENAI_COMPATIBLE,
    endpoint: 'https://provider.example/v1/chat/completions',
    apiKey: CANARIES[4],
    model: 'qa-model',
    timeoutMs: 1000,
  }, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: 'safe synthetic reply' } }] };
      },
    }),
  });

  const reply = await provider.chat({
    messages: [{ role: 'user', content: CANARIES[0] }],
    qaTiming: timing,
  });
  timing.finish(200);

  assert.equal(reply, 'safe synthetic reply');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].provider_headers_ms, 4);
  assert.equal(emitted[0].provider_body_ms, 6);
  assert.equal(emitted[0].provider_total_ms, 10);
  assert.equal(
    emitted[0].provider_total_ms,
    emitted[0].provider_headers_ms + emitted[0].provider_body_ms
  );
  for (const canary of CANARIES) {
    assert.equal(JSON.stringify(emitted[0]).includes(canary), false);
  }
});

test('server aggregate preserves each fixed category and defaults failed status to unknown', () => {
  for (const category of Object.values(MEG_QA_FAILURE_CATEGORY)) {
    const emitted = [];
    let tick = 0;
    const timing = createServerMegQaTiming({
      enabled: true,
      requestedTraceId: TRACE_ID,
      now: () => ++tick,
      emit: (payload) => emitted.push(sanitizeMegQaTiming(payload)),
    });
    timing.setFailure(category);
    timing.finish(category === MEG_QA_FAILURE_CATEGORY.NONE ? 200 : 503);
    assert.equal(emitted[0].failure_category, category);
  }
  const emitted = [];
  let tick = 0;
  const timing = createServerMegQaTiming({
    enabled: true,
    requestedTraceId: TRACE_ID,
    now: () => ++tick,
    emit: (payload) => emitted.push(sanitizeMegQaTiming(payload)),
  });
  timing.finish(400);
  assert.equal(emitted[0].failure_category, MEG_QA_FAILURE_CATEGORY.UNKNOWN);
});
