const { createHash, randomUUID } = require('node:crypto');
const {
  isValidBetaEmail,
  normalizeBetaEmail,
} = require('../betaAccess');
const { buildBetaLaunchEmail } = require('./template');

const BETA_LAUNCH_CAMPAIGN_ID = 'bloom-beta-launch-v1';
const DEFAULT_BATCH_DELAY_MS = 600;

function hashRecipientEmail(email) {
  const normalizedEmail = normalizeBetaEmail(email);
  if (!isValidBetaEmail(normalizedEmail)) {
    throw new Error('A valid recipient email is required.');
  }
  return createHash('sha256').update(normalizedEmail).digest('hex');
}

function createProviderIdempotencyKey(emailHash) {
  if (!/^[a-f0-9]{64}$/.test(emailHash)) {
    throw new Error('A valid recipient hash is required.');
  }
  return `${BETA_LAUNCH_CAMPAIGN_ID}_${emailHash}`;
}

function maskEmail(email) {
  const normalizedEmail = normalizeBetaEmail(email);
  const atIndex = normalizedEmail.indexOf('@');
  if (atIndex <= 0) return '[invalid email]';

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);
  const maskedLocal =
    localPart.length === 1 ? '*' : `${localPart[0]}${'*'.repeat(Math.min(3, localPart.length - 1))}`;
  return `${maskedLocal}@${domain}`;
}

function classifyWaitlistRecords(records) {
  const groups = new Map();
  let invalidEmails = 0;

  for (const record of records) {
    const normalizedEmail = normalizeBetaEmail(record?.email);
    if (!isValidBetaEmail(normalizedEmail)) {
      invalidEmails += 1;
      continue;
    }

    const group = groups.get(normalizedEmail) || [];
    group.push(record);
    groups.set(normalizedEmail, group);
  }

  const recipients = [];
  let alreadySent = 0;
  let missingConsent = 0;
  let duplicateEligibleRecords = 0;

  for (const [email, groupRecords] of groups.entries()) {
    if (groupRecords.some((record) => record.betaEmailSent === true)) {
      alreadySent += 1;
      continue;
    }

    const consentingRecords = groupRecords.filter((record) => record.consent === true);
    if (!consentingRecords.length) {
      missingConsent += 1;
      continue;
    }

    duplicateEligibleRecords += Math.max(0, consentingRecords.length - 1);
    const firstNameRecord = consentingRecords.find(
      (record) => typeof record.firstName === 'string' && record.firstName.trim()
    );

    recipients.push({
      email,
      firstName: firstNameRecord?.firstName || '',
      records: groupRecords,
    });
  }

  return {
    recipients,
    summary: {
      totalWaitlistRecords: records.length,
      eligibleRecipients: recipients.length,
      alreadySent,
      missingConsent,
      invalidEmails,
      duplicateEligibleRecords,
    },
  };
}

function formatLaunchSummary(summary) {
  return [
    'Bloom Beta launch-email summary',
    `Total waitlist records: ${summary.totalWaitlistRecords}`,
    `Eligible recipients: ${summary.eligibleRecipients}`,
    `Already sent: ${summary.alreadySent}`,
    `Missing consent: ${summary.missingConsent}`,
    `Invalid email addresses: ${summary.invalidEmails}`,
    `Duplicate eligible records collapsed: ${summary.duplicateEligibleRecords}`,
  ].join('\n');
}

