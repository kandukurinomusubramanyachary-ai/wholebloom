const SAFE_CONTEXT_KEYS = new Set([
  'hasUser',
  'hasDate',
  'hasExistingCheckin',
  'isEditing',
  'source',
  'result',
  'stage',
]);

function diagnosticsEnabled() {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

function sanitizeErrorText(value) {
  return String(value || '')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){1,2}\b/g, '[redacted-token]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/[^\s)]+/gi, '[redacted-url]')
    .slice(0, 1600);
}

export function logCheckinEvent(event, context = {}, error = null) {
  if (!diagnosticsEnabled() || typeof console === 'undefined') return;

  const safeContext = {};
  Object.entries(context).forEach(([key, value]) => {
    if (SAFE_CONTEXT_KEYS.has(key) && ['string', 'boolean', 'number'].includes(typeof value)) {
      safeContext[key] = value;
    }
  });

  const payload = { event, ...safeContext };
  if (error) {
    payload.errorName = typeof error.name === 'string' ? error.name : 'Error';
    payload.errorMessage = sanitizeErrorText(error.message || 'Unknown check-in error');
    payload.stack = sanitizeErrorText(error.stack || 'Stack unavailable');
  }

  const writer = error && typeof console.error === 'function'
    ? console.error
    : console.info;
  if (typeof writer === 'function') writer('[Bloom check-in]', payload);
}
