const crypto = require('node:crypto');

const CACHEABLE_INTENTS = new Set(['simple_health']);
const EDUCATIONAL_PATTERNS = [
  /^(what is|what are)\s+(pcos|polycystic ovary syndrome|insulin resistance)\??$/i,
  /^why do irregular periods happen\??$/i,
  /^what is insulin resistance\??$/i,
];

function normalize(text) { return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

class ResponseCache {
  constructor({ ttlMs = 900000, maxEntries = 500, promptVersion = 'meg-prompt-v2', knowledgeVersion = 'pcos-general-v1', now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.promptVersion = promptVersion;
    this.knowledgeVersion = knowledgeVersion;
    this.now = now;
    this.entries = new Map();
  }

  isCacheable({ intent, message, safety } = {}) {
    return !safety?.triggered && CACHEABLE_INTENTS.has(intent) && EDUCATIONAL_PATTERNS.some((pattern) => pattern.test(normalize(message)));
  }

  key({ intent, message, language = 'en', promptVersion = this.promptVersion, knowledgeVersion = this.knowledgeVersion }) {
    return crypto.createHash('sha256').update(JSON.stringify({ intent, language: normalize(language), query: normalize(message), promptVersion, knowledgeVersion })).digest('hex');
  }

  get(request) {
    const key = this.key(request);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) { this.entries.delete(key); return null; }
    return entry.value;
  }

  set(request, value) {
    const key = this.key(request);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
  }

  clear() { this.entries.clear(); }
  size() { return this.entries.size; }
}

module.exports = { ResponseCache, CACHEABLE_INTENTS, EDUCATIONAL_PATTERNS, normalize };
