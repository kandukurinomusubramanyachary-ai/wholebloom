/**
 * Bloom Strength — NATIVE (Expo / React Native) integration surface.
 *
 * Native P0 is camera-free: the deterministic engine, privacy serializer,
 * UID-scoped local-first outbox and camera-free session live here. It
 * deliberately does NOT re-export CameraStage / PoseRuntime /
 * StrengthController (web-only), so bundling for iOS/Android never pulls in
 * getUserMedia or the web MediaPipe runtime.
 *
 * A real native camera/pose boundary is a FUTURE integration and must be
 * implemented with React Native camera + on-device pose, feeding the same
 * session.feedPoses() contract — nothing in this module imports the web.
 */

export * from './index.js';

// Camera-free helper for native: build a session id factory for idempotent
// persistence (native code may also inject its own).
export { createIdFactory } from './services/sessionIds.js';
