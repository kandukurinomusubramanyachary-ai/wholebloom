const { MEG_QA_FAILURE_CATEGORY } = require('./megQaTiming');

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const DEFAULT_OLLAMA_MODEL = 'qwen3.5:4b';
const DEFAULT_TIMEOUT_MS = 90000;
const PROVIDER_OLLAMA = 'ollama';
const PROVIDER_OPENAI_COMPATIBLE = 'openai-compatible';

class MegProviderError extends Error {
  constructor(code, clientMessage) {
    super(code);
    this.name = 'MegProviderError';
    this.code = code;
    this.clientMessage = clientMessage;
  }
}

class MegConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MegConfigurationError';
    this.code = code;
  }
}

function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function validatedHttpUrl(value, variableName, { requireHttps = false } = {}) {
  const clean = cleanValue(value);
  try {
    const url = new URL(clean);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    if (requireHttps && url.protocol !== 'https:') throw new Error('HTTPS is required');
    return url.toString().replace(/\/+$/, '');
  } catch (_error) {
    throw new MegConfigurationError(
      `invalid_${variableName.toLowerCase()}`,
      requireHttps
        ? `${variableName} must be a valid HTTPS URL in production.`
        : `${variableName} must be a valid HTTP or HTTPS URL.`
    );
  }
}

function endpointUrl(baseUrl, endpointPath) {
  if (baseUrl.endsWith(endpointPath)) return baseUrl;
  return `${baseUrl}${endpointPath}`;
}

function resolveMegProviderConfig(environment = process.env) {
  const provider = cleanValue(environment.MEG_PROVIDER).toLowerCase() || PROVIDER_OLLAMA;
  const timeoutMs = positiveInteger(
    environment.MEG_REQUEST_TIMEOUT_MS || environment.OLLAMA_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );

  if (provider === PROVIDER_OLLAMA) {
    const url = validatedHttpUrl(
      cleanValue(environment.OLLAMA_URL) || DEFAULT_OLLAMA_URL,
      'OLLAMA_URL'
    );
    const model = cleanValue(environment.OLLAMA_MODEL) || DEFAULT_OLLAMA_MODEL;
    return {
      id: PROVIDER_OLLAMA,
      endpoint: endpointUrl(url, '/api/chat'),
      model,
      timeoutMs,
    };
  }

  if (provider === PROVIDER_OPENAI_COMPATIBLE) {
    const baseUrl = cleanValue(environment.MEG_API_BASE_URL);
    const apiKey = cleanValue(environment.MEG_API_KEY);
    const model = cleanValue(environment.MEG_MODEL);
    if (!baseUrl) {
      throw new MegConfigurationError(
        'missing_meg_api_base_url',
        'MEG_API_BASE_URL is required for MEG_PROVIDER=openai-compatible.'
      );
    }
    if (!apiKey) {
      throw new MegConfigurationError(
        'missing_meg_api_key',
        'MEG_API_KEY is required for MEG_PROVIDER=openai-compatible.'
      );
    }
    if (!model) {
      throw new MegConfigurationError(
        'missing_meg_model',
        'MEG_MODEL is required for MEG_PROVIDER=openai-compatible.'
      );
    }

    return {
      id: PROVIDER_OPENAI_COMPATIBLE,
      endpoint: endpointUrl(validatedHttpUrl(baseUrl, 'MEG_API_BASE_URL', {
        requireHttps: environment.NODE_ENV === 'production',
      }), '/chat/completions'),
      apiKey,
      model,
      timeoutMs,
    };
  }

  throw new MegConfigurationError(
    'unsupported_meg_provider',
    `MEG_PROVIDER must be "${PROVIDER_OLLAMA}" or "${PROVIDER_OPENAI_COMPATIBLE}".`
  );
}

function ollamaClientMessage(code, model) {
  if (code === 'model_not_found') return `The Ollama model "${model}" is not available.`;
  if (code === 'empty_response') return 'Ollama returned an empty response.';
  if (code === 'upstream_unavailable') {
    return 'Ollama is unavailable. Make sure it is running locally.';
  }
  return 'Ollama could not generate a response.';
}

function openAiClientMessage(code) {
  if (code === 'empty_response') return 'Meg received an empty response from its AI provider.';
  return 'Meg could not generate a response right now.';
}

