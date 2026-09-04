/**
 * Bloom Strength — strict summary serializer and privacy guards.
 *
 * Private by construction (PRD §12, §14): the ONLY data allowed to leave the
 * device runtime is the documented session summary schema. Frames, video,
 * audio, landmarks, coordinates, angle timelines, body measurements and
 * inferred attributes are forbidden at every nesting level — this module
 * structurally rejects them, and a deep forbidden-key scan catches regressions.
 */

export const PRIVACY_VERSION = 'strength-privacy-v1';

export const COMPLETION_STATES = Object.freeze(['completed', 'stopped', 'abandoned']);
export const PLATFORMS = Object.freeze(['web', 'native']);

/** cueCounts allowlist: bounded set of cue ids, max 20 keys. */
export const ALLOWED_CUE_KEYS = Object.freeze([
  'auto-pause',
  'resume',
  'find-person',
  'frame-lower',
  'frame-higher',
  'frame-farther',
  'frame-closer',
  'frame-step-left',
  'frame-step-right',
  'turn-side',
  'turn-front',
  'restore-ankle-knee',
  'restore-shoulder-wrist',
  'restore-both-feet',
  'form-squat-slow',
  'form-squat-control',
  'form-squat-stand-tall',
  'form-pushup-slow',
  'form-pushup-body-line',
  'form-pushup-extend',
  'form-legraise-lower-slow',
  'form-legraise-torso',
  'form-legraise-centre',
  // Priority-1 system cue (second person present). Throttled by the
  // scheduler; counted once per announcement so multi-person sets persist.
  'multiple-people',
  'encouragement',
]);

/**
 * Forbidden key fragments (matched after normalizing camelCase/snake_case
 * into words). A match anywhere in an object's keys fails serialization.
 * NOTE: 'frame' is excluded here because the allowlisted cue-count keys
 * legitimately contain the word "frame" (e.g. frame-lower, frame-closer).
 * Raw video frame data is still blocked by video/photo/landmark/coordinate
 * keys, and by the FORBIDDEN_VALUE_SUBSTRINGS data-URI/blob checks; cueCounts
 * is additionally whitelisted key-by-key in serializeSessionSummary.
 */
const FORBIDDEN_KEY_PATTERNS = Object.freeze([
  'photo', 'screenshot', 'video', 'audio', 'transcript',
  'landmark', 'coordinate', 'angle', 'measurement', 'pose',
  'demographic', 'medical', 'clothing', 'room', 'background',
  'weight', 'bmi', 'bodyfat', 'pregnant', 'pregnancy', 'disability',
  'diagnosis', 'diagnose', 'symptom', 'fertility', 'calorie',
  'skin', 'tone', 'height',
]);

/** Raw media frame keys — checked against free-form payloads (never against
 *  the curated cueCounts map, whose keys are an explicit allowlist). */
const FORBIDDEN_RAW_MEDIA_KEYS = Object.freeze([
  'frame', 'frames', 'rawframe', 'pose', 'poses', 'image', 'bitmap',
]);

const FORBIDDEN_VALUE_SUBSTRINGS = Object.freeze([
  'data:image', 'data:video', 'data:audio', 'blob:', 'mediapipe',
]);

const ID_MAX = 160;
const DURATION_MAX = 14400;
const REPS_MAX = 100;
const CUE_MAP_MAX = 20;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function wordsFromKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-./]/g, ' ')
    .toLowerCase();
}

/** Match a pattern as a singular/plural word: 'landmark' must catch
 *  'landmarks', 'frame' must catch 'frames', etc. */
function keyHasWord(words, pattern) {
  const wordList = words.split(' ').filter(Boolean);
  return wordList.some((w) => w === pattern || w === `${pattern}s`);
}

/**
 * Deep scan for forbidden keys/values. Throws on violation.
 * Used in tests and release inspection against real payloads.
 *
 * @param {*} value
 * @param {string} [path]
 * @param {object} [opts]
 * @param {boolean} [opts.allowFrameWords=false] - set when scanning a payload
 *   whose keys are already an explicit allowlist (cueCounts); raw media keys
 *   are still checked in the surrounding object.
 */
