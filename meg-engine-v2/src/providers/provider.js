class ProviderError extends Error {
  constructor(message, { provider, status, retryable = true, code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    this.code = code;
  }
}

function providerHeaders(base = {}) {
  return { Accept: 'text/event-stream, application/json', 'Content-Type': 'application/json', ...base };
}

function classifyStatus(status) {
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(Number(status))) return { retryable: true };
  if (Number(status) >= 400 && Number(status) < 500) return { retryable: false };
  return { retryable: true };
}

function normalizeError(error, provider, fallbackCode = 'PROVIDER_ERROR') {
  if (error instanceof ProviderError) return error;
  if (error?.name === 'AbortError') return new ProviderError('provider request timed out or was cancelled', { provider, retryable: true, code: 'TIMEOUT', cause: error });
  const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : undefined;
  return new ProviderError(error?.message || 'provider request failed', {
    provider,
    status,
    retryable: status ? classifyStatus(status).retryable : true,
    code: error?.code || fallbackCode,
    cause: error,
  });
}

async function assertOk(response, provider) {
  if (response.ok) return response;
  let body = '';
  try { body = await response.text(); } catch {}
  const { retryable } = classifyStatus(response.status);
  throw new ProviderError(`${provider} returned HTTP ${response.status}`, { provider, status: response.status, retryable, code: body.slice(0, 160) || 'HTTP_ERROR' });
}

function parseOpenAiToken(json) {
  return json?.choices?.[0]?.delta?.content || '';
}

module.exports = { ProviderError, providerHeaders, assertOk, normalizeError, classifyStatus, parseOpenAiToken };
