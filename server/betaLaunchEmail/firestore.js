const {
  FieldValue,
  Timestamp,
} = require('firebase-admin/firestore');
const {
  WAITLIST_COLLECTION,
  getBetaFirestore,
  isValidBetaEmail,
  normalizeBetaEmail,
} = require('../betaAccess');

const DELIVERY_LEDGER_COLLECTION = 'bloom_beta_email_deliveries';
const DEFAULT_CLAIM_LEASE_MS = 15 * 60 * 1000;
const WAITLIST_FIELDS = [
  'firstName',
  'email',
  'consent',
  'betaEmailSent',
  'betaEmailSentAt',
  'betaEmailProviderId',
  'betaEmailLastError',
  'betaEmailLastAttemptAt',
  'betaEmailSendClaimId',
  'betaEmailSendClaimExpiresAt',
];
const SAFE_ERROR_CODES = new Set([
  'provider_authentication_failed',
  'provider_rejected',
  'provider_rate_limited',
  'provider_unavailable',
  'network_timeout',
  'invalid_provider_response',
]);

function documentToRecord(documentSnapshot) {
  const data = documentSnapshot.data() || {};
  return {
    ref: documentSnapshot.ref,
    firstName: data.firstName,
    email: data.email,
    consent: data.consent,
    betaEmailSent: data.betaEmailSent,
    betaEmailSentAt: data.betaEmailSentAt,
    betaEmailProviderId: data.betaEmailProviderId,
    betaEmailLastError: data.betaEmailLastError,
    betaEmailLastAttemptAt: data.betaEmailLastAttemptAt,
    betaEmailSendClaimId: data.betaEmailSendClaimId,
    betaEmailSendClaimExpiresAt: data.betaEmailSendClaimExpiresAt,
  };
}

function timestampToMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number.isFinite(value) ? Number(value) : 0;
}

function sanitizeProviderMessageId(value) {
  const providerMessageId = typeof value === 'string' ? value.trim() : '';
  if (
    !providerMessageId
    || providerMessageId.length > 256
    || /[\u0000-\u001f\u007f]/.test(providerMessageId)
  ) {
    throw new Error('The email provider returned an invalid message ID.');
  }
  return providerMessageId;
}

function sanitizeErrorCode(value) {
  return SAFE_ERROR_CODES.has(value) ? value : 'provider_unavailable';
}

function uniqueDocumentReferences(records) {
  const references = new Map();
  for (const record of records || []) {
    const reference = record?.ref;
    if (reference && typeof reference.path === 'string') {
      references.set(reference.path, reference);
    }
  }
  return [...references.values()];
}

