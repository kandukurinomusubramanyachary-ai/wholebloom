// Curated, camera-free strength library for Bloom.
//
// Every entry is body-positive and cycle-aware in voice (see DESIGN.md): gentle,
// observational, never corrective or performance-shaming. Thresholds/tempos are
// product tuning values, not medical claims.
//
// mode:
//   'reps' — counted repetitions, paced by `tempoSec` seconds per rep.
//   'hold' — an isometric hold measured in seconds (`holdSec`).

export const FOCUS_AREAS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'lower', label: 'Lower body' },
  { id: 'upper', label: 'Upper body' },
  { id: 'core', label: 'Core' },
  { id: 'full', label: 'Full body' },
]);

export const LEVELS = Object.freeze({
  gentle: { id: 'gentle', label: 'Gentle', color: 'success' },
  steady: { id: 'steady', label: 'Steady', color: 'brand' },
  strong: { id: 'strong', label: 'Strong', color: 'warning' },
});

export const EXERCISE_LIBRARY = Object.freeze([
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight squat',
    icon: 'body-outline',
    focus: 'lower',
    level: 'steady',
    mode: 'reps',
    defaultReps: 10,
    defaultSets: 3,
    restSec: 45,
    tempoSec: 4,
    minutes: 6,
    intro: 'Sit your hips back only as far as feels comfortable, then return to standing tall.',
    steps: [
      'Stand with feet hip-width apart, support nearby if useful.',
      'Bend your knees and sit your hips back gently.',
      'Press through your feet to return to standing — that is one rep.',
    ],
    cues: ['Keep it slow and controlled', 'Let your weight settle into your heels', 'Breathe out as you rise'],
  },
  {
    id: 'glute-bridge',
    name: 'Glute bridge',
    icon: 'flower-outline',
    focus: 'lower',
    level: 'gentle',
    mode: 'reps',
    defaultReps: 12,
    defaultSets: 3,
    restSec: 40,
    tempoSec: 4,
    minutes: 6,
    intro: 'Lie down comfortably and lift your hips only as high as feels easy today.',
    steps: [
      'Lie on your back, knees bent, feet flat and hip-width apart.',
      'Press through your heels and lift your hips toward the ceiling.',
      'Lower slowly back to the floor to finish the rep.',
    ],
    cues: ['Squeeze gently at the top', 'Keep your ribs soft', 'Lower with control'],
  },
  {
    id: 'calf-raise',
    name: 'Calf raise',
    icon: 'walk-outline',
    focus: 'lower',
    level: 'gentle',
    mode: 'reps',
    defaultReps: 15,
    defaultSets: 2,
    restSec: 30,
    tempoSec: 3,
    minutes: 4,
    intro: 'Rise onto the balls of your feet, using a wall or chair for balance.',
    steps: [
      'Stand tall with support within reach.',
      'Lift both heels and rise onto the balls of your feet.',
      'Lower slowly until your heels touch down.',
    ],
    cues: ['Rise as high as feels steady', 'Pause briefly at the top', 'Stay tall through your spine'],
  },
  {
    id: 'wall-pushup',
    name: 'Wall push-up',
    icon: 'fitness-outline',
    focus: 'upper',
    level: 'gentle',
    mode: 'reps',
    defaultReps: 10,
    defaultSets: 3,
    restSec: 45,
    tempoSec: 4,
    minutes: 5,
    intro: 'Use a stable wall and move toward it as one comfortable line.',
    steps: [
      'Place both hands on a stable wall at shoulder height.',
      'Bend your elbows and bring your chest toward the wall.',
      'Press back until your arms are gently extended.',
    ],
    cues: ['Keep your body in one line', 'Elbows soften, not locked', 'Press away smoothly'],
  },
  {
    id: 'bird-dog',
    name: 'Bird-dog',
    icon: 'accessibility-outline',
    focus: 'core',
    level: 'steady',
    mode: 'reps',
    defaultReps: 8,
    defaultSets: 3,
    restSec: 40,
    tempoSec: 5,
    minutes: 6,
    intro: 'On all fours, extend opposite arm and leg with steady, quiet control.',
    steps: [
      'Start on hands and knees, spine long and neutral.',
      'Reach one arm forward and the opposite leg back.',
      'Return to centre, then switch sides — that is one rep.',
    ],
    cues: ['Move slowly and stay level', 'Keep your hips square', 'Reach long, not high'],
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    icon: 'heart-outline',
    focus: 'core',
    level: 'steady',
    mode: 'reps',
    defaultReps: 8,
    defaultSets: 3,
    restSec: 40,
    tempoSec: 5,
    minutes: 6,
    intro: 'Lie down and lower opposite arm and leg while keeping your back settled.',
    steps: [
      'Lie on your back, arms reaching up, knees stacked over hips.',
      'Lower one arm and the opposite leg toward the floor.',
      'Return to centre and switch sides to finish the rep.',
    ],
    cues: ['Keep your lower back gently grounded', 'Move only as far as feels easy', 'Exhale as you lower'],
  },
  {
    id: 'wall-sit',
    name: 'Wall sit',
    icon: 'timer-outline',
    focus: 'lower',
    level: 'strong',
    mode: 'hold',
    holdSec: 30,
    defaultSets: 3,
    restSec: 50,
    minutes: 5,
    intro: 'Slide down a wall to a comfortable seated angle and hold with steady breathing.',
    steps: [
      'Stand with your back against a wall, feet a step forward.',
      'Slide down until your knees are at a comfortable angle.',
      'Hold, breathing calmly, then rise to rest.',
    ],
    cues: ['Only go as low as feels good', 'Keep breathing steadily', 'Ease up any time you need'],
  },
  {
    id: 'standing-side-leg-raise',
    name: 'Standing side-leg raise',
    icon: 'body-outline',
    focus: 'full',
    level: 'gentle',
    mode: 'reps',
    defaultReps: 10,
    defaultSets: 2,
    restSec: 35,
    tempoSec: 4,
    minutes: 5,
    intro: 'Use support if useful and lift one leg only through a comfortable range.',
    steps: [
      'Stand tall with support nearby.',
      'Lift one leg gently out to the side.',
      'Return it to centre to count one rep, alternating sides per set.',
    ],
    cues: ['Stay tall through your torso', 'Lift with control', 'Lower slowly to centre'],
  },
]);

export function exercisesByFocus(focusId) {
  if (!focusId || focusId === 'all') return EXERCISE_LIBRARY;
  return EXERCISE_LIBRARY.filter((exercise) => exercise.focus === focusId);
}

export function exerciseById(id) {
  return EXERCISE_LIBRARY.find((exercise) => exercise.id === id) || null;
}

export function estimatedMinutes(exercise) {
  return exercise?.minutes || 5;
}
