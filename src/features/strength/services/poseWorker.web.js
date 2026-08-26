// Worker protocol kept isolated so camera frames can never enter persistence.
// Expo web currently uses the synchronous MediaPipe VIDEO API on the main
// thread; this module is the future off-main-thread boundary.
export const POSE_WORKER_MESSAGES = Object.freeze({ FRAME: 'frame', RESULT: 'result', CLOSE: 'close' });
