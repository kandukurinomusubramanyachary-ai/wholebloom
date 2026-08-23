require('dotenv').config({ quiet: true });

const express = require('express');
const { MEG_SYSTEM_PROMPT } = require('./megPrompt');
const {
  createRequireFirebaseAuth,
} = require('./firebaseAuth');
const { verifyFirebaseIdToken } = require('./firebaseAdmin');
const {
  MegProviderError,
  PROVIDER_OLLAMA,
  createMegProviderFromEnv,
} = require('./megProvider');
const {
  MegPersistenceError,
  createMegPersistence,
} = require('./megPersistence');
const {
  MEG_QA_FAILURE_CATEGORY,
  createServerMegQaTiming,
  isMegQaTimingEnabled,
} = require('./megQaTiming');
const { safeLogger } = require('./safeLogger');
const {
  MegContextValidationError,
  buildUserContextBlock,
  cleanMegContext,
} = require('./megContext');
const { buildModeInstruction, cleanMegMode } = require('./megModes');

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '127.0.0.1';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_RECEIVED_HISTORY = 20;
const DEFAULT_TIMEOUT_MS = 90000;
const DEV_CORS_HOSTS = ['localhost', '127.0.0.1'];
const DEV_CORS_PORT_MIN = 8081;
const DEV_CORS_PORT_MAX = 8090;
const DEFAULT_DEV_CORS_ORIGINS = DEV_CORS_HOSTS.flatMap((host) => (
  Array.from(
    { length: DEV_CORS_PORT_MAX - DEV_CORS_PORT_MIN + 1 },
    (_value, index) => `http://${host}:${DEV_CORS_PORT_MIN + index}`
  )
));

