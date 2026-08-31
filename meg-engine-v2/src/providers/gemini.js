const { ProviderError, providerHeaders, assertOk, normalizeError } = require('./provider');
const { parseSse } = require('../utils/sse');

function toGemini(messages) {
  const system = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n');
  const contents = messages.filter((item) => item.role !== 'system').map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] }));
  return { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents };
}

class GeminiProvider {
  constructor(config = {}) { this.name = 'gemini'; this.apiKey = config.apiKey || ''; this.model = config.model || 'gemini-2.5-flash'; this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''); }
  isConfigured() { return Boolean(this.apiKey && this.model); }

  async *stream({ messages, temperature = 0.7, maxTokens = 900, signal }) {
    if (!this.isConfigured()) throw new ProviderError('Gemini is not configured', { provider: this.name, retryable: false, code: 'NOT_CONFIGURED' });
    try {
      const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
      const response = await fetch(url, { method: 'POST', headers: providerHeaders(), signal, body: JSON.stringify({ ...toGemini(messages), generationConfig: { temperature, maxOutputTokens: maxTokens } }) });
      await assertOk(response, this.name);
      for await (const raw of parseSse(response.body)) {
        let json;
        try { json = JSON.parse(raw); } catch (error) { throw new ProviderError('Gemini returned malformed streaming data', { provider: this.name, retryable: true, code: 'MALFORMED_STREAM', cause: error }); }
        const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
        if (text) yield text;
      }
    } catch (error) { throw normalizeError(error, this.name, 'STREAM_ERROR'); }
  }

  async generate(request) { let result = ''; for await (const token of this.stream(request)) result += token; return result; }
  async healthCheck() {
    if (!this.isConfigured()) return false;
    try { const response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(this.model)}?key=${encodeURIComponent(this.apiKey)}`, { signal: AbortSignal.timeout(1500) }); return response.ok; } catch { return false; }
  }
  normalizeError(error) { return normalizeError(error, this.name); }
}

module.exports = { GeminiProvider, toGemini };
