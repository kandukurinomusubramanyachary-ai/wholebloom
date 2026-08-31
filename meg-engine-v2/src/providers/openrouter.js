const { OpenAICompatibleProvider } = require('./openaiCompatible');

class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(config = {}) {
    super({
      name: 'openrouter',
      apiKey: config.apiKey,
      model: config.model || 'meta-llama/llama-3.3-8b-instruct:free',
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
      headers: { 'HTTP-Referer': config.referer || 'https://bloom.app', 'X-Title': config.title || 'Bloom Meg Engine V2' },
    });
  }
}

module.exports = { OpenRouterProvider };
