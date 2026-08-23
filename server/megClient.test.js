const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

function loadMegModule(currentUser) {
  const filename = path.resolve(__dirname, '../src/services/meg.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => {
    if (request === './firebase') return { auth: { currentUser } };
    if (request === './megQaTiming') {
      return {
        MEG_QA_FAILURE_CATEGORY: {
          AUTH: 'auth',
          NETWORK: 'network',
          PARSE: 'parse',
          PROVIDER_TIMEOUT: 'provider_timeout',
          UNKNOWN: 'unknown',
        },
      };
    }
    if (request === './megUrlPolicy') {
      return { resolveMegApiBaseUrl: ({ configuredValue }) => configuredValue || 'http://127.0.0.1:3001' };
    }
    return require(request);
  };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(localRequire, moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

test('buildMegContext emits only the bounded server-approved data shape', () => {
  const meg = loadMegModule(null);
  const now = new Date(2026, 7, 9, 12, 0, 0);
  const context = meg.buildMegContext({
    currentCycleDay: 18,
    currentPhase: { label: 'Later cycle', secret: 'no' },
    averageCycleLength: 32,
    todayCheckin: {
      date: '2026-08-09',
      mood: 'low',
      energy: 3,
      sleep: 5,
      pain: 6,
      flow: 'light',
      journal: 'private',
      symptoms: ['private'],
    },
    checkins: [],
    meals: Array.from({ length: 22 }, (_, index) => ({
      id: `meal-${index}`,
      date: '2026-08-09',
      notes: 'private',
    })),
    movements: [{ date: '2026-08-09', status: 'complete', notes: 'private' }],
    profile: {
      goals: ['understand PCOS', 'x'.repeat(61), ...Array.from({ length: 12 }, () => 'goal')],
      trackingMode: 'pcos',
      email: 'private@example.test',
    },
    settings: {},
  }, now);

  assert.deepEqual(context, {
    cycleDay: 18,
    currentPhase: 'Later cycle',
    averageCycleLength: 32,
    todayCheckin: { mood: 'low', energy: 3, sleep: 5, pain: 6, flow: 'light' },
    mealsLogged: 20,
    movementLogged: true,
    goals: ['understand PCOS', ...Array.from({ length: 8 }, () => 'goal')],
    trackingMode: 'pcos',
  });
  assert.doesNotMatch(JSON.stringify(context), /private|email|journal|symptoms|notes/i);
});

test('Meg API provider sends bounded context and mode in the authenticated request', async () => {
  const currentUser = { async getIdToken() { return 'firebase-token'; } };
  const meg = loadMegModule(currentUser);
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          message: 'A contextual reply',
          conversationId: 'conversation-1',
          messageId: 'assistant-1',
          source: 'test',
        };
      },
    };
  };

  try {
    const provider = meg.createLocalMegApiProvider({
      baseUrl: 'http://127.0.0.1:3001',
      timeoutMs: 1000,
    });
    const context = {
      cycleDay: 18,
      todayCheckin: { mood: 'low', sleep: 5, journal: 'private' },
      mealsLogged: 2,
      movementLogged: true,
      goals: [],
      trackingMode: 'cycle',
      email: 'private@example.test',
    };
    await provider.reply({
      message: 'Why do I feel awful?',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      mode: 'understand',
      context,
      history: [],
    });

    assert.equal(request.options.headers.Authorization, 'Bearer firebase-token');
    assert.equal(request.body.mode, 'understand');
    assert.equal(request.body.supportMode, 'understand');
    assert.deepEqual(request.body.context, {
      cycleDay: 18,
      todayCheckin: { mood: 'low', sleep: 5 },
      mealsLogged: 2,
      movementLogged: true,
      goals: [],
      trackingMode: 'cycle',
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('megService.send preserves request context when calling its provider', async () => {
  const meg = loadMegModule(null);
  let received;
  const service = meg.createMegService({
    provider: {
      async reply(request) {
        received = request;
        return { text: 'Reply' };
      },
    },
  });
  const context = { cycleDay: 18, mealsLogged: 1 };

  await service.send({ message: 'Hello', mode: 'listen', context });
  assert.equal(received.mode, 'listen');
  assert.deepEqual(received.context, context);
});