function createFirestoreBetaLaunchRepository({
  db = getBetaFirestore(),
  now = () => Date.now(),
  claimLeaseMs = DEFAULT_CLAIM_LEASE_MS,
} = {}) {
  const waitlist = db.collection(WAITLIST_COLLECTION);
  const deliveryLedger = db.collection(DELIVERY_LEDGER_COLLECTION);

  async function loadAll() {
    const snapshot = await waitlist.select(...WAITLIST_FIELDS).get();
    return snapshot.docs.map(documentToRecord);
  }

  async function loadByEmail(email) {
    const normalizedEmail = normalizeBetaEmail(email);
    if (!isValidBetaEmail(normalizedEmail)) {
      throw new Error('A valid normalized test email is required.');
    }

    const snapshot = await waitlist
      .where('email', '==', normalizedEmail)
      .select(...WAITLIST_FIELDS)
      .get();
    return snapshot.docs.map(documentToRecord);
  }

  async function claimRecipient(
    recipient,
    { campaignId, emailHash, attemptId, idempotencyKey }
  ) {
    const documentReferences = uniqueDocumentReferences(recipient.records);
    if (!documentReferences.length) {
      throw new Error('The recipient has no waitlist document references.');
    }

    const ledgerReference = deliveryLedger.doc(`${campaignId}_${emailHash}`);
    const currentTime = now();
    const leaseExpiresAt = Timestamp.fromMillis(currentTime + claimLeaseMs);

    return db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(
        ledgerReference,
        ...documentReferences
      );
      const ledgerSnapshot = snapshots[0];
      const waitlistSnapshots = snapshots.slice(1).filter((snapshot) => snapshot.exists);
      const ledger = ledgerSnapshot.exists ? ledgerSnapshot.data() : {};

      if (ledger.status === 'sent') {
        return { status: 'already-sent' };
      }

      if (waitlistSnapshots.some((snapshot) => snapshot.data()?.betaEmailSent === true)) {
        transaction.set(
          ledgerReference,
          {
            campaignId,
            recipientHash: emailHash,
            status: 'sent',
            source: 'waitlist',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return { status: 'already-sent' };
      }

      const activeClaim =
        ledger.status === 'sending'
        && ledger.attemptId !== attemptId
        && timestampToMillis(ledger.leaseExpiresAt) > currentTime;
      if (activeClaim) {
        return { status: 'in-progress' };
      }

      const eligibleSnapshots = waitlistSnapshots.filter((snapshot) => {
        const data = snapshot.data() || {};
        return normalizeBetaEmail(data.email) === recipient.email
          && isValidBetaEmail(data.email)
          && data.consent === true
          && data.betaEmailSent !== true;
      });
      if (!eligibleSnapshots.length) {
        return { status: 'no-longer-eligible' };
      }

      transaction.set(
        ledgerReference,
        {
          campaignId,
          recipientHash: emailHash,
          status: 'sending',
          attemptId,
          idempotencyKey,
          leaseExpiresAt,
          lastAttemptAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      for (const snapshot of eligibleSnapshots) {
        transaction.set(
          snapshot.ref,
          {
            betaEmailSendClaimId: attemptId,
            betaEmailSendClaimExpiresAt: leaseExpiresAt,
            betaEmailLastAttemptAt: FieldValue.serverTimestamp(),
            betaEmailLastError: FieldValue.delete(),
          },
          { merge: true }
        );
      }

      const firstNameSnapshot = eligibleSnapshots.find((snapshot) => {
        const firstName = snapshot.data()?.firstName;
        return typeof firstName === 'string' && firstName.trim();
      });

      return {
        status: 'claimed',
        attemptId,
        ledgerReference,
        recordReferences: eligibleSnapshots.map((snapshot) => snapshot.ref),
        firstName: firstNameSnapshot?.data()?.firstName || '',
      };
    });
  }

  async function markSent(_recipient, claim, { providerMessageId }) {
    const cleanProviderMessageId = sanitizeProviderMessageId(providerMessageId);
    const references = claim.recordReferences || [];

    await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(
        claim.ledgerReference,
        ...references
      );
      const ledgerSnapshot = snapshots[0];
      const ledger = ledgerSnapshot.exists ? ledgerSnapshot.data() : {};

      if (
        ledger.status === 'sent'
        && ledger.providerMessageId === cleanProviderMessageId
      ) {
        return;
      }
      if (ledger.status !== 'sending' || ledger.attemptId !== claim.attemptId) {
        throw new Error('The launch-email claim is no longer current.');
      }

      const claimedSnapshots = snapshots.slice(1).filter(
        (snapshot) =>
          snapshot.exists
          && snapshot.data()?.betaEmailSendClaimId === claim.attemptId
      );
      if (!claimedSnapshots.length) {
        throw new Error('No claimed waitlist records remain.');
      }

      for (const snapshot of claimedSnapshots) {
        transaction.set(
          snapshot.ref,
          {
            betaEmailSent: true,
            betaEmailSentAt: FieldValue.serverTimestamp(),
            betaEmailProviderId: cleanProviderMessageId,
            betaEmailLastError: FieldValue.delete(),
            betaEmailSendClaimId: FieldValue.delete(),
            betaEmailSendClaimExpiresAt: FieldValue.delete(),
          },
          { merge: true }
        );
      }

      transaction.set(
        claim.ledgerReference,
        {
          status: 'sent',
          providerMessageId: cleanProviderMessageId,
          sentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          attemptId: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete(),
          lastError: FieldValue.delete(),
        },
        { merge: true }
      );
    });
  }

  async function markFailed(_recipient, claim, { errorCode }) {
    const safeErrorCode = sanitizeErrorCode(errorCode);
    const references = claim.recordReferences || [];

    await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(
        claim.ledgerReference,
        ...references
      );
      const ledgerSnapshot = snapshots[0];
      const ledger = ledgerSnapshot.exists ? ledgerSnapshot.data() : {};
      if (ledger.status !== 'sending' || ledger.attemptId !== claim.attemptId) {
        return;
      }

      for (const snapshot of snapshots.slice(1)) {
        if (
          snapshot.exists
          && snapshot.data()?.betaEmailSendClaimId === claim.attemptId
        ) {
          transaction.set(
            snapshot.ref,
            {
              betaEmailLastError: safeErrorCode,
              betaEmailLastAttemptAt: FieldValue.serverTimestamp(),
              betaEmailSendClaimId: FieldValue.delete(),
              betaEmailSendClaimExpiresAt: FieldValue.delete(),
            },
            { merge: true }
          );
        }
      }

      transaction.set(
        claim.ledgerReference,
        {
          status: 'failed',
          lastError: safeErrorCode,
          lastAttemptAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          attemptId: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete(),
        },
        { merge: true }
      );
    });
  }

  return {
    loadAll,
    loadByEmail,
    claimRecipient,
    markSent,
    markFailed,
  };
}

module.exports = {
  DELIVERY_LEDGER_COLLECTION,
  DEFAULT_CLAIM_LEASE_MS,
  WAITLIST_FIELDS,
  SAFE_ERROR_CODES,
  documentToRecord,
  timestampToMillis,
  sanitizeProviderMessageId,
  sanitizeErrorCode,
  uniqueDocumentReferences,
  createFirestoreBetaLaunchRepository,
};