function createMegProvider(config, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('This backend requires Node.js 18 or newer for fetch support.');
  }
  if (!config || ![PROVIDER_OLLAMA, PROVIDER_OPENAI_COMPATIBLE].includes(config.id)) {
    throw new Error('A valid Meg provider configuration is required.');
  }

  const isOllama = config.id === PROVIDER_OLLAMA;

  return {
    id: config.id,
    model: config.model,
    timeoutMs: config.timeoutMs,
    async chat({ messages, options, signal, qaTiming, qaPhase = 'primary' }) {
      const body = isOllama
        ? {
            model: config.model,
            think: false,
            stream: false,
            ...(options ? { options } : {}),
            messages,
          }
        : {
            model: config.model,
            stream: false,
            messages,
            ...(options?.temperature !== undefined
              ? { temperature: options.temperature }
              : {}),
            ...(options?.num_predict !== undefined
              ? { max_tokens: options.num_predict }
              : {}),
          };

      let providerResponse;
      const providerStartedAt = qaTiming?.mark();
      let providerHeadersAt;
      try {
        providerResponse = await fetchImpl(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(!isOllama ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal,
        });
        providerHeadersAt = qaTiming?.mark();
      } catch (error) {
        if (qaPhase === 'revision') {
          qaTiming?.recordDuration('revision_provider_total_ms', providerStartedAt);
        } else {
          qaTiming?.recordDuration('provider_total_ms', providerStartedAt);
          qaTiming?.setFailure(
            error?.name === 'AbortError'
              ? MEG_QA_FAILURE_CATEGORY.PROVIDER_TIMEOUT
              : MEG_QA_FAILURE_CATEGORY.NETWORK
          );
        }
        if (error?.name === 'AbortError') throw error;
        throw new MegProviderError(
          'upstream_unavailable',
          isOllama
            ? ollamaClientMessage('upstream_unavailable', config.model)
            : openAiClientMessage('upstream_unavailable')
        );
      }

      let payloadParseFailed = false;
      const payload = await providerResponse.json().catch(() => {
        payloadParseFailed = true;
        return {};
      });
      const providerBodyAt = qaTiming?.mark();
      if (qaPhase === 'revision') {
        qaTiming?.recordDuration(
          'revision_provider_total_ms',
          providerStartedAt,
          providerBodyAt
        );
      } else {
        qaTiming?.recordDuration('provider_headers_ms', providerStartedAt, providerHeadersAt);
        qaTiming?.recordDuration('provider_body_ms', providerHeadersAt, providerBodyAt);
        qaTiming?.recordDuration('provider_total_ms', providerStartedAt, providerBodyAt);
      }
      if (!providerResponse.ok) {
        if (qaPhase === 'primary') {
          qaTiming?.setFailure(
            providerResponse.status >= 400 && providerResponse.status < 500
              ? MEG_QA_FAILURE_CATEGORY.PROVIDER_4XX
              : providerResponse.status >= 500
                ? MEG_QA_FAILURE_CATEGORY.PROVIDER_5XX
                : MEG_QA_FAILURE_CATEGORY.UNKNOWN
          );
        }
        const providerDetail = isOllama && typeof payload?.error === 'string'
          ? payload.error
          : '';
        const code = providerDetail.includes('not found') ? 'model_not_found' : 'upstream_rejected';
        throw new MegProviderError(
          code,
          isOllama
            ? ollamaClientMessage(code, config.model)
            : openAiClientMessage(code)
        );
      }

      if (payloadParseFailed && qaPhase === 'primary') {
        qaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PARSE);
      }

      const content = isOllama
        ? payload?.message?.content
        : payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        if (qaPhase === 'primary') {
          qaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PARSE);
        }
        throw new MegProviderError(
          'empty_response',
          isOllama
            ? ollamaClientMessage('empty_response', config.model)
            : openAiClientMessage('empty_response')
        );
      }
      return content.trim();
    },
  };
}

function createMegProviderFromEnv({
  environment = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  return createMegProvider(resolveMegProviderConfig(environment), { fetchImpl });
}

module.exports = {
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_TIMEOUT_MS,
  PROVIDER_OLLAMA,
  PROVIDER_OPENAI_COMPATIBLE,
  MegConfigurationError,
  MegProviderError,
  resolveMegProviderConfig,
  createMegProvider,
  createMegProviderFromEnv,
};
