const path = require('node:path');
const express = require('express');
const { loadConfig } = require('./config/env');
const { createProviders, ProviderManager } = require('./providers');
const { MemoryStore } = require('./memory/memoryStore');
const { ResponseCache } = require('./cache/responseCache');
const { RequestCoordinator } = require('./reliability/requestCoordinator');
const { RateLimiter } = require('./reliability/rateLimiter');
const { createChatHandler } = require('./http/chatHandler');
const { authenticateRequest } = require('./utils/auth');
const { createLogger, safeMetadata } = require('./utils/logger');
const { writeSse } = require('./utils/sse');

function sendCompletedReplaySse(res, result = {}) {
  const metadata = result.metadata && typeof result.metadata === 'object' ? result.metadata : {};
  const deduplicated = Boolean(metadata.deduplicated);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  writeSse(res, 'start', {
    conversationId: result.conversationId || null,
    messageId: result.messageId || null,
    deduplicated,
  });
  writeSse(res, 'token', { text: String(result.text || '') });
  writeSse(res, 'done', {
    traceId: metadata.traceId || null,
    messageId: result.messageId || metadata.messageId || null,
    deduplicated,
  });
  res.end();
}

function createApp(overrides = {}) {
  const config = overrides.config || loadConfig();
  const providers = overrides.providers || (overrides.providerManager ? {} : createProviders(config));
  const providerManager = overrides.providerManager || new ProviderManager({ providers, config });
  const store = overrides.store || new MemoryStore({ filename: path.join(config.dataDir || path.join(process.cwd(), 'data'), 'meg.db') });
  const cache = overrides.cache || new ResponseCache({ ttlMs: config.cacheTtlMs, promptVersion: config.promptVersion, knowledgeVersion: config.knowledgeVersion });
  const coordinator = overrides.coordinator || new RequestCoordinator();
  const rateLimiter = overrides.rateLimiter || new RateLimiter({ limit: config.rateLimitPerMinute });
  const logger = overrides.logger || createLogger({ env: config.nodeEnv });
  const app = express();
  app.disable('x-powered-by');
  const maxMessageChars = Number.isFinite(Number(config.maxMessageChars)) ? Number(config.maxMessageChars) : 10000;
  app.use(express.json({ limit: `${Math.max(1, Math.ceil(maxMessageChars / 1000))}mb` }));
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = config.allowedOrigins || ['*'];
    if (allowedOrigins.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (origin && allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Meg-Api-Key, X-Trace-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/v2', (req, res, next) => {
    const clientKey = req.socket.remoteAddress || 'unknown';
    if (!rateLimiter.allow(clientKey)) return res.status(429).json({ error: 'rate_limited', retryAfterMs: 60000 });
    const result = authenticateRequest(req, config.auth);
    if (!result.ok) return res.status(401).json({ error: 'unauthorized' });
    next();
  });

  app.get('/health', (req, res) => res.json({
    status: 'ok', service: 'meg-engine-v2', engineVersion: config.engineVersion, streaming: config.features.streaming,
    persistence: store.driver || 'custom', providers: typeof providerManager.status === 'function' ? providerManager.status() : {},
  }));
  app.get('/health/providers', async (req, res) => {
    if (config.auth?.apiKey && !authenticateRequest(req, config.auth).ok) return res.status(401).json({ error: 'unauthorized' });
    const providersStatus = typeof providerManager.healthCheck === 'function' ? await providerManager.healthCheck() : {};
    res.json({ service: 'meg-engine-v2', providers: providersStatus });
  });

  const chatHandler = createChatHandler({ config, providerManager, store, cache, coordinator, logger });
  app.post('/v2/chat', async (req, res, next) => {
    try {
      const result = await chatHandler(req, res);
      if (!res.headersSent && result && Object.prototype.hasOwnProperty.call(result, 'text')) {
        return sendCompletedReplaySse(res, result);
      }
      return result;
    } catch (error) {
      return next(error);
    }
  });

  // User-control primitives are intentionally thin and storage-agnostic for future Bloom/Firestore wiring.
  app.delete('/v2/memory', (req, res) => {
    if (typeof req.body?.userId !== 'string' || !req.body.userId.trim()) return res.status(400).json({ error: 'userId is required' });
    const deleted = store.clearMemories({ userId: req.body.userId.trim(), layer: req.body.layer });
    res.json({ deleted });
  });
  app.get('/v2/memory/export', (req, res) => {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    res.json(store.exportUserData({ userId }));
  });
  app.delete('/v2/conversations/:conversationId', (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    res.json(store.deleteConversation({ userId, conversationId: req.params.conversationId }));
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    logger.error({ event: 'request_handler_error', error: safeMetadata({ name: error?.name, code: error?.code, status: error?.status }) });
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    res.status(500).json({ error: 'internal_error' });
  });
  app.locals.meg = { config, providers, providerManager, store, cache, coordinator, rateLimiter, logger };
  return app;
}

module.exports = { createApp };
