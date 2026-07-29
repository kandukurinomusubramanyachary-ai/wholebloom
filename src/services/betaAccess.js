const DEFAULT_BLOOM_API_BASE_URL = 'http://127.0.0.1:3001';
const BETA_CHECK_TIMEOUT_MS = 15000;

function bloomApiBaseUrl() {
  const configured =
    process.env.EXPO_PUBLIC_BLOOM_API_URL
    || process.env.EXPO_PUBLIC_MEG_API_URL;
  return String(configured || DEFAULT_BLOOM_API_BASE_URL).replace(/\/+$/, '');
}

export function normalizeBetaEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidBetaEmail(value) {
  const email = normalizeBetaEmail(value);
  if (!email || email.length > 254) return false;

  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== email.indexOf('@')) return false;

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (
    localPart.length > 64
    || domain.length > 253
    || localPart.startsWith('.')
    || localPart.endsWith('.')
    || localPart.includes('..')
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)
    || !domain.includes('.')
  ) {
    return false;
  }

  return domain.split('.').every(
    (label) =>
      label.length > 0
      && label.length <= 63
      && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

export class BetaAccessError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'BetaAccessError';
    this.code = code;
    this.cause = cause;
  }
}

export async function checkBetaEmail(
  email,
  {
    baseUrl = bloomApiBaseUrl(),
    timeoutMs = BETA_CHECK_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = {}
) {
  const normalizedEmail = normalizeBetaEmail(email);
  if (!isValidBetaEmail(normalizedEmail)) {
    throw new BetaAccessError('invalid-email', 'Enter a valid email address.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/api/beta/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 400) {
      throw new BetaAccessError('invalid-email', 'Enter a valid email address.');
    }
    if (!response.ok) {
      throw new BetaAccessError(
        'server-error',
        'We could not check Beta access right now. Please try again.'
      );
    }
    if (
      typeof payload?.eligible !== 'boolean'
      || Object.keys(payload).length !== 1
    ) {
      throw new BetaAccessError(
        'server-error',
        'We could not check Beta access right now. Please try again.'
      );
    }

    return payload.eligible;
  } catch (error) {
    if (error instanceof BetaAccessError) throw error;
    throw new BetaAccessError(
      'server-error',
      'We could not check Beta access right now. Please try again.',
      error
    );
  } finally {
    clearTimeout(timeout);
  }
}
