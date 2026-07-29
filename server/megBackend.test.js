const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { createApp, resolveAllowedOrigins } = require('./index');
const {
  bearerTokenFromHeader,
} = require('./firebaseAuth');
const {
  decodeServiceAccount,
} = require('./firebaseAdmin');
const {
  PROVIDER_OLLAMA,
  PROVIDER_OPENAI_COMPATIBLE,
  createMegProvider,
  resolveMegProviderConfig,
} = require('./megProvider');
const {
  createMegPersistence,
  stripUndefined,
} = require('./megPersistence');

const silentLogger = {
  info() {},
  warn() {},
  error() {},
};

function fakeRuntime(overrides = {}) {
  const calls = {
    verifiedTokens: [],
    provider: [],
    userMessages: [],
    assistantMessages: [],
  };
  const megProvider = overrides.megProvider || {
    id: 'test-provider',
    timeoutMs: 1000,
    async chat(request) {
      calls.provider.push(request);
      return 'You waited three weeks, and that uncertainty matters.';
    },
  };
  const megPersistence = overrides.megPersistence || {
    async persistUserMessage(input) {
      calls.userMessages.push(input);
      return {
        completedAssistantText: null,
        conversationId: input.conversationId,
        assistantMessageId: `assistant-${input.messageId}`,
      };
    },
    async persistAssistantMessage(input) {
      calls.assistantMessages.push(input);
      return {
        text: input.text,
        conversationId: input.conversationId,
        messageId: `assistant-${input.messageId}`,
        source: megProvider.id,
        safety: input.safety,
      };
    },
  };
  const verifyIdToken = overrides.verifyIdToken || (async (token) => {
    calls.verifiedTokens.push(token);
    if (token !== 'valid-token') {
      const error = new Error('invalid token detail');
      error.code = 'auth/argument-error';
      throw error;
    }
    return { uid: 'verified-user' };
  });

  return {
    calls,
    app: createApp({
      megProvider,
      megPersistence,
      verifyIdToken,
      allowedOrigins: overrides.allowedOrigins ?? ['http://allowed.test'],
      buildStatus: 'test-build',
      logger: silentLogger,
    }),
  };
}

async function withServer(runtime, callback) {
  const server = runtime.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback(baseUrl);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function chatBody(overrides = {}) {
  return {
    message: 'My period is three weeks late.',
    history: [],
    conversationId: 'meg-conversation-1',
    messageId: 'meg-message-1',
    mode: 'understand',
    language: 'en',
    ...overrides,
  };
}

async function postMeg(baseUrl, body, token, origin) {
  return fetch(`${baseUrl}/api/meg/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('Bearer parsing is strict and never accepts another authentication scheme', () => {
  assert.equal(bearerTokenFromHeader('Bearer token-value'), 'token-value');
  assert.equal(bearerTokenFromHeader('bearer\ttoken-value'), 'token-value');
  assert.equal(bearerTokenFromHeader('Basic token-value'), null);
  assert.equal(bearerTokenFromHeader('Bearer'), null);
  assert.equal(bearerTokenFromHeader('Bearer two values'), null);
});

test('Meg rejects missing and invalid Firebase tokens with JSON 401 responses', async () => {
  const runtime = fakeRuntime();
  await withServer(runtime, async (baseUrl) => {
    const missing = await postMeg(baseUrl, chatBody());
    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), { error: 'Authentication is required.' });

    const invalid = await postMeg(baseUrl, chatBody(), 'invalid-token');
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), { error: 'Authentication is required.' });
    assert.equal(runtime.calls.userMessages.length, 0);
    assert.deepEqual(runtime.calls.verifiedTokens, ['invalid-token']);
  });
});

test('Meg derives UID only from the verified token and returns safe persisted identifiers', async () => {
  const runtime = fakeRuntime();
  await withServer(runtime, async (baseUrl) => {
    const response = await postMeg(baseUrl, chatBody({ uid: 'attacker-supplied-user' }), 'valid-token');
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(runtime.calls.userMessages[0].uid, 'verified-user');
    assert.equal(runtime.calls.assistantMessages[0].uid, 'verified-user');
    assert.equal(JSON.stringify(runtime.calls).includes('attacker-supplied-user'), false);
    assert.deepEqual(payload, {
      message: 'You waited three weeks, and that uncertainty matters.',
      conversationId: 'meg-conversation-1',
      messageId: 'assistant-meg-message-1',
      source: 'test-provider',
      safety: null,
    });
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'uid'), false);
  });
});

test('health is public and CORS allows only configured origins with auth preflight', async () => {
  const runtime = fakeRuntime();
  await withServer(runtime, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      status: 'ready',
      build: 'test-build',
      provider: 'test-provider',
    });

    const preflight = await fetch(`${baseUrl}/api/meg/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://allowed.test',
        'Access-Control-Request-Headers': 'authorization,content-type',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://allowed.test');
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
    assert.match(preflight.headers.get('vary'), /Origin/);
    assert.equal(preflight.headers.has('access-control-allow-credentials'), false);

    const rejected = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(rejected.status, 403);
  });
});