export function assertNoForbiddenData(value, path = 'root', opts = {}) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    for (const bad of FORBIDDEN_VALUE_SUBSTRINGS) {
      if (lower.includes(bad)) {
        throw new Error(`Forbidden value content at ${path}: contains "${bad}"`);
      }
    }
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoForbiddenData(item, `${path}[${i}]`, opts));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const words = wordsFromKey(key);
      for (const pattern of FORBIDDEN_KEY_PATTERNS) {
        if (keyHasWord(words, pattern)) {
          throw new Error(`Forbidden key at ${path}.${key} (matches "${pattern}")`);
        }
      }
      // Raw frame/pose keys are forbidden everywhere except inside the
      // curated cueCounts allowlist (scanned with allowFrameWords).
      if (!opts.allowFrameWords) {
        for (const pattern of FORBIDDEN_RAW_MEDIA_KEYS) {
          if (keyHasWord(words, pattern)) {
            throw new Error(`Forbidden key at ${path}.${key} (matches "${pattern}")`);
          }
        }
      }
      // cueCounts keys are an explicit allowlist — don't word-scan them.
      const childOpts = key === 'cueCounts' ? { allowFrameWords: true } : opts;
      assertNoForbiddenData(child, `${path}.${key}`, childOpts);
    }
  }
}

function requireType(obj, key, type, { allowNull = false } = {}) {
  const v = obj[key];
  if (v === null || v === undefined) {
    if (allowNull) return;
    throw new Error(`Session summary missing required field: ${key}`);
  }
  const actual = Array.isArray(v) ? 'array' : typeof v;
  if (actual !== type) throw new Error(`Field ${key} must be ${type}, got ${actual}`);
}

function intInRange(v, min, max, field) {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new Error(`Field ${field} must be integer in [${min}, ${max}], got ${v}`);
  }
}

/**
 * Serialize a session result to the ONLY schema permitted through the
 * outbox / Firestore / analytics. Throws on any deviation or forbidden data.
 *
 * @param {object} input
 * @param {string} input.id - opaque session id
 * @param {string} input.exerciseId
 * @param {number} input.exerciseVersion
 * @param {number|string} input.startedAt - epoch ms or ISO string
 * @param {number|string} input.completedAt
 * @param {number} input.durationSeconds
 * @param {number} input.targetReps
 * @param {number} input.acceptedReps
 * @param {number} input.pauseCount
 * @param {object} [input.cueCounts]
 * @param {'completed'|'stopped'|'abandoned'} input.completionState
 * @param {'web'|'native'} input.platform
 * @param {string} [input.mode] - 'camera' | 'camera-free' (approved primitive)
 * @returns {object} sanitized summary safe to persist
 */
