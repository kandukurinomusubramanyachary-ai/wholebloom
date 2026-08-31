const { GeminiProvider } = require('./gemini');
const { GroqProvider } = require('./groq');
const { OpenRouterProvider } = require('./openrouter');
const { OllamaProvider } = require('./ollama');
const { ProviderManager } = require('./providerManager');

function createProviders(config) {
  const providerConfig = config.providers || {};
  return {
    gemini: new GeminiProvider(providerConfig.gemini || {}),
    groq: new GroqProvider(providerConfig.groq || {}),
    openrouter: new OpenRouterProvider(providerConfig.openrouter || {}),
    ollama: new OllamaProvider(providerConfig.ollama || {}),
  };
}

module.exports = { GeminiProvider, GroqProvider, OpenRouterProvider, OllamaProvider, ProviderManager, createProviders };
