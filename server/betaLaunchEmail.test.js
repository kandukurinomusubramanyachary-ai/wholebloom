const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BETA_LAUNCH_SUBJECT,
  buildBetaLaunchEmail,
  validateBetaUrl,
} = require('./betaLaunchEmail/template');
const {
  EmailProviderError,
  RESEND_EMAIL_ENDPOINT,
  createResendEmailProvider,
} = require('./betaLaunchEmail/provider');
const {
  BETA_LAUNCH_CAMPAIGN_ID,
  classifyWaitlistRecords,
  createProviderIdempotencyKey,
  formatLaunchSummary,
  hashRecipientEmail,
  maskEmail,
  runBetaLaunchCampaign,
} = require('./betaLaunchEmail/service');
const {
  createFirestoreBetaLaunchRepository,
  sanitizeErrorCode,
} = require('./betaLaunchEmail/firestore');
const {
  parseCliArgs,
  readSendConfiguration,
  safeCliError,
  validateCliOptions,
} = require('../scripts/send-beta-launch-emails');

function createLogger() {
  const output = [];
  return {
    output,
    log(message) {
      output.push(String(message));
    },
    error(message) {
      output.push(String(message));
    },
  };
}

function createMemoryFirestore(initialDocuments = {}) {
  const documents = new Map(
    Object.entries(initialDocuments).map(([path, data]) => [path, { ...data }])
  );

  function reference(path) {
    return { path };
  }

  function snapshotFor(ref) {
    const exists = documents.has(ref.path);
    return {
      exists,
      ref,
      data: () => (exists ? { ...documents.get(ref.path) } : undefined),
    };
  }

  const db = {
    collection(name) {
      return {
        doc(id) {
          return reference(`${name}/${id}`);
        },
        select() {
          throw new Error('Collection scans are not used in this test.');
        },
        where() {
          throw new Error('Queries are not used in this test.');
        },
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async getAll(...refs) {
          return refs.map(snapshotFor);
        },
        set(ref, data) {
          writes.push({ ref, data });
          return transaction;
        },
      };
      const result = await callback(transaction);
      for (const write of writes) {
        documents.set(write.ref.path, {
          ...(documents.get(write.ref.path) || {}),
          ...write.data,
        });
      }
      return result;
    },
  };

  return { db, documents, reference };
}

test('launch template has exact Unicode copy, safe personalisation, CTA and fallback text', () => {
  const betaUrl = 'https://beta.bloom.example/access';
  const personalised = buildBetaLaunchEmail({
    firstName: '  A&B <Founder>  ',
    betaUrl,
  });
  const fallback = buildBetaLaunchEmail({ betaUrl });

  assert.equal(BETA_LAUNCH_SUBJECT, 'Bloom Beta Is Live — A Promise Kept 🌷');
  assert.equal(personalised.subject, BETA_LAUNCH_SUBJECT);
  assert.match(personalised.html, /Hello A&amp;B &lt;Founder&gt;,/);
  assert.doesNotMatch(personalised.html, /Hello A&B <Founder>,/);
  assert.match(personalised.html, new RegExp(`href="${betaUrl}"`));
  assert.match(personalised.html, />Open Bloom Beta</);
  assert.match(personalised.text, new RegExp(`Open Bloom Beta: ${betaUrl}`));
  assert.match(fallback.html, /Hello,/);
  assert.match(fallback.text, /^Hello,/);
  assert.match(personalised.html, /<meta charset="utf-8">/);
  assert.match(personalised.html, /@media only screen and \(max-width: 620px\)/);
  assert.doesNotMatch(personalised.html, /<script|<form|tracking pixel/i);
  assert.doesNotMatch(
    `${personalised.subject}${personalised.html}${personalised.text}`,
    /â€”|â€™|ðŸ|�/
  );
});

test('Beta URL validation rejects unsafe and non-HTTPS send links', () => {
  assert.equal(
    validateBetaUrl('https://beta.bloom.example'),
    'https://beta.bloom.example/'
  );
  assert.throws(() => validateBetaUrl('http://beta.bloom.example'), /HTTPS/);
  assert.throws(() => validateBetaUrl('javascript:alert(1)'), /HTTP/);
  assert.throws(
    () => validateBetaUrl('https://user:pass@beta.bloom.example'),
    /embedded credentials/
  );
});

test('waitlist classification uses strict consent, suppresses sent users, and deduplicates email', () => {
  const result = classifyWaitlistRecords([
    { email: 'alice@example.com', firstName: 'Alice', consent: true },
    { email: ' ALICE@example.com ', consent: true },
    { email: 'bob@example.com', consent: true, betaEmailSent: true },
    { email: 'carol@example.com', consent: false },
    { email: 'dave@example.com', consent: 'true' },
    { email: 'not-an-email', consent: true },
  ]);

  assert.deepEqual(result.summary, {
    totalWaitlistRecords: 6,
    eligibleRecipients: 1,
    alreadySent: 1,
    missingConsent: 2,
    invalidEmails: 1,
    duplicateEligibleRecords: 1,
  });
  assert.equal(result.recipients[0].email, 'alice@example.com');
  assert.equal(result.recipients[0].firstName, 'Alice');
  assert.match(formatLaunchSummary(result.summary), /Eligible recipients: 1/);
});

