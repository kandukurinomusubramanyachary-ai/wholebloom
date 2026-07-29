const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const {
  WAITLIST_COLLECTION,
  createBetaEmailChecker,
  isValidBetaEmail,
  normalizeBetaEmail,
} = require('./betaAccess');
const { createApp } = require('./index');

function createFakeFirestore({ empty = false } = {}) {
  const calls = [];
  const query = {
    where(field, operator, value) {
      calls.push(['where', field, operator, value]);
      return query;
    },
    limit(value) {
      calls.push(['limit', value]);
      return query;
    },
    select(...fields) {
      calls.push(['select', ...fields]);
      return query;
    },
    async get() {
      calls.push(['get']);
      return { empty };
    },
  };
  return {
    calls,
    db: {
      collection(name) {
        calls.push(['collection', name]);
        return query;
      },
    },
  };
}

async function withServer(betaEmailChecker, callback) {
  const app = createApp({
    betaEmailChecker,
    megProvider: {
      id: 'test-provider',
      async chat() { return 'test response'; },
    },
    verifyIdToken: async () => ({ uid: 'test-user' }),
    megPersistence: {
      async persistUserMessage() { return {}; },
      async persistAssistantMessage() { return {}; },
    },
    allowedOrigins: [],
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

async function postEmail(baseUrl, email) {
  return fetch(`${baseUrl}/api/beta/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

test('normalizes email with trim and lowercase', () => {
  assert.equal(
    normalizeBetaEmail('  LISTED.PERSON@EXAMPLE.COM  '),
    'listed.person@example.com'
  );
});

test('validates practical email addresses', () => {
  assert.equal(isValidBetaEmail('person@example.com'), true);
  assert.equal(isValidBetaEmail('not-an-email'), false);
  assert.equal(isValidBetaEmail('person@localhost'), false);
  assert.equal(isValidBetaEmail('two..dots@example.com'), false);
});

test('queries only bloom_waitlist by normalized email and limits the result', async () => {
  const fake = createFakeFirestore();
  const checker = createBetaEmailChecker({ getFirestoreDb: () => fake.db });

  assert.equal(await checker('  LISTED.PERSON@EXAMPLE.COM  '), true);
  assert.deepEqual(fake.calls, [
    ['collection', WAITLIST_COLLECTION],
    ['where', 'email', '==', 'listed.person@example.com'],
    ['limit', 1],
    ['select', 'email'],
    ['get'],
  ]);
});

test('the disconnected Beta route does not check formerly eligible emails', async () => {
  let checkedEmail;
  await withServer(async (email) => {
    checkedEmail = email;
    return true;
  }, async (baseUrl) => {
    const response = await postEmail(baseUrl, '  LISTED.PERSON@EXAMPLE.COM  ');
    assert.equal(response.status, 404);
    assert.equal(checkedEmail, undefined);
  });
});

test('the disconnected Beta route does not reveal ineligible status', async () => {
  await withServer(async () => false, async (baseUrl) => {
    const response = await postEmail(baseUrl, 'not-listed@example.com');
    assert.equal(response.status, 404);
  });
});

test('the disconnected Beta route never queries Firestore for invalid email', async () => {
  let called = false;
  await withServer(async () => {
    called = true;
    return true;
  }, async (baseUrl) => {
    const response = await postEmail(baseUrl, 'not-an-email');
    assert.equal(response.status, 404);
    assert.equal(called, false);
  });
});

test('the disconnected Beta route exposes no email or Firestore error data', async () => {
  const submittedEmail = 'private.person@example.com';
  await withServer(async () => {
    const error = new Error('Firestore detail that must stay on the server');
    error.code = 'firestore-unavailable';
    throw error;
  }, async (baseUrl) => {
    const response = await postEmail(baseUrl, submittedEmail);
    const body = await response.text();
    assert.equal(response.status, 404);
    assert.equal(body.includes(submittedEmail), false);
    assert.equal(body.includes('Firestore detail'), false);
  });
});
