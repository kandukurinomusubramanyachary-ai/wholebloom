const { classifyIntentDetailed } = require('../router/intentRouter');
const { routeRequest } = require('../router/modelRouter');
const { detectSafety, safetyFallback, isUrgentCategory } = require('../safety/safetyRouter');
const { buildContext } = require('../context/contextBuilder');
const { buildMegPrompt } = require('../prompts/promptBuilder');
const { retrieveRelevantMemories } = require('../memory/memoryRetriever');
const { extractMemories } = require('../memory/memoryExtractor');
const { guardResponse } = require('../guards/responseGuard');
const { startTrace, finishTrace, publicTraceMetadata, redactError } = require('../telemetry/metrics');
const { validateChatBody } = require('../utils/validation');
const { writeSse } = require('../utils/sse');
const { hashRequest } = require('../utils/hash');

function createChatHandler({ config, providerManager, store, cache, coordinator, logger = console }) {
  return async function chatHandler(req, res) {
    const validation = validateChatBody(req.body, config);
    if (!validation.valid) return res.status(400).json({ error: 'invalid_request', details: validation.errors });
    const body = req.body;
    const userId = body.userId.trim();
    const conversationId = body.conversationId.trim();
    const message = body.message.trim();
    const messageId = body.messageId?.trim() || null;
    const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim().slice(0, 20) : 'en';
    const key = messageId ? `${userId}\0${conversationId}\0${messageId}` : null;
    const requestHash = messageId ? hashRequest({ userId, conversationId, messageId, message, mode: body.mode || 'auto', language, context: body.context || {}, userContext: body.userContext || {} }) : null;

    let dedup = null;
    if (messageId && typeof store.beginRequest === 'function') {
      dedup = safeCall(() => store.beginRequest({ userId, conversationId, messageId, requestHash, staleAfterMs: config.idempotencyStaleMs }), null);
      if (dedup?.conflict) return res.status(409).json({ error: 'message_id_conflict' });
      if (dedup?.row?.status === 'done') return sendCompletedSse(res, { conversationId, messageId, text: dedup.row.responseText, metadata: parseMeta(dedup.row.responseMeta), deduplicated: true });
    }

    const lease = key && coordinator ? coordinator.begin(key) : { owner: true };
    if (!lease.owner) {
      try {
        const result = await lease.promise;
        return sendCompletedSse(res, { ...result, deduplicated: true });
      } catch {
        return res.status(503).json({ error: 'request_in_progress', retryAfterMs: 1000 });
      }
    }
    if (messageId && dedup && !dedup.owner) {
      if (coordinator && coordinator.get?.(key)) {
        try { return sendCompletedSse(res, { ...(await coordinator.get(key).promise), deduplicated: true }); } catch { return res.status(503).json({ error: 'request_in_progress', retryAfterMs: 1000 }); }
      }
      return res.status(409).json({ error: 'request_in_progress', retryAfterMs: 1000 });
    }

    try {
      const result = await runChat({ req, res, config, providerManager, store, cache, body, userId, conversationId, message, messageId, language });
      if (messageId && requestHash && typeof store.completeRequest === 'function') {
        safeCall(() => store.completeRequest({ userId, conversationId, messageId, requestHash, responseText: result.text, responseMeta: replayMetadata(result.metadata, messageId) }));
      }
      if (coordinator && key) coordinator.finish(key, result);
      return result;
    } catch (error) {
      if (messageId && requestHash && typeof store.releaseRequest === 'function') safeCall(() => store.releaseRequest({ userId, conversationId, messageId, requestHash }));
      if (coordinator && key) coordinator.fail(key, error);
      if (!res.headersSent) return res.status(500).json({ error: 'internal_error' });
      if (!res.writableEnded && !res.destroyed) { writeSse(res, 'error', { error: 'meg_unavailable' }); res.end(); }
      logger.error?.({ event: 'chat_handler_error', traceId: req.megTraceId, error: redactError(error) });
    }
  };
}