function clampDelay(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_DELAY_MS;
  return Math.min(10000, Math.max(250, Math.round(parsed)));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loadCampaignRecords({ repository, mode, explicitEmail }) {
  if (mode === 'test') {
    const normalizedEmail = normalizeBetaEmail(explicitEmail);
    if (!isValidBetaEmail(normalizedEmail)) {
      throw new Error('Test mode requires one valid --email address.');
    }
    return repository.loadByEmail(normalizedEmail);
  }
  if (mode === 'production') {
    return repository.loadAll();
  }
  throw new Error('Mode must be either test or production.');
}

async function runBetaLaunchCampaign({
  repository,
  provider,
  mode,
  explicitEmail,
  betaUrl,
  dryRun = false,
  confirmed = false,
  delayMs = DEFAULT_BATCH_DELAY_MS,
  logger = console,
  sleepImpl = sleep,
  shouldStop = () => false,
} = {}) {
  if (!repository) throw new Error('A launch-email repository is required.');
  if (!dryRun && !confirmed) {
    throw new Error('Sending requires the explicit --confirm argument.');
  }
  if (!dryRun && !provider) {
    throw new Error('An email provider is required when sending.');
  }

  const records = await loadCampaignRecords({ repository, mode, explicitEmail });
  const { recipients, summary } = classifyWaitlistRecords(records);
  logger.log(formatLaunchSummary(summary));

  if (mode === 'test' && records.length === 0) {
    throw new Error('No waitlist record matched the supplied test email.');
  }

  if (dryRun) {
    logger.log('Dry run only: no email will be sent and Firestore will not be modified.');
    if (recipients.length) {
      logger.log('Intended recipients:');
      recipients.forEach((recipient) => logger.log(`- ${maskEmail(recipient.email)}`));
    }
    return {
      mode,
      dryRun: true,
      summary,
      sent: 0,
      failed: 0,
      skipped: 0,
      interrupted: false,
    };
  }

  const result = {
    mode,
    dryRun: false,
    summary,
    sent: 0,
    failed: 0,
    skipped: 0,
    interrupted: false,
  };
  const boundedDelayMs = clampDelay(delayMs);

  for (let index = 0; index < recipients.length; index += 1) {
    if (shouldStop()) {
      result.interrupted = true;
      break;
    }

    const recipient = recipients[index];
    const emailHash = hashRecipientEmail(recipient.email);
    const attemptId = randomUUID();
    const idempotencyKey = createProviderIdempotencyKey(emailHash);

    const claim = await repository.claimRecipient(recipient, {
      campaignId: BETA_LAUNCH_CAMPAIGN_ID,
      emailHash,
      attemptId,
      idempotencyKey,
    });

    if (claim.status !== 'claimed') {
      result.skipped += 1;
      logger.log(`Skipped ${maskEmail(recipient.email)} (${claim.status}).`);
      continue;
    }

    const email = buildBetaLaunchEmail({
      firstName: claim.firstName,
      betaUrl,
    });

    try {
      const providerResult = await provider.send({
        to: recipient.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey,
      });

      try {
        await repository.markSent(recipient, claim, {
          providerMessageId: providerResult.id,
        });
      } catch {
        throw new Error('firestore_finalize_failed');
      }

      result.sent += 1;
      logger.log(`Sent ${maskEmail(recipient.email)}.`);
    } catch (error) {
      if (error?.message === 'firestore_finalize_failed') {
        throw error;
      }

      const safeErrorCode =
        typeof error?.code === 'string' ? error.code : 'provider_unavailable';
      try {
        await repository.markFailed(recipient, claim, {
          errorCode: safeErrorCode,
        });
      } catch {
        throw new Error('firestore_failure_update_failed');
      }

      result.failed += 1;
      logger.error(`Failed ${maskEmail(recipient.email)} (${safeErrorCode}).`);
      if (error?.stopBatch) {
        throw new Error(`email_batch_stopped:${safeErrorCode}`);
      }
    }

    if (
      mode === 'production'
      && index < recipients.length - 1
      && !shouldStop()
    ) {
      await sleepImpl(boundedDelayMs);
    }
  }

  return result;
}

module.exports = {
  BETA_LAUNCH_CAMPAIGN_ID,
  DEFAULT_BATCH_DELAY_MS,
  hashRecipientEmail,
  createProviderIdempotencyKey,
  maskEmail,
  classifyWaitlistRecords,
  formatLaunchSummary,
  clampDelay,
  loadCampaignRecords,
  runBetaLaunchCampaign,
};
