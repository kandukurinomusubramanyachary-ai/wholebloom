const path = require('node:path');

const PROVIDERS = ['gemini', 'groq', 'openrouter', 'ollama'];

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function providerList(value, fallback) {
  const values = String(value || fallback)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => PROVIDERS.includes(item));
  return [...new Set(values)];
}

function prioritize(primary, order) {
  if (!PROVIDERS.includes(primary)) return order;
  return [primary, ...order.filter((provider) => provider !== primary)];
}

function loadConfig(env = process.env) {
  const dataDir = path.resolve(env.DATA_DIR || path.join(process.cwd(), 'data'));
  const primaryFastProvider = String(env.PRIMARY_FAST_PROVIDER || 'gemini').toLowerCase();
  const primarySmartProvider = String(env.PRIMARY_SMART_PROVIDER || 'openrouter').toLowerCase();
  const localFallbackEnabled = bool(env.ENABLE_LOCAL_FALLBACK, true);
  const withoutLocalWhenDisabled = (order) => localFallbackEnabled ? order : order.filter((provider) => provider !== 'ollama');
  const fastOrder = providerList(env.FAST_PROVIDER_ORDER, 'gemini,groq,openrouter,ollama');
  const smartOrder = providerList(env.SMART_PROVIDER_ORDER, 'openrouter,gemini,groq,ollama');
  const defaultModelMaxTokens = integer(env.MAX_OUTPUT_TOKENS, 900);

  return {
    engineVersion: env.ENGINE_VERSION || '0.2.0',
    promptVersion: env.PROMPT_VERSION || 'meg-prompt-v2',
    routerVersion: env.ROUTER_VERSION || 'deterministic-router-v2',
    knowledgeVersion: env.KNOWLEDGE_VERSION || 'pcos-general-v1',
    port: integer(env.PORT, 8787),
    host: env.HOST || '0.0.0.0',
    nodeEnv: env.NODE_ENV || 'development',
    dataDir,
    auth: { apiKey: env.MEG_API_KEY || '' },
    allowedOrigins: String(env.ALLOWED_ORIGINS || '*').split(',').map((origin) => origin.trim()).filter(Boolean),
    maxMessageChars: integer(env.MAX_MESSAGE_CHARS, 10000),
    maxMessageIdChars: integer(env.MAX_MESSAGE_ID_CHARS, 160),
    maxResponseChars: integer(env.MAX_RESPONSE_CHARS, 6000),
    maxOutputTokens: defaultModelMaxTokens,
    memoryLimit: integer(env.MEMORY_LIMIT, 5),
    recentMessageLimit: integer(env.RECENT_MESSAGE_LIMIT, 8),
    idempotencyStaleMs: integer(env.IDEMPOTENCY_STALE_MS, 120000),
    tokenBudget: integer(env.PROMPT_TOKEN_BUDGET, 4200),
    heartbeatMs: integer(env.SSE_HEARTBEAT_MS, 15000),
    rateLimitPerMinute: integer(env.RATE_LIMIT_PER_MINUTE, 0),
    features: {
      streaming: bool(env.ENABLE_STREAMING, true),
      cache: bool(env.ENABLE_CACHE, true),
      localFallback: localFallbackEnabled,
      hedging: bool(env.ENABLE_HEDGING, false),
    },
    hedging: {
      delayMs: integer(env.HEDGE_DELAY_MS, 800),
    },
    timeouts: {
      FAST: integer(env.FAST_TIMEOUT_MS, 12000),
      SMART: integer(env.SMART_TIMEOUT_MS, 25000),
      SAFETY: integer(env.SAFETY_TIMEOUT_MS || env.SMART_TIMEOUT_MS, 25000),
      DOCTOR: integer(env.SMART_TIMEOUT_MS, 25000),
      LOCAL: integer(env.LOCAL_TIMEOUT_MS, 45000),
    },
    retries: integer(env.PROVIDER_RETRIES, 1),
    retry: {
      baseDelayMs: integer(env.RETRY_BASE_DELAY_MS, 80),
      maxDelayMs: integer(env.RETRY_MAX_DELAY_MS, 800),
      jitterRatio: number(env.RETRY_JITTER_RATIO, 0.25),
    },
    circuit: {
      failureThreshold: integer(env.CIRCUIT_FAILURE_THRESHOLD, 3),
      cooldownMs: integer(env.CIRCUIT_COOLDOWN_MS, 60000),
      rollingWindowMs: integer(env.CIRCUIT_ROLLING_WINDOW_MS, 120000),
      rollingMinimumRequests: integer(env.CIRCUIT_ROLLING_MIN_REQUESTS, 5),
      failureRateThreshold: number(env.CIRCUIT_FAILURE_RATE_THRESHOLD, 0.6),
    },
    cacheTtlMs: integer(env.CACHE_TTL_MS, 900000),
    primaryFastProvider,
    primarySmartProvider,
    providerOrders: {
      FAST: withoutLocalWhenDisabled(prioritize(primaryFastProvider, fastOrder)),
      SMART: withoutLocalWhenDisabled(prioritize(primarySmartProvider, smartOrder)),
      SAFETY: withoutLocalWhenDisabled(providerList(env.SAFETY_PROVIDER_ORDER, 'openrouter,gemini,groq,ollama')),
      DOCTOR: withoutLocalWhenDisabled(providerList(env.DOCTOR_PROVIDER_ORDER, 'openrouter,gemini,groq,ollama')),
      LOCAL: providerList(env.LOCAL_PROVIDER_ORDER || env.LOCAL_PROVIDER || 'ollama', 'ollama'),
    },
    providers: {
      gemini: { apiKey: env.GEMINI_API_KEY || '', model: env.GEMINI_MODEL || 'gemini-2.5-flash', baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta' },
      groq: { apiKey: env.GROQ_API_KEY || '', model: env.GROQ_MODEL || 'llama-3.1-8b-instant' },
      openrouter: {
        apiKey: env.OPENROUTER_API_KEY || '',
        model: env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-8b-instruct:free',
        referer: env.OPENROUTER_REFERER || 'https://bloom.app',
        title: env.OPENROUTER_TITLE || 'Bloom Meg Engine V2',
      },
      ollama: { url: env.OLLAMA_URL || 'http://localhost:11434', model: env.OLLAMA_MODEL || 'qwen3.5:4b' },
    },
  };
}

module.exports = { loadConfig, providerList, PROVIDERS };
