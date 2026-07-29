import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_STAGE_KEY = '@bloom/startup/last-stage';
const LAST_FAILURE_KEY = '@bloom/startup/last-failure';
const DEFAULT_STAGE = 'app-mounted';
const DEFAULT_MESSAGE = 'Bloom encountered an unexpected startup error.';

const STARTUP_STAGES = new Set([
  'app-mounted',
  'firebase-config',
  'firebase-initialised',
  'auth-resolving',
  'profile-loading',
  'navigation-ready',
]);

let currentStage = DEFAULT_STAGE;
let memoryFailure = null;

function normaliseStage(stage) {
  return STARTUP_STAGES.has(stage) ? stage : currentStage || DEFAULT_STAGE;
}

export function sanitizeStartupError(error, fallback = DEFAULT_MESSAGE) {
  const rawMessage = typeof error === 'string'
    ? error
    : typeof error?.message === 'string'
      ? error.message
      : fallback;

  const sanitized = String(rawMessage || fallback)
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bAIza[\w-]{20,}\b/g, '[redacted-key]')
    .replace(/\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){1,2}\b/g, '[redacted-token]')
    .replace(
      /\b(password|token|secret|api[_-]?key|authorization)\s*[:=]\s*[^\s,;}]+/gi,
      '$1=[redacted]'
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/[^\s]+/gi, '[redacted-url]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 180);

  return sanitized || fallback;
}

export function createStartupFailure(error, stage = currentStage, fallback = DEFAULT_MESSAGE) {
  return {
    stage: normaliseStage(stage),
    message: sanitizeStartupError(error, fallback),
    timestamp: new Date().toISOString(),
  };
}

export function getStartupStage() {
  return currentStage;
}

export function setStartupStage(stage) {
  currentStage = normaliseStage(stage);
  AsyncStorage.setItem(LAST_STAGE_KEY, currentStage).catch(() => {});
  return currentStage;
}

export function recordStartupFailure(error, stage = currentStage, fallback = DEFAULT_MESSAGE) {
  const failure = createStartupFailure(error, stage, fallback);
  currentStage = failure.stage;
  memoryFailure = failure;

  AsyncStorage.multiSet([
    [LAST_STAGE_KEY, failure.stage],
    [LAST_FAILURE_KEY, JSON.stringify(failure)],
  ]).catch(() => {});

  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error('[Bloom startup] ' + failure.stage + ': ' + failure.message);
  }

  return failure;
}

export async function loadLastStartupFailure() {
  if (memoryFailure) return memoryFailure;

  try {
    const value = await AsyncStorage.getItem(LAST_FAILURE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;

    const failure = {
      stage: normaliseStage(parsed.stage),
      message: sanitizeStartupError(parsed.message),
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : null,
    };
    memoryFailure = failure;
    return failure;
  } catch {
    return null;
  }
}

export async function clearStartupFailure() {
  memoryFailure = null;
  await AsyncStorage.removeItem(LAST_FAILURE_KEY).catch(() => {});
}

export function markStartupReady() {
  setStartupStage('navigation-ready');
  memoryFailure = null;
  AsyncStorage.removeItem(LAST_FAILURE_KEY).catch(() => {});
}

export function installGlobalErrorHandler() {
  if (typeof globalThis === 'undefined' || globalThis.__bloomStartupHandlerInstalled) {
    return false;
  }

  const errorUtils = globalThis.ErrorUtils;
  if (
    !errorUtils
    || typeof errorUtils.getGlobalHandler !== 'function'
    || typeof errorUtils.setGlobalHandler !== 'function'
  ) {
    return false;
  }

  const originalHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    recordStartupFailure(error, currentStage);
    if (typeof originalHandler === 'function') {
      originalHandler(error, isFatal);
    }
  });
  globalThis.__bloomStartupHandlerInstalled = true;
  return true;
}

