const { randomUUID } = require('node:crypto');

function startTrace({ intent, route, engineVersion = '0.2.0', promptVersion = 'meg-prompt-v2', routerVersion = 'deterministic-router-v2', safetyTriggered = false, cacheHit = false } = {}) {
  return {
    traceId: randomUUID(), startedAt: Date.now(), intent, route, engineVersion, promptVersion, routerVersion,
    provider: null, fallbacks: 0, retries: 0, inputTokenEstimate: 0, outputTokenEstimate: 0, tokenEstimate: 0, safetyTriggered, cacheHit, revisionTriggered: false,
  };
}

function finishTrace(trace, fields = {}) {
  const now = Date.now();
  Object.assign(trace, fields);
  trace.ttftMs = trace.firstTokenAt ? trace.firstTokenAt - trace.startedAt : null;
  trace.totalMs = now - trace.startedAt;
  trace.outputTokenEstimate = fields.outputTokenEstimate ?? fields.tokenEstimate ?? trace.outputTokenEstimate ?? 0;
  trace.tokenEstimate = trace.outputTokenEstimate;
  return trace;
}

function publicTraceMetadata(trace, { development = false } = {}) {
  if (!development) return { traceId: trace.traceId };
  return {
    traceId: trace.traceId, ttftMs: trace.ttftMs, totalMs: trace.totalMs, fallbacks: trace.fallbacks, retries: trace.retries,
    routingMs: trace.routingMs, contextMs: trace.contextMs, memoryRetrievalMs: trace.memoryRetrievalMs, generationMs: trace.generationMs, persistenceMs: trace.persistenceMs,
    provider: trace.provider, providerConnectMs: trace.providerConnectMs, providerLatencyMs: trace.providerLatencyMs,
    cacheHit: trace.cacheHit, safetyTriggered: trace.safetyTriggered, revisionTriggered: trace.revisionTriggered, inputTokenEstimate: trace.inputTokenEstimate, outputTokenEstimate: trace.outputTokenEstimate,
    engineVersion: trace.engineVersion, promptVersion: trace.promptVersion, routerVersion: trace.routerVersion,
  };
}

function redactError(error) { return { name: error?.name || 'Error', code: error?.code || 'UNKNOWN', status: error?.status || null }; }

module.exports = { startTrace, finishTrace, publicTraceMetadata, redactError };
