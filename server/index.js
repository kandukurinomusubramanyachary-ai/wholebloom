require('dotenv').config({ quiet: true });

const express = require('express');
const { createRequireFirebaseAuth } = require('./firebaseAuth');
const { verifyFirebaseIdToken } = require('./firebaseAdmin');
const { safeLogger } = require('./safeLogger');
const { createMegV2Bridge } = require('./megV2Bridge');

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '127.0.0.1';
const DEV_CORS_HOSTS = ['localhost', '127.0.0.1'];
const DEV_CORS_PORT_MIN = 8081;
const DEV_CORS_PORT_MAX = 8090;
const DEFAULT_DEV_CORS_ORIGINS = DEV_CORS_HOSTS.flatMap((host) => (
  Array.from(
    { length: DEV_CORS_PORT_MAX - DEV_CORS_PORT_MIN + 1 },
    (_value, index) => `http://${host}:${DEV_CORS_PORT_MIN + index}`
  )
));

function cleanOrigin(value) {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
}

function resolveAllowedOrigins(environment = process.env) {
  const production = String(environment.NODE_ENV || '').trim().toLowerCase() === 'production';
  if (!production) return [...DEFAULT_DEV_CORS_ORIGINS];

  const configured = String(environment.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(cleanOrigin)
    .filter(Boolean);
  if (!configured.length) {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production.');
  }
  return configured.map((origin) => {
    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
        throw new Error('origin must not contain a path');
      }
      return origin;
    } catch (_error) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain only valid HTTP/HTTPS origins.');
    }
  });
}

function resolveBuildStatus(environment = process.env) {
  const configured = String(environment.BUILD_VERSION || environment.GIT_COMMIT || '').trim();
  return /^[a-zA-Z0-9._-]{1,80}$/.test(configured) ? configured : 'development';
}

function createApp({
  verifyIdToken = verifyFirebaseIdToken,
  megV2Bridge = null,
  allowedOrigins = resolveAllowedOrigins(),
  buildStatus = resolveBuildStatus(),
  logger = safeLogger,
} = {}) {
  const bridge = megV2Bridge || createMegV2Bridge();
  if (!bridge || typeof bridge.chat !== 'function') {
    throw new Error('Meg V2 bridge is required.');
  }

  const app = express();
  const originAllowlist = new Set(allowedOrigins);
  const requireFirebaseAuth = createRequireFirebaseAuth({ verifyIdToken, logger });

  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.vary('Origin');
    const origin = cleanOrigin(request.get('origin'));
    if (origin && !originAllowlist.has(origin)) {
      logger.warn('cors_origin_rejected', {
        method: request.method,
        path: request.path,
        status: 403,
      });
      return response.status(403).json({ error: 'Origin is not allowed.' });
    }
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Max-Age', '600');
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));

  app.get('/health', (_request, response) => {
    const meg = typeof bridge.health === 'function' ? bridge.health() : {};
    response.json({
      ok: true,
      status: 'ready',
      build: buildStatus,
      provider: 'meg-v2',
      engineVersion: meg.engineVersion || 'meg-v2',
      persistence: meg.persistence || 'unknown',
      providers: meg.providers || {},
    });
  });

  app.post('/api/meg/chat', requireFirebaseAuth, async (request, response) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once('aborted', abort);

    try {
      const payload = await bridge.chat({
        uid: request.auth.uid,
        body: request.body || {},
        signal: controller.signal,
      });
      return response.json(payload);
    } catch (error) {
      const status = Number(error?.status);
      if (Number.isInteger(status) && status >= 400 && status < 600) {
        logger.warn('meg_v2_request_rejected', {
          code: error?.code || error?.name || 'request_error',
          status,
        });
        return response.status(status).json({
          error: error?.code || 'Meg could not respond right now. Please try again.',
          ...(Array.isArray(error?.details) ? { details: error.details } : {}),
        });
      }
      logger.error('meg_v2_request_failed', {
        code: error?.code || error?.name || 'unknown',
        status: 503,
      });
      return response.status(503).json({
        error: 'Meg is unavailable right now. Please try again.',
      });
    } finally {
      request.removeListener('aborted', abort);
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError) {
      return response.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    logger.error('meg_server_error', {
      code: error?.code || error?.name || 'unknown',
      status: 500,
    });
    return response.status(500).json({ error: 'The Meg service encountered an error.' });
  });

  return app;
}

function startServer() {
  const port = Number(process.env.PORT || process.env.MEG_SERVER_PORT) || DEFAULT_PORT;
  const host = process.env.MEG_SERVER_HOST
    || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : DEFAULT_HOST);
  const app = createApp();
  const server = app.listen(port, host, () => {
    safeLogger.info('meg_server_started', {
      provider: 'meg-v2',
      status: 'ready',
    });
  });
  server.on('error', (error) => {
    safeLogger.error('meg_server_listen_failed', {
      code: error?.code || error?.name || 'listen_error',
      status: 1,
    });
    process.exitCode = 1;
  });
  return server;
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    safeLogger.error('meg_server_boot_failed', {
      code: error?.code || error?.name || 'configuration_error',
      status: 1,
    });
    process.exitCode = 1;
  }
}

module.exports = {
  createApp,
  startServer,
  resolveAllowedOrigins,
  resolveBuildStatus,
  DEFAULT_DEV_CORS_ORIGINS,
};
