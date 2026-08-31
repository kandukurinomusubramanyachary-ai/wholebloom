function extractApiKey(req) {
  const authorization = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return String(req.headers['x-meg-api-key'] || '').trim();
}

function authenticateRequest(req, { apiKey = '' } = {}) {
  if (!apiKey) return { ok: true, mode: 'disabled' };
  const supplied = extractApiKey(req);
  if (!supplied || supplied.length !== apiKey.length) return { ok: false, reason: 'invalid_api_key' };
  let mismatch = 0;
  for (let index = 0; index < apiKey.length; index += 1) mismatch |= supplied.charCodeAt(index) ^ apiKey.charCodeAt(index);
  return mismatch === 0 ? { ok: true, mode: 'api_key' } : { ok: false, reason: 'invalid_api_key' };
}

module.exports = { authenticateRequest, extractApiKey };
