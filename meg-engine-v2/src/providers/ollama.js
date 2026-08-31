const { ProviderError, providerHeaders, assertOk, normalizeError } = require('./provider');

class OllamaProvider {
  constructor(config = {}) { this.name = 'ollama'; this.url = (config.url || 'http://localhost:11434').replace(/\/$/, ''); this.model = config.model || 'qwen3.5:4b'; }
  isConfigured() { return Boolean(this.url && this.model); }

  async *stream({ messages, temperature = 0.7, maxTokens = 900, signal }) {
    if (!this.isConfigured()) throw new ProviderError('Ollama is not configured', { provider: this.name, retryable: false, code: 'NOT_CONFIGURED' });
    try {
      const response = await fetch(`${this.url}/api/chat`, {
        method: 'POST', headers: providerHeaders({ Accept: 'application/x-ndjson' }), signal,
        body: JSON.stringify({ model: this.model, messages, stream: true, options: { temperature, num_predict: maxTokens } }),
      });
      await assertOk(response, this.name);
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines.filter(Boolean)) {
          let json;
          try { json = JSON.parse(line); } catch (error) { throw new ProviderError('Ollama returned malformed streaming data', { provider: this.name, retryable: true, code: 'MALFORMED_STREAM', cause: error }); }
          const text = json.message?.content || '';
          if (text) yield text;
          if (json.done) return;
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) {
        let json;
        try { json = JSON.parse(buffer); } catch (error) { throw new ProviderError('Ollama returned malformed streaming data', { provider: this.name, retryable: true, code: 'MALFORMED_STREAM', cause: error }); }
        if (json.message?.content) yield json.message.content;
      }
    } catch (error) { throw normalizeError(error, this.name, 'STREAM_ERROR'); }
  }

  async generate(request) { let result = ''; for await (const token of this.stream(request)) result += token; return result; }
  async healthCheck() {
    if (!this.isConfigured()) return false;
    try { const response = await fetch(`${this.url}/api/tags`, { signal: AbortSignal.timeout(1500) }); return response.ok; } catch { return false; }
  }
  normalizeError(error) { return normalizeError(error, this.name); }
}

module.exports = { OllamaProvider };
