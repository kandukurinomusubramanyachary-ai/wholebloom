import * as Crypto from 'expo-crypto';

const MEG_QA_TIMING_ENABLED = process.env.EXPO_PUBLIC_MEG_QA_TIMING === '1';

export const MEG_QA_FAILURE_CATEGORY = Object.freeze({
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

const CLIENT_DURATION_FIELDS = new Set([
  'client_token_acquisition_ms',
  'client_http_total_ms',
  'tap_to_visible_reply_ms',
]);

function roundedDuration(value) {
  return Math.max(1, Math.round(value));
}

export function createClientMegQaTiming() {
  if (!MEG_QA_TIMING_ENABLED) return null;

  const traceId = Crypto.randomUUID();
  const tapStartedAt = performance.now();
  const durations = {};
  let localPersistDuration = 0;
  let localPersistRecorded = false;
  let status = 0;
  let failureCategory = MEG_QA_FAILURE_CATEGORY.NONE;
  let replyVisible = false;
  let visibleReplyExpected = false;
  let attemptSettled = false;
  let emitted = false;

  function emitIfReady() {
    if (emitted || !attemptSettled) return;
    if (visibleReplyExpected && !replyVisible) return;

    const payload = { trace_id: traceId };
    for (const field of CLIENT_DURATION_FIELDS) {
      if (Number.isFinite(durations[field])) {
        payload[field] = roundedDuration(durations[field]);
      }
    }
    if (localPersistRecorded) {
      payload.client_local_persist_ms = roundedDuration(localPersistDuration);
    }
    payload.status = Number.isFinite(status) ? Math.max(0, Math.round(status)) : 0;
    payload.failure_category = failureCategory;

    emitted = true;
    console.log(`[meg-qa] ${JSON.stringify(payload)}`);
  }

  return {
    traceId,
    mark() {
      return performance.now();
    },
    recordDuration(field, startedAt, finishedAt = performance.now()) {
      if (!CLIENT_DURATION_FIELDS.has(field)) return;
      if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return;
      durations[field] = Math.max(0, finishedAt - startedAt);
    },
    recordLocalPersist(startedAt, finishedAt = performance.now()) {
      if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return;
      localPersistDuration += Math.max(0, finishedAt - startedAt);
      localPersistRecorded = true;
    },
    setStatus(value) {
      if (Number.isFinite(value)) status = value;
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
    markVisibleReply() {
      durations.tap_to_visible_reply_ms = Math.max(0, performance.now() - tapStartedAt);
      replyVisible = true;
      emitIfReady();
    },
    completeSuccess() {
      failureCategory = MEG_QA_FAILURE_CATEGORY.NONE;
      visibleReplyExpected = true;
      attemptSettled = true;
      emitIfReady();
    },
    completeFailure() {
      if (failureCategory === MEG_QA_FAILURE_CATEGORY.NONE) {
        failureCategory = MEG_QA_FAILURE_CATEGORY.UNKNOWN;
      }
      attemptSettled = true;
      emitIfReady();
    },
  };
}

export { MEG_QA_TIMING_ENABLED };