test('development CORS accepts Expo localhost port 8084 and rejects external origins', async () => {
  const runtime = fakeRuntime({
    allowedOrigins: resolveAllowedOrigins({
      NODE_ENV: 'development',
      CORS_ALLOWED_ORIGINS: 'https://should-not-be-used.example',
    }),
  });

  await withServer(runtime, async (baseUrl) => {
    for (const origin of ['http://localhost:8084', 'http://127.0.0.1:8084']) {
      const response = await fetch(`${baseUrl}/health`, { headers: { Origin: origin } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
    }

    const authorized = await postMeg(
      baseUrl,
      chatBody(),
      'valid-token',
      'http://localhost:8084'
    );
    assert.equal(authorized.status, 200);
    assert.deepEqual(runtime.calls.verifiedTokens, ['valid-token']);

    for (const origin of ['https://unknown.example', 'http://localhost:8091']) {
      const response = await fetch(`${baseUrl}/health`, { headers: { Origin: origin } });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'Origin is not allowed.' });
    }
  });
});

test('production CORS accepts only trimmed configured origins and permits originless requests', async () => {
  const runtime = fakeRuntime({
    allowedOrigins: resolveAllowedOrigins({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: ' https://bloom.example, https://admin.bloom.example ',
    }),
  });

  await withServer(runtime, async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://bloom.example' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(
      allowed.headers.get('access-control-allow-origin'),
      'https://bloom.example'
    );

    const rejected = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://unconfigured.example' },
    });
    assert.equal(rejected.status, 403);
    assert.deepEqual(await rejected.json(), { error: 'Origin is not allowed.' });

    const originless = await fetch(`${baseUrl}/health`);
    assert.equal(originless.status, 200);
  });
});

