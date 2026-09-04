/**
 * Bloom Strength — CORE cross-platform integration surface.
 *
 * Everything exported here is platform-agnostic (pure engine + local-first
 * services). It MUST NOT statically import browser-only boundaries
 * (CameraStage / MediaPipe web runtime) so an Expo/native bundle never pulls
 * in getUserMedia or web MediaPipe.
 *
 *  - Web screens import browser orchestration from './index.web.js'.
 *  - Native (Expo) P0 uses camera-free mode, importable from './index.native.js'
 *    (which re-exports this core surface).
 */

// Engine
export { StrengthSession, PHASES, PLATFORMS, SLOW_INFERENCE_FPS, SLOW_INFERENCE_DWELL_MS } from './engine/session.js';
export { RepStateMachine } from './engine/repMachine.js';
export { CueScheduler, CUE_PRIORITY } from './engine/cueScheduler.js';
export { PositioningCoach } from './engine/positioningCoach.js';
export { LandmarkSmoother } from './engine/smoothing.js';
export { InferenceMonitor } from './engine/inferenceMonitor.js';
export { countPeople, evaluateVisibility, evaluateFraming, inferView } from './engine/confidence.js';
export { EXERCISES, EXERCISE_IDS, getExercise, TARGET_REPS } from './engine/exercises.js';
export { assertExerciseApproved, getReviewStatus, strengthBetaApproved } from './engine/reviewGate.js';
export { allExerciseFingerprints, exerciseFingerprint } from './engine/exerciseFingerprint.js';

// Services (persistence + privacy)
export { StrengthOutbox, SAVE_STATUS } from './services/strengthStorage.js';
export {
  serializeSessionSummary,
  validateAnalyticsEvent,
  assertNoForbiddenData,
  PRIVACY_VERSION,
  PLATFORMS as PRIVACY_PLATFORMS,
} from './services/strengthPrivacy.js';
export { createSessionId, createIdFactory } from './services/sessionIds.js';
export { VoiceCoach } from './services/voiceCoach.js';

// Validation (runs against the engine; no browser APIs)
export { DeviceValidationHarness, VALIDATION_PRIVACY_VERSION } from './validation/deviceValidation.js';
