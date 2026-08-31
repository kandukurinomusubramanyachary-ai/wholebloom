const { OpenAICompatibleProvider } = require('./openaiCompatible');

class GroqProvider extends OpenAICompatibleProvider {
  constructor(config = {}) {
    super({ name: 'groq', apiKey: config.apiKey, model: config.model || 'llama-3.1-8b-instant', baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1' });
  }
}

module.exports = { GroqProvider };
