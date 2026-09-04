/**
 * Bloom Strength — user-facing copy.
 *
 * Every utterance is also visible text (PRD §10). Short, concrete verbs.
 * Banned vocabulary (perfect, bad form, burn, lazy, failed, fix your body,
 * no excuses, push through pain) never appears — enforced by a self-test in
 * the engine suite. English P0; prepare keys for Telugu/Hindi human review.
 */

export const SAFETY_COPY =
  'Bloom Strength provides limited camera-based movement guidance. ' +
  'It cannot see pain, diagnose an injury, or replace professional ' +
  'supervision. Stop if something hurts or you feel dizzy, faint, ' +
  'unusually breathless, or unwell.';

export const PRIVACY_LINE =
  'Your camera stays on this device. Bloom does not record, save or ' +
  'send video, photos or body positions. You can use camera-free guidance instead.';

export const CAMERA_FREE_NOTE =
  'No camera needed. Bloom will show you the movement and count your ' +
  'reps with a tap. Move at your own pace and stop any time.';

/** Cue id -> { say, text }. `text` mirrors speech on screen. */
export const CUE_COPY = Object.freeze({
  // Priority 1 — system
  'multiple-people': {
    say: 'I can see more than one person. I’ll pause until it’s just you in view.',
    text: 'One person in view, please. Paused.',
  },
  'system-stopped': {
    say: 'Stopped. Your set is saved on this device.',
    text: 'Stopped. Saved on this device.',
  },

  // Calibration / framing instructions (priority 2 while tracking)
  'find-person': {
    say: 'I can’t see you yet. Step into the frame.',
    text: 'Step into the frame so I can see you.',
  },
  'frame-lower': {
    say: 'Lower the phone a little so your whole body is in view.',
    text: 'Lower the phone slightly — show your whole body.',
  },
  'frame-higher': {
    say: 'Raise the phone a little so your feet are in view.',
    text: 'Raise the phone slightly — show your feet.',
  },
  'frame-farther': {
    say: 'Move the phone a little farther away.',
    text: 'Move the phone slightly farther away.',
  },
  'frame-closer': {
    say: 'Bring the phone a little closer.',
    text: 'Bring the phone slightly closer.',
  },
  'frame-step-left': {
    say: 'Step a little to your left.',
    text: 'Step a little to your left.',
  },
  'frame-step-right': {
    say: 'Step a little to your right.',
    text: 'Step a little to your right.',
  },
  'turn-side': {
    say: 'Turn sideways so I can see you from the side.',
    text: 'Position your phone to show your side.',
  },
  'turn-front': {
    say: 'Face the phone so I can see you from the front.',
    text: 'Face the phone.',
  },
  'hold-steady': {
    say: 'That’s it. Hold there for a moment.',
    text: 'Hold steady…',
  },
  'restore-ankle-knee': {
    say: 'I’ve lost sight of your knees and ankles. Adjust the phone so your legs are visible.',
    text: 'Bring your knees and ankles back into view.',
  },
  'restore-shoulder-wrist': {
    say: 'I’ve lost sight of your shoulders and hands. Bring your upper body back into view.',
    text: 'Bring your shoulders and hands back into view.',
  },
  'restore-both-feet': {
    say: 'I’ve lost sight of both feet. Step back so your feet are visible.',
    text: 'Bring both feet back into view.',
  },
  'auto-pause': {
    say: 'I’m pausing for a moment. When you’re ready, get back into position and we’ll continue.',
    text: 'Paused. Get back into position to continue.',
  },
  resume: {
    say: 'Welcome back. Let’s continue.',
    text: 'Back in position — continuing.',
  },

  // Squat form cues (priority 3)
  'form-squat-slow': {
    say: 'Slow the movement down.',
    text: 'Slow the movement down.',
  },
  'form-squat-control': {
    say: 'Move with control, at your own pace.',
    text: 'Move with control.',
  },
  'form-squat-stand-tall': {
    say: 'Stand tall to finish.',
    text: 'Stand tall to finish.',
  },

  // Wall push-up form cues
  'form-pushup-slow': {
    say: 'Slow the movement down.',
    text: 'Slow the movement down.',
  },
  'form-pushup-body-line': {
    say: 'Move your body together as one line.',
    text: 'Move your body together as one line.',
  },
  'form-pushup-extend': {
    say: 'Finish with your arms extended.',
    text: 'Finish with your arms extended.',
  },

  // Side leg raise form cues
  'form-legraise-lower-slow': {
    say: 'Lower your leg slowly.',
    text: 'Lower your leg slowly.',
  },
  'form-legraise-torso': {
    say: 'Keep your torso steady.',
    text: 'Keep your torso steady.',
  },
  'form-legraise-centre': {
    say: 'Return to centre.',
    text: 'Return to centre.',
  },

  // Priority 5 — encouragement (at most once per set)
  encouragement: {
    say: 'You’re moving well.',
    text: 'You’re moving well.',
  },

  // Speech unavailable notice (one-time)
  'speech-unavailable': {
    say: '',
    text: 'Voice is unavailable on this browser. Guidance will appear as text.',
  },
  'muted': {
    say: '',
    text: 'Muted. Guidance appears as text.',
  },
});

