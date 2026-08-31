const { ProviderError, providerHeaders, assertOk, normalizeError, parseOpenAiToken } = require('./provider');
const { parseSse } = require('../utils/sse');

class OpenAICompatibleProvider {
  constructor({ name, apiKey = '', model, baseUrl, headers = {} } = {}) {
    this.name = name;
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.extraHeaders = headers;
  }

  isConfigured() { return Boolean(this.apiKey && this.model && this.baseUrl); }

  requestBody({ messages, temperature = 0.7, maxTokens = 900 }) {
    return { model: this.model, messages, temperature, max_tokens: maxTokens, stream: true };
  }

  async *stream({ messages, temperature = 0.7, maxTokens = 900, signal }) {
    if (!this.isConfigured()) throw new ProviderError(`${this.name} is not configured`, { provider: this.name, retryable: false, code: 'NOT_CONFIGURED' });
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: providerHeaders({ Authorization: `Bearer ${this.apiKey}`, ...this.extraHeaders }),
        signal,
        body: JSON.stringify(this.requestBody({ messages, temperature, maxTokens })),
      });
      await assertOk(response, this.name);
      for await (const raw of parseSse(response.body)) {
        let json;
        try { json = JSON.parse(raw); } catch (error) {
          throw new ProviderError(`${this.name} returned malformed streaming data`, { provider: this.name, retryable: true, code: 'MALFORMED_STREAM', cause: error });
        }
        const text = parseOpenAiToken(json);
        if (text) yield text;
      }
    } catch (error) {
      throw normalizeError(error, this.name, 'STREAM_ERROR');
    }
  }

  async generate(request) { let result = ''; for await (const token of this.stream(request)) result += token; return result; }

  async healthCheck({ signal } = {}) {
    if (!this.isConfigured()) return false;
    try {
      const response = await fetch(`${this.baseUrl}/models`, { headers: providerHeaders({ Authorization: `Bearer ${this.apiKey}` }), signal: signal || AbortSignal.timeout(1500) });
      return response.ok;
    } catch { return false; }
  }

  normalizeError(error) { return normalizeError(error, this.name); }
}

module.exports = { OpenAICompatibleProvider };