test('recipient hashes and provider idempotency keys are stable and contain no email', () => {
  const first = hashRecipientEmail(' Person@Example.com ');
  const second = hashRecipientEmail('person@example.com');
  const key = createProviderIdempotencyKey(first);

  assert.equal(first, second);
  assert.equal(key, `${BETA_LAUNCH_CAMPAIGN_ID}_${first}`);
  assert.doesNotMatch(key, /person|example/i);
  assert.equal(maskEmail('person@example.com'), 'p***@example.com');
});

test('Resend adapter sends HTML and text with a provider idempotency key', async () => {
  let request;
  const provider = createResendEmailProvider({
    apiKey: 'server-secret-key',
    fromName: 'Bloom',
    fromAddress: 'beta@bloom.example',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return { id: 'provider-message-123' };
        },
      };
    },
  });

  const result = await provider.send({
    to: 'person@example.com',
    subject: BETA_LAUNCH_SUBJECT,
    html: '<p>Hello</p>',
    text: 'Hello',
    idempotencyKey: `${BETA_LAUNCH_CAMPAIGN_ID}_${'a'.repeat(64)}`,
  });
  const payload = JSON.parse(request.options.body);

  assert.equal(request.url, RESEND_EMAIL_ENDPOINT);
  assert.equal(request.options.headers.Authorization, 'Bearer server-secret-key');
  assert.equal(
    request.options.headers['Idempotency-Key'],
    `${BETA_LAUNCH_CAMPAIGN_ID}_${'a'.repeat(64)}`
  );
  assert.deepEqual(payload.to, ['person@example.com']);
  assert.equal(payload.from, 'Bloom <beta@bloom.example>');
  assert.equal(payload.html, '<p>Hello</p>');
  assert.equal(payload.text, 'Hello');
  assert.doesNotMatch(request.options.body, /server-secret-key/);
  assert.deepEqual(result, { id: 'provider-message-123' });
});

test('provider errors are sanitized and authentication failures stop the batch', async () => {
  const provider = createResendEmailProvider({
    apiKey: 'server-secret-key',
    fromName: 'Bloom',
    fromAddress: 'beta@bloom.example',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return { raw: 'must never be retained' };
      },
    }),
  });

  await assert.rejects(
    provider.send({
      to: 'person@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
      idempotencyKey: `${BETA_LAUNCH_CAMPAIGN_ID}_${'b'.repeat(64)}`,
    }),
    (error) => {
      assert.equal(error.code, 'provider_authentication_failed');
      assert.equal(error.stopBatch, true);
      assert.doesNotMatch(error.message, /secret|retained/);
      return true;
    }
  );
  assert.equal(sanitizeErrorCode('raw provider response'), 'provider_unavailable');
});

test('dry-test queries only the explicit email and performs no sends or writes', async () => {
  const calls = { loadAll: 0, loadByEmail: [], claim: 0, send: 0 };
  const logger = createLogger();
  const repository = {
    async loadAll() {
      calls.loadAll += 1;
      return [];
    },
    async loadByEmail(email) {
      calls.loadByEmail.push(email);
      return [{ email, consent: true, firstName: 'Test' }];
    },
    async claimRecipient() {
      calls.claim += 1;
      throw new Error('Dry run must not claim.');
    },
  };
  const provider = {
    async send() {
      calls.send += 1;
    },
  };

  const result = await runBetaLaunchCampaign({
    repository,
    provider,
    mode: 'test',
    explicitEmail: ' TEST@EXAMPLE.COM ',
    dryRun: true,
    logger,
  });

  assert.equal(calls.loadAll, 0);
  assert.deepEqual(calls.loadByEmail, ['test@example.com']);
  assert.equal(calls.claim, 0);
  assert.equal(calls.send, 0);
  assert.equal(result.dryRun, true);
  assert.ok(logger.output.some((line) => line.includes('t***@example.com')));
  assert.ok(logger.output.every((line) => !line.includes('test@example.com')));
});

test('confirmed campaign sends one email for duplicate records and finalizes success', async () => {
  const calls = { send: 0, sent: 0, failed: 0 };
  const logger = createLogger();
  const repository = {
    async loadAll() {
      return [
        { email: 'person@example.com', consent: true, firstName: 'Priya' },
        { email: ' PERSON@example.com ', consent: true },
      ];
    },
    async claimRecipient(_recipient, claim) {
      return {
        status: 'claimed',
        attemptId: claim.attemptId,
        firstName: 'Priya',
      };
    },
    async markSent(_recipient, _claim, result) {
      calls.sent += 1;
      assert.equal(result.providerMessageId, 'message-1');
    },
    async markFailed() {
      calls.failed += 1;
    },
  };
  const provider = {
    async send(message) {
      calls.send += 1;
      assert.equal(message.to, 'person@example.com');
      assert.match(message.html, /Hello Priya,/);
      return { id: 'message-1' };
    },
  };

  const result = await runBetaLaunchCampaign({
    repository,
    provider,
    mode: 'production',
    betaUrl: 'https://beta.bloom.example/access',
    confirmed: true,
    logger,
    sleepImpl: async () => {
      throw new Error('One unique recipient should not require a delay.');
    },
  });

  assert.equal(calls.send, 1);
  assert.equal(calls.sent, 1);
  assert.equal(calls.failed, 0);
  assert.equal(result.sent, 1);
});