/** Rep counts are spoken as the number; text shows the same. */
export function repCueCopy(repNumber) {
  return { say: String(repNumber), text: String(repNumber) };
}

export const COUNT_DOWN_COPY = Object.freeze({
  3: { say: 'Three', text: '3' },
  2: { say: 'Two', text: '2' },
  1: { say: 'One', text: '1' },
  go: { say: 'Begin', text: 'Begin' },
});

/** Exercise setup content for the combined setup sheet. */
export const EXERCISE_COPY = Object.freeze({
  squat: {
    name: 'Bodyweight squat',
    steps: [
      'Stand with your feet about shoulder-width apart.',
      'Bend your knees and lower your hips as if sitting back into a chair.',
      'Push through your feet to stand back up.',
    ],
    angle: 'Side view — place the phone so your whole body is visible from the side.',
    safety: 'Keep your knees comfortable. Stop if your knees, back or balance feel unsteady.',
  },
  'wall-pushup': {
    name: 'Wall push-up',
    steps: [
      'Stand an arm’s length from a wall, palms on the wall at shoulder height.',
      'Bend your elbows and bring your chest toward the wall.',
      'Press back until your arms are extended.',
    ],
    angle: 'Side view — head, shoulders, hips and feet all visible.',
    safety: 'Stop if your wrists, shoulders or chest feel strained.',
  },
  'side-leg-raise': {
    name: 'Standing side-leg raise',
    steps: [
      'Stand tall, holding a wall or chair for balance if you like.',
      'Raise one leg slowly out to the side.',
      'Lower it slowly and return to centre.',
    ],
    angle: 'Front view — face the phone with both feet visible.',
    safety: 'Keep the movement small and comfortable. Stop if your hip or back feels strained.',
  },
});

export const CTAS = Object.freeze({
  startWithCamera: 'Start with camera',
  cameraFree: 'Use camera-free mode',
  howItWorks: 'How camera guidance works',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  mute: 'Mute',
  unmute: 'Unmute',
  done: 'Done',
  tryAgain: 'Try again',
  retry: 'Retry',
  backToStrength: 'Return to Strength',
  plusOne: '+1 rep',
});

export const SUMMARY_COPY = Object.freeze({
  completedTitle: 'Set complete',
  stoppedTitle: 'Set stopped',
  savedLocally: 'Your result is saved on this device and will sync when you’re back online.',
  neutralStop: 'You stopped when you needed to. That effort counts.',
  observationCount: (reps) => `Bloom counted ${reps} complete ${reps === 1 ? 'repetition' : 'repetitions'}.`,
  observationPauses: (pauses) =>
    pauses === 1
      ? 'The set paused once while Bloom regained a clear view.'
      : `The set paused ${pauses} times while Bloom regained a clear view.`,
  observationSteady: 'Your repetitions looked steady and controlled.',
  observationNone: 'Bloom couldn’t count repetitions reliably this time. Camera-free mode counts each tap.',
  nextFocusGeneric: 'Next time, moving a little slower is fine.',
  'next-focus-form-squat-slow': 'Next time, try a slightly slower squat.',
  'next-focus-form-squat-control': 'Next time, focus on smooth, steady movement.',
  'next-focus-form-squat-stand-tall': 'Next time, finish each squat standing tall.',
  'next-focus-form-pushup-slow': 'Next time, move toward the wall a little slower.',
  'next-focus-form-pushup-body-line': 'Next time, keep your body moving as one line.',
  'next-focus-form-pushup-extend': 'Next time, finish each rep with your arms fully extended.',
  'next-focus-form-legraise-lower-slow': 'Next time, lower your leg a little more slowly.',
  'next-focus-form-legraise-torso': 'Next time, keep your torso steady as your leg moves.',
  'next-focus-form-legraise-centre': 'Next time, return your leg to centre between reps.',
});

/** Words that must never appear in user-facing Strength copy. */
export const BANNED_WORDS = Object.freeze([
  'perfect', 'bad form', 'burn', 'lazy', 'failed', 'no excuses',
  'push through pain', 'fix your body',
  // Medical/weight overclaim vocabulary is also banned from Strength copy.
  'calorie', 'weight loss', 'lose weight', 'fertility', 'cure', 'diagnose your',
]);
