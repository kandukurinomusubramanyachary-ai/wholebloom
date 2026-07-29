const { isValidBetaEmail, normalizeBetaEmail } = require('../betaAccess');

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_PROVIDER_TIMEOUT_MS = 15000;
const PROVIDER_ERROR_CODES = new Set([
  'provider_authentication_failed',
  'provider_rejected',
  'provider_rate_limited',
  'provider_unavailable',
  'network_timeout',
  'invalid_provider_response',
]);

class EmailProviderError extends Error {
  constructor(code, { statusCode, stopBatch = false } = {}) {
    super(code);
    this.name = 'EmailProviderError';
    this.code = PROVIDER_ERROR_CODES.has(code) ? code : 'provider_unavailable';
    this.statusCode = Number.isInteger(statusCode) ? statusCode : undefined;
    this.stopBatch = Boolean(stopBatch);
  }
}

function validateHeaderValue(value, fieldName) {
  if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) {
    throw new Error(`${fieldName} must be a non-empty single-line value.`);
  }
  return value.trim();
}

function validateProviderConfig({ apiKey, fromName, fromAddress }) {
  const cleanApiKey = validateHeaderValue(apiKey, 'EMAIL_PROVIDER_API_KEY');
  const cleanFromName = validateHeaderValue(fromName, 'EMAIL_FROM_NAME');
  const cleanFromAddress = normalizeBetaEmail(fromAddress);

  if (!isValidBetaEmail(cleanFromAddress) || /[\r\n]/.test(String(fromAddress))) {
    throw new Error('EMAIL_FROM_ADDRESS must be a valid email address.');
  }

  return {
    apiKey: cleanApiKey,
    fromName: cleanFromName,
    fromAddress: cleanFromAddress,
  };
}

function providerErrorFromStatus(statusCode) {
  if (statusCode === 401 || statusCode === 403) {
    return new EmailProviderError('provider_authentication_failed', {
      statusCode,
      stopBatch: true,
    });
  }
  if (statusCode === 429) {
    return new EmailProviderError('provider_rate_limited', {
      statusCode,
      stopBatch: true,
    });
  }
  if (statusCode >= 400 && statusCode < 500) {
    return new EmailProviderError('provider_rejected', { statusCode });
  }
  return new EmailProviderError('provider_unavailable', {
    statusCode,
    stopBatch: true,
  });
}

function createResendEmailProvider({
  apiKey,
  fromName,
  fromAddress,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('The launch-email provider requires Node.js fetch support.');
  }

  const config = validateProviderConfig({ apiKey, fromName, fromAddress });

  return {
    async send({ to, subject, html, text, idempotencyKey }) {
      const normalizedTo = normalizeBetaEmail(to);
      if (!isValidBetaEmail(normalizedTo)) {
        throw new Error('A valid recipient email is required.');
      }
      if (
        typeof idempotencyKey !== 'string'
        || !/^[a-zA-Z0-9:_-]{1,256}$/.test(idempotencyKey)
      ) {
        throw new Error('A valid provider idempotency key is required.');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let response;
        try {
          response = await fetchImpl(RESEND_EMAIL_ENDPOINT, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
              'User-Agent': 'Bloom-Beta-Launch/1.0',
            },
            body: JSON.stringify({
              from: `${config.fromName} <${config.fromAddress}>`,
              to: [normalizedTo],
              subject,
              html,
              text,
            }),
            signal: controller.signal,
          });
        } catch (error) {
          if (error?.name === 'AbortError') {
            throw new EmailProviderError('network_timeout', { stopBatch: true });
          }
          throw new EmailProviderError('provider_unavailable', { stopBatch: true });
        }

        if (!response.ok) {
          throw providerErrorFromStatus(response.status);
        }

        let providerResult;
        try {
          providerResult = await response.json();
        } catch {
          throw new EmailProviderError('invalid_provider_response', {
            statusCode: response.status,
            stopBatch: true,
          });
        }

        const providerMessageId =
          typeof providerResult?.id === 'string' ? providerResult.id.trim() : '';
        if (
          !providerMessageId
          || providerMessageId.length > 256
          || /[\u0000-\u001f\u007f]/.test(providerMessageId)
        ) {
          throw new EmailProviderError('invalid_provider_response', {
            statusCode: response.status,
            stopBatch: true,
          });
        }

        return { id: providerMessageId };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = {
  RESEND_EMAIL_ENDPOINT,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  PROVIDER_ERROR_CODES,
  EmailProviderError,
  validateProviderConfig,
  providerErrorFromStatus,
  createResendEmailProvider,
};
