const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { writeMegQaTiming } = require('./safeLogger');

const MEG_QA_FAILURE_CATEGORY = Object.freeze({
  NONE: 0,
  AUTH: 1,
  NETWORK: 2,
  PROVIDER_4XX: 3,
  PROVIDER_5XX: 4,
  PROVIDER_TIMEOUT: 5,
  PARSE: 6,
  PERSISTENCE: 7,
  UNKNOWN: 8,
});

const SERVER_DURATION_FIELDS = new Set([
  'server_auth_ms',
  'user_msg_persist_ms',
  'provider_headers_ms',
  'provider_body_ms',
  'provider_total_ms',
  'revision_provider_total_ms',
  'assistant_msg_persist_ms',
]);

const TRACE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMegQaTimingEnabled(environment = process.env) {
  return environment.MEG_QA_TIMING === '1';
}

function validTraceId(value) {
  return typeof value === 'string' && TRACE_ID_PATTERN.test(value);
}

function createServerMegQaTiming({
  enabled = isMegQaTimingEnabled(),
  requestedTraceId,
  now = () => performance.now(),
  uuid = randomUUID,
  emit = writeMegQaTiming,
} = {}) {
  if (!enabled) return null;

  const traceId = validTraceId(requestedTraceId) ? requestedTraceId : uuid();
  const requestStartedAt = now();
  const metrics = { revision_triggered: 0 };
  let failureCategory = MEG_QA_FAILURE_CATEGORY.NONE;
  let emitted = false;

  return {
    traceId,
    mark() {
      return now();
    },
    recordDuration(field, startedAt, finishedAt = now()) {
      if (!SERVER_DURATION_FIELDS.has(field)) return;
      if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return;
      metrics[field] = Math.max(0, finishedAt - startedAt);
    },
    setRevisionTriggered(value) {
      metrics.revision_triggered = value === 1 ? 1 : 0;
    },
    setFailure(category) {
      if (
        failureCategory === MEG_QA_FAILURE_CATEGORY.NONE
        && category !== MEG_QA_FAILURE_CATEGORY.NONE
        && Number.isInteger(category)
        && category >= MEG_QA_FAILURE_CATEGORY.NONE
        && category <= MEG_QA_FAILURE_CATEGORY.UNKNOWN
      ) {
        failureCategory = category;
      }
    },
    finish(responseStatus) {
      if (emitted) return;
      const status = Number.isFinite(responseStatus)
        ? Math.max(0, Math.round(responseStatus))
        : 0;
      if (failureCategory === MEG_QA_FAILURE_CATEGORY.NONE && status >= 400) {
        failureCategory = status === 401
          ? MEG_QA_FAILURE_CATEGORY.AUTH
          : MEG_QA_FAILURE_CATEGORY.UNKNOWN;
      }
      metrics.server_total_ms = Math.max(0, now() - requestStartedAt);
      emitted = true;
      emit({
        trace_id: traceId,
        ...metrics,
        status,
        failure_category: failureCategory,
      });
    },
  };
}

module.exports = {
  MEG_QA_FAILURE_CATEGORY,
  SERVER_DURATION_FIELDS,
  TRACE_ID_PATTERN,
  createServerMegQaTiming,
  isMegQaTimingEnabled,
  validTraceId,
};
