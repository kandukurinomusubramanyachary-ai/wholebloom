/**
 * Bloom Strength — WEB integration surface.
 *
 * Re-exports the cross-platform core plus the browser-only boundaries. The
 * web screen imports camera/pose orchestration from here; the Expo/native
 * bundle must NEVER import this module (it statically references getUserMedia
 * and the MediaPipe web runtime).
 */

export * from './index.js';

export { CameraStage, CAMERA_ERRORS } from './web/cameraStage.web.js';
export {
  PoseRuntime,
  RUNTIME_STATUS,
  assertLocalAsset,
  isGpuUnsupportedError,
  POSE_RUNTIME_VERSION,
  POSE_ASSET_MANIFEST,
} from './web/poseRuntime.web.js';
export { createWebPoseRuntime } from './web/poseRuntimeFactory.web.js';
export {
  StrengthController,
  CONTROLLER_STATUS,
  stopEnabled,
  DEFAULT_FRAME_INTERVAL_MS,
} from './web/strengthController.web.js';