test('development OPTIONS preflight allows Bloom methods and authorization headers', async () => {
  const runtime = fakeRuntime({
    allowedOrigins: resolveAllowedOrigins({ NODE_ENV: 'development' }),
  });

  await withServer(runtime, async (baseUrl) => {
    const preflight = await fetch(`${baseUrl}/api/meg/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8084',
        'Access-Control-Request-Headers': 'authorization,content-type',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get('access-control-allow-origin'),
      'http://localhost:8084'
    );
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/i);
    assert.match(preflight.headers.get('access-control-allow-headers'), /Content-Type/i);
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']) {
      assert.match(preflight.headers.get('access-control-allow-methods'), new RegExp(method));
    }
    assert.equal(preflight.headers.has('access-control-allow-credentials'), false);
  });
});

test('production CORS configuration rejects missing or wildcard origins', () => {
  assert.throws(
    () => resolveAllowedOrigins({ NODE_ENV: 'production' }),
    /CORS_ALLOWED_ORIGINS is required/
  );
  assert.throws(
    () => resolveAllowedOrigins({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: '*' }),
    /valid HTTP\/HTTPS origins/
  );
});

test('the public Beta eligibility HTTP route is disconnected', async () => {
  const runtime = fakeRuntime();
  await withServer(runtime, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/beta/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'listed@example.com' }),
    });
    assert.equal(response.status, 404);
  });
});

test('provider configuration validates production mode without exposing secrets', () => {
  assert.throws(
    () => resolveMegProviderConfig({ MEG_PROVIDER: 'openai-compatible' }),
    /MEG_API_BASE_URL/
  );
  assert.throws(
    () => resolveMegProviderConfig({ MEG_PROVIDER: 'unknown' }),
    /MEG_PROVIDER/
  );
  const config = resolveMegProviderConfig({
    MEG_PROVIDER: 'openai-compatible',
    MEG_API_BASE_URL: 'https://provider.example/v1',
    MEG_API_KEY: 'server-secret',
    MEG_MODEL: 'production-model',
  });
  assert.equal(config.id, PROVIDER_OPENAI_COMPATIBLE);
  assert.equal(config.endpoint, 'https://provider.example/v1/chat/completions');
  assert.equal(config.apiKey, 'server-secret');
});

test('openai-compatible provider requires HTTPS in production', () => {
  assert.throws(
    () => resolveMegProviderConfig({
      NODE_ENV: 'production',
      MEG_PROVIDER: 'openai-compatible',
      MEG_API_BASE_URL: 'http://provider.example/v1',
      MEG_API_KEY: 'test-key',
      MEG_MODEL: 'test-model',
    }),
    /valid HTTPS URL in production/
  );
});

test('Ollama and OpenAI-compatible providers preserve non-streaming request semantics', async () => {
  const requests = [];
  const fakeFetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    const openAi = options.headers.Authorization;
    return {
      ok: true,
      async json() {
        return openAi
          ? { choices: [{ message: { content: ' hosted reply ' } }] }
          : { message: { content: ' local reply ' } };
      },
    };
  };
  const messages = [{ role: 'user', content: 'hello' }];
  const ollama = createMegProvider({
    id: PROVIDER_OLLAMA,
    endpoint: 'http://127.0.0.1:11434/api/chat',
    model: 'qwen3.5:4b',
    timeoutMs: 1000,
  }, { fetchImpl: fakeFetch });
  assert.equal(await ollama.chat({ messages }), 'local reply');
  assert.deepEqual(requests[0].body, {
    model: 'qwen3.5:4b',
    think: false,
    stream: false,
    messages,
  });
  assert.equal(requests[0].options.headers.Authorization, undefined);

  const hosted = createMegProvider({
    id: PROVIDER_OPENAI_COMPATIBLE,
    endpoint: 'https://provider.example/v1/chat/completions',
    apiKey: 'server-secret',
    model: 'production-model',
    timeoutMs: 1000,
  }, { fetchImpl: fakeFetch });
  assert.equal(await hosted.chat({
    messages,
    options: { temperature: 0.1, num_predict: 256 },
  }), 'hosted reply');
  assert.deepEqual(requests[1].body, {
    model: 'production-model',
    stream: false,
    messages,
    temperature: 0.1,
    max_tokens: 256,
  });
  assert.equal(requests[1].options.headers.Authorization, 'Bearer server-secret');
});

function createFakeFirestore() {
  const records = new Map();
  let timestampCounter = 0;

  class Reference {
    constructor(path) {
      this.path = path;
    }
    collection(name) {
      return new Reference(`${this.path}/${name}`);
    }
    doc(id) {
      return new Reference(`${this.path}/${id}`);
    }
  }

  function snapshot(reference) {
    return {
      exists: records.has(reference.path),
      data: () => records.get(reference.path),
    };
  }

  function materialize(data, current = {}) {
    const result = { ...current };
    for (const [key, value] of Object.entries(data)) {
      if (value?.constructor?.name === 'NumericIncrementTransform') {
        result[key] = Number(result[key] || 0) + value.operand;
      } else if (value?.constructor?.name === 'ServerTimestampTransform') {
        timestampCounter += 1;
        result[key] = `server-time-${timestampCounter}`;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return {
    records,
    collection(name) {
      return new Reference(name);
    },
    async runTransaction(operation) {
      const transaction = {
        async getAll(...references) {
          return references.map(snapshot);
        },
        set(reference, data, options = {}) {
          const current = options.merge ? records.get(reference.path) || {} : {};
          records.set(reference.path, materialize(data, current));
        },
      };
      return operation(transaction);
    },
  };
}

test('Meg Firestore persistence is per-UID, document-based and idempotent', async () => {
  const db = createFakeFirestore();
  const persistence = createMegPersistence({ getFirestoreDb: () => db });
  const input = {
    uid: 'user-a',
    conversationId: 'conversation-a',
    messageId: 'message-a',
    text: 'A private message',
    mode: 'listen',
    language: undefined,
  };

  const firstUser = await persistence.persistUserMessage(input);
  const createdAt = db.records.get('users/user-a/megConversations/conversation-a').createdAt;
  const duplicateUser = await persistence.persistUserMessage(input);
  assert.equal(firstUser.duplicate, false);
  assert.equal(duplicateUser.duplicate, true);

  const firstAssistant = await persistence.persistAssistantMessage({
    ...input,
    text: 'A private response',
    source: 'test-provider',
  });
  const duplicateAssistant = await persistence.persistAssistantMessage({
    ...input,
    text: 'A different retry response',
    source: 'test-provider',
  });
  await assert.rejects(
    () => persistence.persistUserMessage({ ...input, text: 'Reused ID with changed content' }),
    (error) => error.code === 'message_id_conflict' && error.status === 409
  );
  const conversation = db.records.get('users/user-a/megConversations/conversation-a');

  assert.equal(conversation.messageCount, 2);
  assert.equal(conversation.createdAt, createdAt);
  assert.equal(Object.prototype.hasOwnProperty.call(conversation, 'messages'), false);
  assert.equal(firstAssistant.text, 'A private response');
  assert.equal(duplicateAssistant.text, 'A private response');
  assert.equal(db.records.has('users/user-b/megConversations/conversation-a'), false);
  assert.equal(
    db.records.get('users/user-a/megConversations/conversation-a/messages/message-a').role,
    'user'
  );
  assert.equal(
    db.records.get('users/user-a/megConversations/conversation-a/messages/assistant-message-a').role,
    'assistant'
  );
});

test('undefined values are stripped and service-account decoding is server-safe', () => {
  assert.deepEqual(
    stripUndefined({ a: 1, missing: undefined, nested: { b: undefined, c: 2 } }),
    { a: 1, nested: { c: 2 } }
  );
  const encoded = Buffer.from(JSON.stringify({
    project_id: 'project-id',
    client_email: 'server@example.test',
    private_key: 'private-key',
  })).toString('base64');
  assert.equal(decodeServiceAccount(encoded).project_id, 'project-id');
  assert.throws(() => decodeServiceAccount('not-base64-json'), /base64-encoded/);
});