export function serializeSessionSummary(input) {
  if (!isPlainObject(input)) throw new Error('Summary must be an object');

  requireType(input, 'id', 'string');
  requireType(input, 'exerciseId', 'string');
  requireType(input, 'exerciseVersion', 'number');
  requireType(input, 'startedAt', 'number');
  requireType(input, 'completedAt', 'number');
  requireType(input, 'durationSeconds', 'number');
  requireType(input, 'targetReps', 'number');
  requireType(input, 'acceptedReps', 'number');
  requireType(input, 'pauseCount', 'number');
  requireType(input, 'completionState', 'string');
  requireType(input, 'platform', 'string');

  if (input.id.length === 0 || input.id.length > ID_MAX) {
    throw new Error(`Field id must be 1–${ID_MAX} chars`);
  }
  if (!/^[a-z0-9-]+$/.test(input.exerciseId)) {
    throw new Error(`Field exerciseId has invalid format: ${input.exerciseId}`);
  }
  intInRange(input.exerciseVersion, 1, 999, 'exerciseVersion');
  intInRange(input.startedAt, 0, Number.MAX_SAFE_INTEGER, 'startedAt');
  intInRange(input.completedAt, input.startedAt, Number.MAX_SAFE_INTEGER, 'completedAt');
  intInRange(input.durationSeconds, 0, DURATION_MAX, 'durationSeconds');
  intInRange(input.targetReps, 1, REPS_MAX, 'targetReps');
  intInRange(input.acceptedReps, 0, REPS_MAX, 'acceptedReps');
  intInRange(input.pauseCount, 0, 1000, 'pauseCount');
  if (!COMPLETION_STATES.includes(input.completionState)) {
    throw new Error(`Field completionState must be one of ${COMPLETION_STATES.join('/')}`);
  }
  if (!PLATFORMS.includes(input.platform)) {
    throw new Error(`Field platform must be one of ${PLATFORMS.join('/')}`);
  }
  if (input.mode !== undefined && input.mode !== 'camera' && input.mode !== 'camera-free') {
    throw new Error('Field mode must be "camera" or "camera-free"');
  }

  const cueCounts = {};
  if (input.cueCounts !== undefined && input.cueCounts !== null) {
    if (!isPlainObject(input.cueCounts)) throw new Error('Field cueCounts must be an object');
    const entries = Object.entries(input.cueCounts);
    if (entries.length > CUE_MAP_MAX) {
      throw new Error(`Field cueCounts may have at most ${CUE_MAP_MAX} keys`);
    }
    for (const [key, value] of entries) {
      if (!ALLOWED_CUE_KEYS.includes(key)) {
        throw new Error(`cueCounts key not allowlisted: ${key}`);
      }
      intInRange(value, 0, 10000, `cueCounts.${key}`);
      cueCounts[key] = value;
    }
  }

  const summary = {
    id: input.id,
    exerciseId: input.exerciseId,
    exerciseVersion: input.exerciseVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationSeconds: input.durationSeconds,
    targetReps: input.targetReps,
    acceptedReps: input.acceptedReps,
    pauseCount: input.pauseCount,
    cueCounts,
    completionState: input.completionState,
    platform: input.platform,
    privacyVersion: PRIVACY_VERSION,
  };
  if (input.mode) summary.mode = input.mode;

  // DISPLAY-ONLY data is explicitly recognised at the boundary so it never
  // reaches persistence. We require it to be (a) absent or a plain object,
  // and (b) composed solely of string/null primitive copy. It is then
  // DROPPED from the persisted summary rather than copied. A structured or
  // media-bearing display block fails closed here and in the deep scan.
  if (input.display !== undefined && input.display !== null) {
    if (!isPlainObject(input.display)) {
      throw new Error('Field display must be an object of display-only copy');
    }
    for (const [key, value] of Object.entries(input.display)) {
      if (value !== null && typeof value !== 'string') {
        throw new Error(`Display-only field display.${key} must be a string or null`);
      }
    }
    // Defense in depth: a display block must itself contain no media/geometry.
    assertNoForbiddenData(input.display, 'summary.display');
  }

  // If a privacy version is supplied it must match the enforced version;
  // the serializer always stamps the current PRIVACY_VERSION on output.
  if (input.privacyVersion !== undefined && input.privacyVersion !== PRIVACY_VERSION) {
    throw new Error(
      `privacyVersion mismatch: expected ${PRIVACY_VERSION}, got ${input.privacyVersion}`,
    );
  }

  // Reject ANY unrecognized input key rather than silently dropping it. A
  // new field reaching the serializer must be explicitly approved first, and
  // forbidden keys are caught here (and again by the deep scan below).
  // 'display' and 'privacyVersion' are KNOWN, handled-at-the-boundary fields:
  // display is dropped (never persisted); privacyVersion is verified/stamped.
  const ALLOWED_INPUT_KEYS = new Set([
    'id', 'exerciseId', 'exerciseVersion', 'startedAt', 'completedAt',
    'durationSeconds', 'targetReps', 'acceptedReps', 'pauseCount',
    'cueCounts', 'completionState', 'platform', 'mode',
    'display', 'privacyVersion',
  ]);
  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_KEYS.has(key)) {
      const words = wordsFromKey(key);
      const allPatterns = [...FORBIDDEN_KEY_PATTERNS, ...FORBIDDEN_RAW_MEDIA_KEYS];
      const hit = allPatterns.find((p) => keyHasWord(words, p));
      if (hit) {
        throw new Error(`Forbidden key at summary.${key} (matches "${hit}")`);
      }
      throw new Error(`Unknown summary field not in approved schema: ${key}`);
    }
  }

  // Defense in depth: scan the exact payload that will leave the device.
  assertNoForbiddenData(summary);
  return summary;
}

