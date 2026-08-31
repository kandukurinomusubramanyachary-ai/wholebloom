const crypto = require('node:crypto');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashRequest({ userId, conversationId, messageId, message, mode = 'auto', language = 'en', context = {}, userContext = {} }) {
  return crypto.createHash('sha256').update(stableStringify({ userId, conversationId, messageId, message, mode, language, context, userContext })).digest('hex');
}

module.exports = { stableStringify, hashRequest };
