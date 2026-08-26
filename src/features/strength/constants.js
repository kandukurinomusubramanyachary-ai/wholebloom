const STRENGTH_FLAG = 'bloom_strength';

const STRENGTH_DEFAULTS = Object.freeze({
  targetReps: 8,
  sampleRate: 12,
  minimumSampleRate: 8,
  lowFpsDurationMs: 5000,
  maxInferenceLatencyMs: 150,
  downsampleLongSide: 512,
  visibilityThreshold: 0.5,
  transitionFrames: 5,
  transitionHoldMs: 250,
  lowConfidenceMs: 1500,
  reentryFrames: 5,
  minimumCycleMs: 1000,
  baselineHoldMs: 2000,
  baselineCaptureMs: 1000,
  cueVisibleMs: 6000,
  cueMinimumGapMs: 3000,
  cueWindowMs: 60000,
  cueWindowLimit: 4,
  encouragementPerSet: 1,
  outboxRetryMs: [30000, 120000, 600000, 1800000],
  outboxMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  modelRetries: 2,
  poseCount: 2,
  modelAssetPath: '/strength/pose_landmarker_lite.task',
  wasmAssetPath: '/strength/wasm',
  speechRate: 0.95,
  speechPitch: 1,
});

const STRENGTH_COPY = Object.freeze({
  explanation: 'Bloom Strength uses your camera to understand visible movement and give basic form guidance. Your video stays on this device and is never recorded or uploaded.',
  safety: 'Bloom Strength provides limited camera-based movement guidance. It cannot see pain, diagnose an injury, or replace professional supervision. Stop if something hurts or you feel dizzy, faint, unusually breathless, or unwell.',
  cameraPrivacyTitle: 'Your camera stays private',
  cameraPrivacyBody: 'Frames are checked in memory and discarded immediately. Bloom saves only your exercise, rep count, duration, pauses and cue totals.',
  voiceUnavailable: 'Voice unavailable — cues will appear as text.',
  unsupportedTitle: 'Camera guidance is unavailable here',
  unsupportedBody: 'You can still follow a calm, camera-free version and count each repetition yourself.',
  permissionDenied: 'Camera access is off. You can enable it in your browser settings, retry, or continue without the camera.',
  cameraBusy: 'Bloom could not open the camera. It may be in use by another application.',
  modelFailed: 'Camera guidance could not start on this device. The guided version is ready instead.',
  activeCamera: 'Camera active — processing stays on this device',
  onePerson: 'One person at a time, please.',
  stepBack: 'Step back a little.',
  comeCloser: 'Come a little closer.',
  moveLeft: 'Move slightly to your left.',
  moveRight: 'Move slightly to your right.',
  sideView: 'Turn slightly to your side.',
  frontView: 'Face the camera more directly.',
  holdStill: 'Hold still for two seconds.',
  fullBody: 'Good — I can see your full body.',
  readyThree: 'Good. We’ll start in three.',
  manualPause: 'Paused. Take the time you need.',
  pageHidden: 'The session paused while this page was hidden.',
  lowFps: 'Camera guidance is running slowly. The guided version may work better on this device.',
  unknownError: 'Strength guidance stopped safely. No camera information was saved.',
});

const EXERCISE_COPY = Object.freeze({
  'bodyweight-squat-v1': {
    name: 'Bodyweight squat',
    view: 'Side view',
    intro: 'Sit your hips back only as far as feels comfortable, then return to standing.',
    steps: ['Stand with support nearby if useful.', 'Bend your knees and sit back gently.', 'Return to standing to count one repetition.'],
    icon: 'body-outline',
  },
  'wall-pushup-v1': {
    name: 'Wall push-up',
    view: 'Side view',
    intro: 'Use a stable wall and move toward it as one comfortable line.',
    steps: ['Place both hands on a stable wall.', 'Bend your elbows and move closer.', 'Press back until your arms are extended.'],
    icon: 'fitness-outline',
  },
  'side-leg-raise-v1': {
    name: 'Standing side-leg raise',
    view: 'Front view',
    intro: 'Use support if useful and lift one leg only through a comfortable range.',
    steps: ['Stand facing the camera with support nearby.', 'Lift one leg gently to the side.', 'Return it to the centre to count one repetition.'],
    icon: 'accessibility-outline',
  },
});

const FOCUS_COPY = Object.freeze({
  finishStanding: 'Next time, we can keep working on finishing each rep standing tall.',
  slowDown: 'Next time, we can keep the movement a little slower and more controlled.',
  keepControlled: 'Next time, we can keep each part of the movement controlled.',
  wholeBody: 'Next time, we can keep your body moving toward the wall together.',
  finishArms: 'Next time, we can keep working on extending your arms to finish.',
  torsoSteady: 'Next time, we can keep your torso a little steadier.',
  lowerSlowly: 'Next time, we can lower the leg a little more slowly.',
  returnCentre: 'Next time, we can return to the centre before beginning another rep.',
});

const CALIBRATION_STEPS = Object.freeze([
  'Loading pose model',
  'Looking for one person',
  'Checking visible joints',
  'Checking full-body framing',
  'Checking camera angle',
  'Holding still',
  'Starting',
]);

module.exports = {
  CALIBRATION_STEPS,
  EXERCISE_COPY,
  FOCUS_COPY,
  STRENGTH_COPY,
  STRENGTH_DEFAULTS,
  STRENGTH_FLAG,
};