async function runChat({ req, res, config, providerManager, store, cache, body, userId, conversationId, message, messageId, language }) {
  const requestStartedAt = Date.now();
  const safety = detectSafety(message);
  const intentDetails = classifyIntentDetailed({ message, safety });
  const routing = routeRequest({ message, mode: body.mode || 'auto', safety, intentDetails, providerOrders: config.providerOrders });
  const trace = startTrace({ intent: routing.intent, route: routing.route, engineVersion: config.engineVersion, promptVersion: config.promptVersion, routerVersion: config.routerVersion, safetyTriggered: safety.triggered });
  trace.startedAt = requestStartedAt;
  trace.routingMs = Date.now() - requestStartedAt;
  req.megTraceId = trace.traceId;

  const contextStart = Date.now();
  const contextPromise = Promise.resolve().then(() => safeCall(() => buildContext({ intent: routing.intent, message, context: body.context || {}, userContext: body.userContext || {} }), {}));
  const recentPromise = Promise.resolve().then(() => safeCall(() => store.getRecentMessages({ userId, conversationId, limit: config.recentMessageLimit }), []));
  const userWritePromise = Promise.resolve().then(() => safeCall(() => store.appendMessage({ userId, conversationId, role: 'user', content: message, clientMessageId: messageId }), null));
  const selectedContext = await contextPromise;
  trace.contextMs = Date.now() - contextStart;
  const memoryStart = Date.now();
  const [recentMessages, memories] = await Promise.all([
    recentPromise,
    Promise.resolve().then(() => safeCall(() => retrieveRelevantMemories({ store, userId, message, context: selectedContext, intent: routing.intent, limit: config.memoryLimit }), [])), 
  ]);
  trace.memoryRetrievalMs = Date.now() - memoryStart;
  await userWritePromise;
  const prompt = buildMegPrompt({ intent: routing.intent, context: selectedContext, memories, recentMessages, message, language, tokenBudget: config.tokenBudget, promptVersion: config.promptVersion });
  trace.inputTokenEstimate = Math.ceil(prompt.reduce((total, item) => total + String(item.content || '').length, 0) / 4);
  const cacheRequest = { intent: routing.intent, message, language, safety, promptVersion: config.promptVersion, knowledgeVersion: config.knowledgeVersion };
  const canUseCache = config.features?.cache !== false && safeCall(() => cache.isCacheable(cacheRequest), false);
  const cached = canUseCache ? safeCall(() => cache.get(cacheRequest), null) : null;
  trace.cacheHit = Boolean(cached);

  const connection = openSse(res, { conversationId, messageId, routing, trace, config, cacheHit: Boolean(cached) });
  if (safety.triggered && isUrgentCategory(safety.category)) {
    const answer = safetyFallback(safety.category);
    connection.emitMany(answer);
    return finishChat({ text: answer, trace, state: {}, store, cache, config, userId, conversationId, message, selectedContext, intent: routing.intent, messageId, safety, canUseCache, providerError: null, connection, cacheRequest, generationMs: 0 });
  }
  if (cached) {
    connection.emitMany(cached);
    return finishChat({ text: cached, trace, state: {}, store, cache, config, userId, conversationId, message, selectedContext, intent: routing.intent, messageId, safety, canUseCache, providerError: null, connection, cached: true, cacheRequest, generationMs: 0 });
  }

  const state = { fallbacks: 0 };
  let fullText = '';
  let providerError = null;
  const stream = providerManager.stream({
    providerNames: routing.preferredProviders, route: routing.route, messages: prompt,
    temperature: routing.route === 'SMART' || routing.route === 'DOCTOR' ? 0.45 : 0.7,
    maxTokens: routing.route === 'SMART' ? Math.min(Number(config.maxOutputTokens) || 900, 1200) : (Number(config.maxOutputTokens) || 900),
    signal: connection.signal,
  }, state);
  const generationStartedAt = Date.now();
  try {
    if (safety.triggered || config.features?.streaming === false) {
      let generatedText = '';
      for await (const token of stream) generatedText += token;
      const guarded = guardResponse(generatedText, { maxChars: config.maxResponseChars, safety: true, safetyCategory: safety.category });
      const answer = guarded.ok ? guarded.text : safetyFallback(safety.category || 'diagnosis_request');
      connection.emitMany(answer);
      fullText = connection.text;
    } else {
      for await (const token of stream) {
        if (connection.closed) break;
        connection.emit(token);
      }
      const guarded = guardResponse(connection.text, { maxChars: config.maxResponseChars });
      if (!guarded.ok && !connection.closed) {
        fullText = outageFallback();
        connection.replace(fullText);
      } else fullText = guarded.text;
    }
  } catch (error) {
    if (connection.closed && error.code === 'CLIENT_ABORT') throw error;
    providerError = error;
    if (error.partial && connection.text) {
      connection.emit(' I lost the connection before I could finish. Please send that again and I will continue.');
      fullText = connection.text;
    } else if (!connection.closed) {
      const fallback = safety.triggered ? safetyFallback(safety.category) : outageFallback();
      connection.replace(fallback);
      fullText = connection.text;
    } else fullText = connection.text;
  }
  if (!fullText) fullText = connection.text || (safety.triggered ? safetyFallback(safety.category) : outageFallback());
  const finalGuard = guardResponse(fullText, { maxChars: config.maxResponseChars, safety: safety.triggered, safetyCategory: safety.category });
  if (!finalGuard.ok) {
    fullText = safety.triggered ? safetyFallback(safety.category) : outageFallback();
    if (!connection.closed) connection.replace(fullText);
  } else fullText = finalGuard.text;
  trace.provider = state.provider || null;
  trace.providerConnectMs = state.providerConnectMs || null;
  trace.providerLatencyMs = state.providerLatencyMs || null;
  trace.fallbacks = state.fallbacks || 0;
  trace.retries = state.retries || 0;
  return finishChat({ text: fullText, trace, state, store, cache, config, userId, conversationId, message, selectedContext, intent: routing.intent, messageId, safety, canUseCache, providerError, connection, cacheRequest, generationStartedAt });
}