test('failed provider send records only a safe failure and never marks sent', async () => {
  const calls = { sent: 0, failureCode: '' };
  const logger = createLogger();
  const repository = {
    async loadByEmail(email) {
      return [{ email, consent: true }];
    },
    async claimRecipient(_recipient, claim) {
      return { status: 'claimed', attemptId: claim.attemptId, firstName: '' };
    },
    async markSent() {
      calls.sent += 1;
    },
    async markFailed(_recipient, _claim, failure) {
      calls.failureCode = failure.errorCode;
    },
  };
  const provider = {
    async send() {
      throw new EmailProviderError('provider_rejected');
    },
  };

  const result = await runBetaLaunchCampaign({
    repository,
    provider,
    mode: 'test',
    explicitEmail: 'person@example.com',
    betaUrl: 'https://beta.bloom.example/access',
    confirmed: true,
    logger,
  });

  assert.equal(result.failed, 1);
  assert.equal(calls.sent, 0);
  assert.equal(calls.failureCode, 'provider_rejected');
});

test('Firestore ledger blocks a concurrent claim and success marks every duplicate document', async () => {
  const memory = createMemoryFirestore({
    'bloom_waitlist/one': {
      email: 'person@example.com',
      firstName: 'Priya',
      consent: true,
    },
    'bloom_waitlist/two': {
      email: 'person@example.com',
      consent: true,
    },
  });
  const repository = createFirestoreBetaLaunchRepository({
    db: memory.db,
    now: () => 1000,
    claimLeaseMs: 60000,
  });
  const recipient = {
    email: 'person@example.com',
    records: [
      { ref: memory.reference('bloom_waitlist/one') },
      { ref: memory.reference('bloom_waitlist/two') },
    ],
  };
  const emailHash = hashRecipientEmail(recipient.email);
  const firstClaim = await repository.claimRecipient(recipient, {
    campaignId: BETA_LAUNCH_CAMPAIGN_ID,
    emailHash,
    attemptId: 'attempt-one',
    idempotencyKey: createProviderIdempotencyKey(emailHash),
  });
  const concurrentClaim = await repository.claimRecipient(recipient, {
    campaignId: BETA_LAUNCH_CAMPAIGN_ID,
    emailHash,
    attemptId: 'attempt-two',
    idempotencyKey: createProviderIdempotencyKey(emailHash),
  });

  assert.equal(firstClaim.status, 'claimed');
  assert.equal(firstClaim.firstName, 'Priya');
  assert.equal(concurrentClaim.status, 'in-progress');

  await repository.markSent(recipient, firstClaim, {
    providerMessageId: 'provider-message-1',
  });
  assert.equal(memory.documents.get('bloom_waitlist/one').betaEmailSent, true);
  assert.equal(memory.documents.get('bloom_waitlist/two').betaEmailSent, true);
  assert.equal(
    memory.documents.get('bloom_waitlist/one').betaEmailProviderId,
    'provider-message-1'
  );
});

test('CLI modes require explicit scope, valid email and confirmation', () => {
  const dryTest = validateCliOptions(
    parseCliArgs([
      '--mode=test',
      '--dry-run',
      '--email',
      ' Test@Example.com ',
    ])
  );
  assert.equal(dryTest.mode, 'test');
  assert.equal(dryTest.email, 'test@example.com');
  assert.equal(dryTest.dryRun, true);

  assert.throws(
    () => validateCliOptions(parseCliArgs(['--mode=test', '--confirm'])),
    /valid --email/
  );
  assert.throws(
    () => validateCliOptions(parseCliArgs(['--mode=production'])),
    /--confirm/
  );
  assert.throws(() => parseCliArgs(['--surprise']), /Unknown argument/);
});

test('send configuration is server-only, HTTPS, and CLI errors redact unknown details', () => {
  const config = readSendConfiguration({
    BLOOM_BETA_URL: 'https://beta.bloom.example',
    EMAIL_FROM_NAME: 'Bloom',
    EMAIL_FROM_ADDRESS: 'beta@bloom.example',
    EMAIL_PROVIDER_API_KEY: 'secret',
  });

  assert.equal(config.betaUrl, 'https://beta.bloom.example/');
  assert.equal(config.apiKey, 'secret');
  assert.equal(
    safeCliError(new Error('private provider response for person@example.com')),
    'Launch-email command failed (unknown).'
  );
});