/**
 * Privacy-safe analytics events (PRD §17). Properties are limited to approved
 * primitives; no health context, room info, pose data, free text or Meg data.
 */
const EVENT_ALLOWLIST = Object.freeze({
  'strength_opened': [],
  'exercise_selected': ['exerciseId', 'exerciseVersion'],
  'camera_requested': [],
  'camera_result': ['result'], // 'granted' | 'denied' | 'busy' | 'error'
  'calibration_result': ['exerciseId', 'exerciseVersion', 'result', 'durationBucket'],
  'session_started': ['exerciseId', 'exerciseVersion', 'mode'],
  'session_paused': ['exerciseId', 'reason'], // 'auto' | 'user' | 'hidden'
  'session_resumed': ['exerciseId'],
  'session_completed': ['exerciseId', 'exerciseVersion', 'mode', 'acceptedReps', 'targetReps', 'durationBucket', 'pauseCount'],
  'session_stopped': ['exerciseId', 'exerciseVersion', 'mode', 'acceptedReps', 'reason'],
  'fallback_started': ['exerciseId', 'reason'],
  'summary_viewed': ['exerciseId', 'completionState'],
});

const EVENT_ENUM_PROPS = Object.freeze({
  result: ['granted', 'denied', 'busy', 'error', 'success', 'failed', 'timeout'],
  mode: ['camera', 'camera-free'],
  reason: ['auto', 'user', 'hidden', 'permission', 'camera-busy', 'model-load', 'low-light', 'occlusion', 'out-of-frame', 'multiple-people', 'slow-inference', 'rotated', 'offline', 'manual'],
  completionState: COMPLETION_STATES,
});

const DURATION_BUCKETS = Object.freeze(['lt1m', '1to3m', '3to5m', '5to10m', 'gt10m']);

/** Validate (and normalize) an analytics event. Throws on anything unapproved. */
export function validateAnalyticsEvent(event) {
  if (!isPlainObject(event)) throw new Error('Event must be an object');
  const { name, properties } = event;
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(EVENT_ALLOWLIST, name)) {
    throw new Error(`Analytics event not allowlisted: ${name}`);
  }
  const allowedProps = EVENT_ALLOWLIST[name];
  const clean = { name, properties: {} };
  if (properties) {
    if (!isPlainObject(properties)) throw new Error('Event properties must be an object');
    for (const [key, value] of Object.entries(properties)) {
      if (!allowedProps.includes(key)) {
        throw new Error(`Property "${key}" not allowed on event ${name}`);
      }
      if (key === 'exerciseId') {
        if (typeof value !== 'string' || !/^[a-z0-9-]+$/.test(value)) {
          throw new Error(`Invalid exerciseId: ${value}`);
        }
        clean.properties[key] = value;
      } else if (key === 'exerciseVersion' || key === 'acceptedReps' || key === 'targetReps' || key === 'pauseCount') {
        if (!Number.isInteger(value) || value < 0) throw new Error(`Property ${key} must be a non-negative integer`);
        clean.properties[key] = value;
      } else if (EVENT_ENUM_PROPS[key]) {
        if (!EVENT_ENUM_PROPS[key].includes(value)) {
          throw new Error(`Property ${key} has unapproved value: ${value}`);
        }
        clean.properties[key] = value;
      } else if (key === 'durationBucket') {
        if (!DURATION_BUCKETS.includes(value)) throw new Error(`Invalid durationBucket: ${value}`);
        clean.properties[key] = value;
      } else {
        throw new Error(`Unvalidated property type for ${key}`);
      }
    }
  }
  assertNoForbiddenData(clean);
  return clean;
}

/** Coarse duration bucket used by analytics (never an exact timestamp). */
export function durationBucket(seconds) {
  if (seconds < 60) return 'lt1m';
  if (seconds < 180) return '1to3m';
  if (seconds < 300) return '3to5m';
  if (seconds < 600) return '5to10m';
  return 'gt10m';
}