function finishChat({ text, trace, state, store, cache, config, userId, conversationId, message, selectedContext, intent, messageId, safety, canUseCache, providerError, connection, cached = false, cacheRequest, generationStartedAt, generationMs }) {
  trace.firstTokenAt = trace.firstTokenAt || connection.firstTokenAt;
  trace.generationMs = generationMs ?? (generationStartedAt ? Date.now() - generationStartedAt : 0);
  const persistenceStartedAt = Date.now();
  const assistantMessage = safeCall(() => store.appendMessage({ userId, conversationId, role: 'assistant', content: String(text) }), null);
  trace.persistenceMs = Date.now() - persistenceStartedAt;
  finishTrace(trace, { provider: state.provider, providerConnectMs: state.providerConnectMs, providerLatencyMs: state.providerLatencyMs, fallbacks: state.fallbacks || 0, retries: state.retries || 0, cacheHit: cached, outputTokenEstimate: Math.ceil(String(text).length / 4), tokenEstimate: Math.ceil(String(text).length / 4), safetyTriggered: safety.triggered, generationMs: trace.generationMs, persistenceMs: trace.persistenceMs });
  if (canUseCache && !providerError && text) safeCall(() => cache.set(cacheRequest || { intent, message, language: 'en', promptVersion: config.promptVersion, knowledgeVersion: config.knowledgeVersion }, text));
  setImmediate(() => {
    if (!safety.triggered) for (const memory of extractMemories({ message, context: selectedContext, intent })) safeCall(() => store.addMemory({ userId, conversationId, ...memory }));
    safeCall(() => store.saveProviderMetric({ ...trace }));
  });
  const metadata = { messageId: assistantMessage?.id || null, ...publicTraceMetadata(trace, { development: config.nodeEnv === 'development' }) };
  if (!connection.closed) { connection.done(metadata); }
  return { conversationId, messageId, text: String(text), metadata };
}

function openSse(res, { conversationId, messageId, routing, trace, config, cacheHit = false }) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Trace-Id', trace.traceId);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  writeSse(res, 'start', { conversationId, messageId, intent: routing.intent, route: routing.route });
  writeSse(res, 'metadata', { engineVersion: config.engineVersion, cacheHit: Boolean(cacheHit), safetyTriggered: Boolean(trace.safetyTriggered) });
  let closed = false;
  let text = '';
  let firstTokenAt = null;
  const abortController = new AbortController();
  const heartbeat = config.heartbeatMs > 0 ? setInterval(() => { if (!closed) res.write(': keep-alive\n\n'); }, config.heartbeatMs) : null;
  const cleanup = () => { closed = true; if (heartbeat) clearInterval(heartbeat); abortController.abort(); };
  res.on('close', cleanup);
  const emit = (chunk) => {
    if (!chunk || closed) return;
    text += chunk;
    firstTokenAt = firstTokenAt || Date.now();
    writeSse(res, 'token', { text: chunk });
  };
  return {
    signal: abortController.signal,
    get closed() { return closed; },
    get text() { return text; },
    get firstTokenAt() { return firstTokenAt; },
    emit,
    emitMany(answer) { for (const chunk of chunkText(answer, config.features.streaming ? 80 : String(answer).length)) emit(chunk); },
    replace(answer) { if (closed) return; writeSse(res, 'replace', { text: String(answer) }); text = String(answer); firstTokenAt = firstTokenAt || Date.now(); },
    done(metadata) { if (!closed) { writeSse(res, 'done', metadata); clearInterval(heartbeat); res.end(); } },
  };
}

function sendCompletedSse(res, { conversationId, messageId, text, metadata = {}, deduplicated = false }) {
  const safeMeta = replayMetadata(metadata, messageId);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  writeSse(res, 'start', { conversationId, messageId, deduplicated: Boolean(deduplicated) });
  for (const chunk of chunkText(text, 80)) writeSse(res, 'token', { text: chunk });
  writeSse(res, 'done', { ...safeMeta, messageId, deduplicated: Boolean(deduplicated) });
  res.end();
}

function replayMetadata(metadata = {}, messageId) { return { traceId: metadata.traceId || null, messageId: messageId || metadata.messageId || null }; }
function parseMeta(value) { if (!value) return {}; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch { return {}; } }
function safeCall(fn, fallback = null) { try { return fn(); } catch { return fallback; } }
function* chunkText(text, size = 80) { const value = String(text || ''); for (let index = 0; index < value.length; index += Math.max(1, size)) yield value.slice(index, index + size); }
function outageFallback() { return "I'm having trouble reaching my conversation service right now. I’m still here with you—please try again in a moment. If this is about severe or rapidly worsening symptoms, seek urgent medical care instead of waiting here."; }

module.exports = { createChatHandler, runChat, openSse, sendCompletedSse, chunkText, outageFallback };
