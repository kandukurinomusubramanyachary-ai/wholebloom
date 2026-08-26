const { assertPrivacySafeObject } = require('../engine/strengthPrivacy');

const EVENTS = new Set([
  'strength_opened', 'strength_exercise_selected', 'strength_camera_requested',
  'strength_camera_result', 'strength_calibration_result', 'strength_session_started',
  'strength_session_paused', 'strength_session_completed', 'strength_session_stopped',
  'strength_fallback_started',
]);

const ALLOWED_PROPERTIES = new Set([
  'exerciseId', 'exerciseVersion', 'result', 'reason', 'completionState',
  'acceptedReps', 'targetReps', 'durationBucket', 'platform',
]);

export function safeStrengthEvent(name, properties = {}) {
  if (!EVENTS.has(name)) throw new Error('strength_analytics_unknown_event');
  const clean = Object.fromEntries(Object.entries(properties)
    .filter(([key, value]) => ALLOWED_PROPERTIES.has(key) && ['string', 'number', 'boolean'].includes(typeof value)));
  assertPrivacySafeObject(clean);
  return { name, properties: clean };
}

// Bloom has no analytics transport today. Keeping this as a validated no-op
// prevents Strength from quietly introducing a new data destination.
export function trackStrengthEvent(name, properties) {
  safeStrengthEvent(name, properties);
}