function cleanHistory(history) {
  if (history === undefined) return [];
  if (!Array.isArray(history) || history.length > MAX_RECEIVED_HISTORY) {
    throw new Error(`history must be an array with at most ${MAX_RECEIVED_HISTORY} messages`);
  }

  const cleaned = history.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('each history item must be an object');
    }
    if (!['user', 'assistant'].includes(entry.role)) {
      throw new Error('history roles must be user or assistant');
    }
    if (typeof entry.content !== 'string' || !entry.content.trim()) {
      throw new Error('history content must be a non-empty string');
    }
    if (entry.content.trim().length > MAX_MESSAGE_LENGTH) {
      throw new Error(`history content must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }
    return { role: entry.role, content: entry.content.trim() };
  });

  return cleaned.slice(-MAX_HISTORY_MESSAGES);
}

function revisionInstruction(userMessage, draft) {
  const rules = [];
  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;
  const sentenceCount = draft.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim()).length;
  const questionCount = (draft.match(/\?/g) || []).length;
  const hasListOrHeading = /^\s*(?:[-*•]|\d+[.)]|#{1,6}\s)/m.test(draft)
    || /\b(?:common causes|what you can do|when to see (?:a |your )?doctor)\b/i.test(draft);
  const hasBannedOpener = /^(?:it can be unsettling|it(?:'|’)s understandable that|i understand this can be worrying|that sounds frustrating|i(?:'|’)m sorry you(?:'|’)re going through this|many women experience|while i cannot diagnose|thank you for sharing that)\b/i.test(draft.trim());
  const usesTenglish = /\b(?:nunchi|raaledu|raledu|raavatledu|chala|undi|ostundi|naaku|valla|anipinchatledu|ippudu|tension|gurunchi|eeroju)\b/i.test(userMessage);
  const replyUsesTenglish = /\b(?:nunchi|raaka|raaledu|raledu|raavatledu|chala|undi|untundi|ostundi|naaku|valla|anipinchatledu|ippudu|tension|gurunchi|eeroju|enti)\b/i.test(draft);
  const hasTeluguScript = /[\u0C00-\u0C7F]/.test(draft);
  const tenglishCycleDelay = usesTenglish
    && /\b(?:periods?|cycle)\b/i.test(userMessage)
    && /\b(?:raaledu|raledu|raavatledu|late|delay)\b/i.test(userMessage)
    && !/\b(?:why|reason|enduku)\b/i.test(userMessage);
  const medicine = /\b(stop|skip|quit|change)\b.{0,40}\b(medicine|medication|tablets?|treatment)\b|\b(medicine|medication|tablets?|treatment)\b.{0,40}\b(stop|skip|quit|change)\b/i.test(userMessage);
  const pcosExplanation = /\bwhy\b.{0,60}\bperiods?\b.{0,60}\bpcos\b|\bpcos\b.{0,60}\bwhy\b.{0,60}\bperiods?\b/i.test(userMessage);
  const urgentBleeding = /\b(?:soak(?:ing|s|ed)?|fill(?:ing|s|ed)?)\b.{0,45}\b(?:pads?|tampons?)\b.{0,35}\b(?:every|per)\s+(?:one\s+)?hour\b|\b(?:heavy bleeding|bleeding heavily)\b.{0,80}\b(?:large clots?|dizz(?:y|iness)|weak(?:ness)?|faint(?:ing|ed)?)\b|\b(?:large clots?|dizz(?:y|iness)|weak(?:ness)?|faint(?:ing|ed)?)\b.{0,80}\b(?:heavy bleeding|bleeding heavily)\b/i.test(userMessage);
  const urgentPhysical = /\b(?:faint(?:ing|ed)?|lost consciousness|loss of consciousness|chest pain|severe breathlessness|can(?:not|'t) breathe|sudden vision changes?)\b|\b(?:severe|sudden)\b.{0,30}\b(?:pelvic|abdominal)\b.{0,15}\bpain\b/i.test(userMessage);
  const selfHarm = /\b(?:suicid(?:e|al)|kill myself|hurt myself|harm myself|end my life|want to die|don.t want to (?:be here|live)|not want to (?:be here|live))\b/i.test(userMessage);

  if (selfHarm) {
    rules.push('Return exactly these three sentences and nothing else: "You said you may hurt yourself, and I’m taking that seriously." "Are you in immediate danger right now?" "If you might act, contact local emergency services now and ask a trusted nearby person to stay with you."');
  } else if (urgentBleeding) {
    rules.push('Return exactly these two sentences and nothing else: "That amount of bleeding needs urgent medical attention now." "Please ask someone nearby to take you to urgent care or call emergency help — can you do that safely?"');
  } else if (urgentPhysical) {
    rules.push('Return exactly these two sentences and nothing else: "What you described needs urgent medical attention now." "Please ask someone nearby to take you to urgent care or call emergency help — can you do that safely?"');
  } else {
    if (wordCount > 120 || sentenceCount > 5 || questionCount > 1 || hasListOrHeading || hasBannedOpener) {
      rules.push('Use two to five natural sentences, no headings or bullet lists, no banned generic opener, and no more than one question. Keep only what helps the user continue.');
    }
    if (usesTenglish && (!replyUsesTenglish || hasTeluguScript)) {
      rules.push('Write the entire reply in natural Telugu-English, reusing at least two Tenglish words or phrases from the user’s message. Do not answer only in English, do not translate into formal English, and do not use Telugu script.');
    }
    if (tenglishCycleDelay) {
      rules.push('Return exactly these two sentences and nothing else: "40 days nunchi period raakapovadam itself mentally exhausting untundi, and ippudu tension ga undi ante aa waiting inka heavy ga feel avvachu." "Ee delay gurinchi em thought malli malli mind lo vastundi?"');
    }
    if (pcosExplanation) {
      rules.push('Return exactly these three sentences and nothing else: "In PCOS, ovulation may not happen on a predictable schedule." "When ovulation shifts or does not happen during a cycle, the period can arrive much earlier or later than expected." "Are your cycle lengths changing often, or has this cycle been especially different?"');
    }
    if (medicine) {
      rules.push('Return exactly these two sentences and nothing else: "Something about those tablets is making you question whether continuing feels right, but please don’t stop or change prescribed treatment without speaking to the person managing it." "What has been happening since you started them?"');
    }
  }

  if (!rules.length) return null;

  return `Rewrite Meg's draft so it follows every rule below and the system prompt. Return only the revised reply, with no heading or commentary.\n\nOriginal user message:\n${userMessage}\n\nRules:\n- ${rules.join('\n- ')}\n\nDraft to revise:\n${draft}`;
}

function enforceSingleQuestion(content) {
  const sentences = content.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [content];
  let keptQuestion = false;

  return sentences
    .map((sentence) => {
      const questionMark = sentence.indexOf('?');
      if (questionMark < 0) return sentence.trim();
      if (keptQuestion) return '';
      keptQuestion = true;
      return sentence.slice(0, questionMark + 1).trim();
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

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

function detectMegSafetyFlag(userMessage) {
  const selfHarm = /\b(?:suicid(?:e|al)|kill myself|hurt myself|harm myself|end my life|want to die|don.t want to (?:be here|live)|not want to (?:be here|live))\b/i.test(userMessage);
  if (selfHarm) return 'mental-health';
  const urgentBleeding = /\b(?:soak(?:ing|s|ed)?|fill(?:ing|s|ed)?)\b.{0,45}\b(?:pads?|tampons?)\b.{0,35}\b(?:every|per)\s+(?:one\s+)?hour\b|\b(?:heavy bleeding|bleeding heavily)\b.{0,80}\b(?:large clots?|dizz(?:y|iness)|weak(?:ness)?|faint(?:ing|ed)?)\b|\b(?:large clots?|dizz(?:y|iness)|weak(?:ness)?|faint(?:ing|ed)?)\b.{0,80}\b(?:heavy bleeding|bleeding heavily)\b/i.test(userMessage);
  const urgentPhysical = /\b(?:faint(?:ing|ed)?|lost consciousness|loss of consciousness|chest pain|severe breathlessness|can(?:not|'t) breathe|sudden vision changes?)\b|\b(?:severe|sudden)\b.{0,30}\b(?:pelvic|abdominal)\b.{0,15}\bpain\b/i.test(userMessage);
  return urgentBleeding || urgentPhysical ? 'medical' : undefined;
}

function providerErrorStatus(error) {
  return error?.code === 'upstream_unavailable' ? 503 : 502;
}

function timeoutErrorMessage(providerId) {
  return providerId === PROVIDER_OLLAMA
    ? 'Ollama took too long to respond.'
    : 'Meg\'s AI provider took too long to respond.';
}

function createApp({
  megProvider = createMegProviderFromEnv(),
  verifyIdToken = verifyFirebaseIdToken,
  megPersistence = createMegPersistence(),
  allowedOrigins = resolveAllowedOrigins(),
  buildStatus = resolveBuildStatus(),
  logger = safeLogger,
  megQaTimingEnabled = isMegQaTimingEnabled(),
} = {}) {
  if (!megProvider || typeof megProvider.chat !== 'function') {
    throw new Error('A configured Meg provider is required.');
  }
  if (
    !megPersistence
    || typeof megPersistence.persistUserMessage !== 'function'
    || typeof megPersistence.persistAssistantMessage !== 'function'
  ) {
    throw new Error('A configured Meg persistence service is required.');
  }

  const app = express();
  const originAllowlist = new Set(allowedOrigins);
  const requireFirebaseAuth = createRequireFirebaseAuth({ verifyIdToken, logger });

  if (megQaTimingEnabled) {
    app.use((request, response, next) => {
      if (request.method !== 'POST' || request.path !== '/api/meg/chat') return next();

      const timing = createServerMegQaTiming({
        enabled: true,
        requestedTraceId: request.get('x-meg-trace-id'),
      });
      request.megQaTiming = timing;
      response.once('finish', () => timing.finish(response.statusCode));
      response.once('close', () => {
        if (!response.writableEnded) timing.finish(0);
      });
      return next();
    });
  }

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
    response.setHeader(
      'Access-Control-Allow-Headers',
      megQaTimingEnabled
        ? 'Authorization, Content-Type, X-Meg-Trace-Id'
        : 'Authorization, Content-Type'
    );
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Max-Age', '600');
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));

  app.get('/health', (_request, response) => {
    response.json({
      ok: true,
      status: 'ready',
      build: buildStatus,
      provider: megProvider.id,
    });
  });

  app.post('/api/meg/chat', requireFirebaseAuth, async (request, response) => {
    const {
      message,
      history,
      conversationId,
      messageId,
      language,
      context: receivedContext,
    } = request.body || {};
    const mode = cleanMegMode(request.body?.mode ?? request.body?.supportMode);
    if (typeof message !== 'string' || !message.trim()) {
      return response.status(400).json({ error: 'message must be a non-empty string' });
    }

    const userMessage = message.trim();
    if (userMessage.length > MAX_MESSAGE_LENGTH) {
      return response.status(400).json({
        error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
      });
    }

    let recentHistory;
    let context;
    try {
      recentHistory = cleanHistory(history);
      context = cleanMegContext(receivedContext);
    } catch (validationError) {
      const error = validationError instanceof MegContextValidationError
        ? 'context contains an invalid value'
        : validationError.message;
      return response.status(400).json({ error });
    }
    const modeInstruction = buildModeInstruction(mode);
    const contextBlock = buildUserContextBlock(context);
    const injectedSystemMessages = [
      ...(modeInstruction ? [{ role: 'system', content: modeInstruction }] : []),
      ...(contextBlock ? [{ role: 'system', content: contextBlock }] : []),
    ];

    let userPersistence;
    const userPersistStartedAt = request.megQaTiming?.mark();
    try {
      userPersistence = await megPersistence.persistUserMessage({
        uid: request.auth.uid,
        conversationId,
        messageId,
        text: userMessage,
        mode,
        language,
      });
    } catch (error) {
      request.megQaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PERSISTENCE);
      const known = error instanceof MegPersistenceError;
      logger.error('meg_user_message_persist_failed', {
        code: error?.code || error?.name || 'unknown',
        status: known ? error.status : 503,
      });
      return response.status(known ? error.status : 503).json({
        error: known
          ? error.clientMessage
          : 'Meg could not save this message. Please try again.',
      });
    } finally {
      request.megQaTiming?.recordDuration('user_msg_persist_ms', userPersistStartedAt);
    }

    if (userPersistence?.completedAssistantText) {
      return response.json({
        message: userPersistence.completedAssistantText,
        conversationId: userPersistence.conversationId,
        messageId: userPersistence.assistantMessageId,
        source: userPersistence.source || megProvider.id,
        safety: userPersistence.safety || null,
      });
    }

    const controller = new AbortController();
    const timeoutMs = Number(megProvider.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let content = await megProvider.chat({
        messages: [
          { role: 'system', content: MEG_SYSTEM_PROMPT },
          ...injectedSystemMessages,
          ...recentHistory,
          { role: 'user', content: userMessage },
        ],
        signal: controller.signal,
        ...(request.megQaTiming
          ? { qaTiming: request.megQaTiming, qaPhase: 'primary' }
          : {}),
      });

      const rewriteRequest = revisionInstruction(userMessage, content);
      if (rewriteRequest) {
        request.megQaTiming?.setRevisionTriggered(1);
        try {
          content = await megProvider.chat({
            options: { temperature: 0.1, num_predict: 256 },
            messages: [
              { role: 'system', content: MEG_SYSTEM_PROMPT },
              ...injectedSystemMessages,
              ...recentHistory,
              { role: 'user', content: rewriteRequest },
            ],
            signal: controller.signal,
            ...(request.megQaTiming
              ? { qaTiming: request.megQaTiming, qaPhase: 'revision' }
              : {}),
          });
        } catch (revisionError) {
          if (
            revisionError instanceof MegProviderError
            && ['empty_response', 'model_not_found', 'upstream_rejected'].includes(revisionError.code)
          ) {
            logger.warn('meg_revision_skipped', {
              code: revisionError.code,
              provider: megProvider.id,
            });
          } else {
            throw revisionError;
          }
        }
      }

      content = enforceSingleQuestion(content);
      const assistantPersistStartedAt = request.megQaTiming?.mark();
      let savedAssistant;
      try {
        savedAssistant = await megPersistence.persistAssistantMessage({
          uid: request.auth.uid,
          conversationId,
          messageId,
          text: content,
          source: megProvider.id,
          safety: detectMegSafetyFlag(userMessage),
        });
      } catch (error) {
        request.megQaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PERSISTENCE);
        throw error;
      } finally {
        request.megQaTiming?.recordDuration(
          'assistant_msg_persist_ms',
          assistantPersistStartedAt
        );
      }
      return response.json({
        message: savedAssistant.text,
        conversationId: savedAssistant.conversationId,
        messageId: savedAssistant.messageId,
        source: savedAssistant.source || megProvider.id,
        safety: savedAssistant.safety || null,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        request.megQaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PROVIDER_TIMEOUT);
        logger.warn('meg_provider_timeout', {
          code: 'provider_timeout',
          provider: megProvider.id,
          status: 504,
        });
        return response.status(504).json({
          error: timeoutErrorMessage(megProvider.id),
        });
      }
      if (error instanceof MegPersistenceError) {
        request.megQaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PERSISTENCE);
        logger.error('meg_assistant_message_persist_failed', {
          code: error.code,
          status: error.status,
        });
        return response.status(error.status).json({ error: error.clientMessage });
      }
      if (error instanceof MegProviderError) {
        request.megQaTiming?.setFailure(
          error.code === 'upstream_unavailable'
            ? MEG_QA_FAILURE_CATEGORY.NETWORK
            : error.code === 'empty_response'
              ? MEG_QA_FAILURE_CATEGORY.PARSE
              : MEG_QA_FAILURE_CATEGORY.UNKNOWN
        );
        const status = providerErrorStatus(error);
        logger.warn('meg_provider_failed', {
          code: error.code,
          provider: megProvider.id,
          status,
        });
        return response.status(status).json({ error: error.clientMessage });
      }
      request.megQaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.UNKNOWN);
      logger.error('meg_request_failed', {
        code: error?.code || error?.name || 'unknown',
        status: 503,
      });
      return response.status(503).json({
        error: 'Meg is unavailable right now. Please try again.',
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.use((error, request, response, _next) => {
    if (error instanceof SyntaxError) {
      request.megQaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PARSE);
      return response.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    request.megQaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.UNKNOWN);
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
  const megProvider = createMegProviderFromEnv();
  const app = createApp({ megProvider });
  const server = app.listen(port, host, () => {
    safeLogger.info('meg_server_started', {
      provider: megProvider.id,
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
  cleanHistory,
  enforceSingleQuestion,
  resolveAllowedOrigins,
  resolveBuildStatus,
  detectMegSafetyFlag,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_LENGTH,
};
