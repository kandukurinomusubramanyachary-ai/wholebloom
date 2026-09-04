/**
 * Bloom Strength — versioned exercise assets.
 *
 * Each exercise is ONE versioned product asset: camera setup, required
 * landmarks, measurements, state transitions, cue conditions and copy ship
 * together. A threshold change MUST increment exerciseVersion and re-run the
 * full validation + professional review gate (see reviewGate.js).
 *
 * v1 status: pending-pro. Thresholds below are engineering starting values,
 * NOT professionally signed-off values. No public availability until all
 * three carry status 'approved' (PRD §9 professional-review gate).
 */

import { LM, angleDeg, bestSide, distance, midpoint, verticalDeviationFromLine } from './geometry.js';

export const TARGET_REPS = 8;

/** Visibility threshold for a landmark to be trusted (post-smoothing). */
export const LANDMARK_CONFIDENCE = 0.5;

/**
 * Required landmark groups per exercise. A group is visible when EITHER side
 * (bestSide) is visible for side-view exercises, or BOTH sides for front-view
 * bilateral work. `missingLabel` maps to the "restore X visibility" cue.
 */
const SIDE_CHAIN = [
  { name: 'shoulder', left: LM.LEFT_SHOULDER, right: LM.RIGHT_SHOULDER, requireBoth: false },
  { name: 'hip', left: LM.LEFT_HIP, right: LM.RIGHT_HIP, requireBoth: false },
  { name: 'knee', left: LM.LEFT_KNEE, right: LM.RIGHT_KNEE, requireBoth: false },
  { name: 'ankle', left: LM.LEFT_ANKLE, right: LM.RIGHT_ANKLE, requireBoth: false, bias: 'knee' },
];

const PUSHUP_CHAIN = [
  { name: 'shoulder', left: LM.LEFT_SHOULDER, right: LM.RIGHT_SHOULDER, requireBoth: false },
  { name: 'elbow', left: LM.LEFT_ELBOW, right: LM.RIGHT_ELBOW, requireBoth: false, bias: 'shoulder' },
  { name: 'wrist', left: LM.LEFT_WRIST, right: LM.RIGHT_WRIST, requireBoth: false },
  { name: 'hip', left: LM.LEFT_HIP, right: LM.RIGHT_HIP, requireBoth: false },
  { name: 'ankle', left: LM.LEFT_ANKLE, right: LM.RIGHT_ANKLE, requireBoth: false },
];

const FRONT_BILATERAL = [
  { name: 'shoulder', left: LM.LEFT_SHOULDER, right: LM.RIGHT_SHOULDER, requireBoth: true },
  { name: 'hip', left: LM.LEFT_HIP, right: LM.RIGHT_HIP, requireBoth: true },
  { name: 'knee', left: LM.LEFT_KNEE, right: LM.RIGHT_KNEE, requireBoth: true },
  { name: 'ankle', left: LM.LEFT_ANKLE, right: LM.RIGHT_ANKLE, requireBoth: true },
  { name: 'foot', left: LM.LEFT_FOOT_INDEX, right: LM.RIGHT_FOOT_INDEX, requireBoth: true },
];

/**
 * Generic deterministic cycle state machine configuration.
 * Cycle shape: reset -> s1 -> peak -> s3 -> reset (rep completes on reset).
 */
const MACHINE_DEFAULTS = Object.freeze({
  minFramesPerState: 2,
  minPeakHoldMs: 150,
  // Minimum wall time for one full deliberate cycle. Rejects jitter/double-
  // counted micro-cycles. A slow beginner rep is ~1.5–3s; the floor sits below
  // that while still catching implausibly fast cycles.
  minCycleMs: 1100,
  /** |deg/s| below which a mid-range angle is treated as "holding", not moving. */
  holdVelocityDegPerSec: 12,
});

export const EXERCISES = Object.freeze({
  squat: {
    id: 'squat',
    exerciseVersion: 1,
    name: 'Bodyweight squat',
    cameraView: 'side',
    targetReps: TARGET_REPS,
    requiredGroups: SIDE_CHAIN,
    /** Missing-group labels that map to the restore-visibility tracking cue. */
    visibilityCueLabel: 'ankle-knee',
    machine: {
      ...MACHINE_DEFAULTS,
      resetState: 'standing',
      cycleStates: ['descending', 'bottom', 'rising'],
      peakState: 'bottom',
      angleField: 'kneeAngle',
    },

    /**
     * Pure geometry measurement. Velocities are attached by the rep machine
     * (metrics.rates.kneeAngle in deg/s).
     */
    measure(landmarks) {
      const shoulder = bestSide(landmarks, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LANDMARK_CONFIDENCE);
      const hip = bestSide(landmarks, LM.LEFT_HIP, LM.RIGHT_HIP, LANDMARK_CONFIDENCE);
      const knee = bestSide(landmarks, LM.LEFT_KNEE, LM.RIGHT_KNEE, LANDMARK_CONFIDENCE);
      const ankle = bestSide(landmarks, LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LANDMARK_CONFIDENCE);
      const midShoulder = midpoint(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
      const midHip = midpoint(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
      const torsoHeight = midShoulder && midHip ? distance(midShoulder, midHip) : null;
      const kneeAngle = angleDeg(hip.landmark, knee.landmark, ankle.landmark);
      return {
        kneeAngle,
        side: knee.side,
        torsoHeight,
        chain: {
          shoulder: shoulder.landmark,
          hip: hip.landmark,
          knee: knee.landmark,
          ankle: ankle.landmark,
        },
      };
    },

    /**
     * Classify the current machine state from metrics + angle rate.
     * standing -> descending -> bottom -> rising -> standing.
     * v1 thresholds (pending-pro): straight ~175°, bottom ~90°; hysteresis
     * band between 115° and 165° avoids edge flicker.
     */
    classify(metrics, state) {
      const a = metrics.kneeAngle;
      const v = metrics.rates?.kneeAngle ?? 0;
      if (a === null) return null;
      if (a >= 165) return 'standing';
      if (a <= 115) return 'bottom';
      // Mid-range: direction decides; near-zero velocity holds current state.
      if (Math.abs(v) < MACHINE_DEFAULTS.holdVelocityDegPerSec) {
        return state === 'standing' || state == null ? 'standing' : state;
      }
      return v < 0 ? 'descending' : 'rising';
    },

    /**
     * Form-cue conditions. Each returns true while the condition is active;
     * the cue scheduler enforces persistence + cooldowns. One persistent,
     * reviewed condition at a time is ever spoken (scheduler priority).
     */
    formCues(metrics, ctx) {
      const { state, cycleReversals } = ctx;
      const v = metrics.rates?.kneeAngle ?? 0;
      const a = metrics.kneeAngle;
      return [
        {
          id: 'form-squat-slow',
          active: state === 'descending' && v < -120,
        },
        {
          // Tremor / repeated direction flips inside one attempt.
          id: 'form-squat-control',
          active: (state === 'descending' || state === 'rising') && cycleReversals >= 3,
        },
        {
          // Rising but plateaus short of standing — finish the rep standing.
          id: 'form-squat-stand-tall',
          active: state === 'rising' && a !== null && a >= 150 && a < 165 && Math.abs(v) < 15,
        },
      ];
    },
  },

  'wall-pushup': {
    id: 'wall-pushup',
    exerciseVersion: 1,
    name: 'Wall push-up',
    cameraView: 'side',
    targetReps: TARGET_REPS,
    requiredGroups: PUSHUP_CHAIN,
    visibilityCueLabel: 'shoulder-wrist',
    machine: {
      ...MACHINE_DEFAULTS,
      resetState: 'extended',
      cycleStates: ['lowering', 'closest', 'pressing'],
      peakState: 'closest',
      angleField: 'elbowAngle',
    },

    measure(landmarks) {
      const shoulder = bestSide(landmarks, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LANDMARK_CONFIDENCE);
      const elbow = bestSide(landmarks, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LANDMARK_CONFIDENCE);
      const wrist = bestSide(landmarks, LM.LEFT_WRIST, LM.RIGHT_WRIST, LANDMARK_CONFIDENCE);
      const hip = bestSide(landmarks, LM.LEFT_HIP, LM.RIGHT_HIP, LANDMARK_CONFIDENCE);
      const ankle = bestSide(landmarks, LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LANDMARK_CONFIDENCE);
      const midShoulder = midpoint(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
      const midHip = midpoint(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
      const torsoHeight = midShoulder && midHip ? distance(midShoulder, midHip) : null;
      const elbowAngle = angleDeg(shoulder.landmark, elbow.landmark, wrist.landmark);
      // Body-as-one-line: hip sag/hike off the shoulder–ankle plank line,
      // scaled by torso height.
      const hipDeviation =
        shoulder.landmark && ankle.landmark && hip.landmark && torsoHeight
          ? verticalDeviationFromLine(hip.landmark, shoulder.landmark, ankle.landmark) / torsoHeight
          : null;
      return {
        elbowAngle,
        hipDeviation,
        torsoHeight,
        chain: {
          shoulder: shoulder.landmark,
          elbow: elbow.landmark,
          wrist: wrist.landmark,
          hip: hip.landmark,
          ankle: ankle.landmark,
        },
      };
    },

    classify(metrics, state) {
      const a = metrics.elbowAngle;
      const v = metrics.rates?.elbowAngle ?? 0;
      if (a === null) return null;
      if (a >= 160) return 'extended';
      if (a <= 110) return 'closest';
      if (Math.abs(v) < MACHINE_DEFAULTS.holdVelocityDegPerSec) {
        return state === 'extended' || state == null ? 'extended' : state;
      }
      return v < 0 ? 'lowering' : 'pressing';
    },

    formCues(metrics, ctx) {
      const { state } = ctx;
      const v = metrics.rates?.elbowAngle ?? 0;
      const a = metrics.elbowAngle;
      return [
        {
          id: 'form-pushup-slow',
          active: state === 'lowering' && v < -120,
        },
        {
          // Hips sagging or hiked: move the body as one line.
          id: 'form-pushup-body-line',
          active:
            (state === 'lowering' || state === 'closest' || state === 'pressing') &&
            metrics.hipDeviation !== null &&
            metrics.hipDeviation > 0.45,
        },
        {
          id: 'form-pushup-extend',
          active: state === 'pressing' && a !== null && a >= 150 && a < 160 && Math.abs(v) < 15,
        },
      ];
    },
  },

  'side-leg-raise': {
    id: 'side-leg-raise',
    exerciseVersion: 1,
    name: 'Standing side-leg raise',
    cameraView: 'front',
    targetReps: TARGET_REPS,
    requiredGroups: FRONT_BILATERAL,
    visibilityCueLabel: 'both-feet',
    machine: {
      ...MACHINE_DEFAULTS,
      resetState: 'neutral',
      cycleStates: ['raising', 'top', 'lowering'],
      peakState: 'top',
      angleField: 'workingHipAngle',
    },

    measure(landmarks) {
      const lShoulder = landmarks[LM.LEFT_SHOULDER];
      const rShoulder = landmarks[LM.RIGHT_SHOULDER];
      const lHip = landmarks[LM.LEFT_HIP];
      const rHip = landmarks[LM.RIGHT_HIP];
      const lAnkle = landmarks[LM.LEFT_ANKLE];
      const rAnkle = landmarks[LM.RIGHT_ANKLE];
      const midShoulder = midpoint(lShoulder, rShoulder);
      const midHip = midpoint(lHip, rHip);
      const torsoHeight = midShoulder && midHip ? distance(midShoulder, midHip) : null;

      const leftAngle = angleDeg(lShoulder, lHip, lAnkle);
      const rightAngle = angleDeg(rShoulder, rHip, rAnkle);

      // The working leg is the more abducted one (smaller shoulder-hip-ankle
      // angle). Neutral standing is ~175°; abduction shrinks the angle.
      let workingSide = 'left';
      let workingHipAngle = leftAngle;
      let workingAnkle = lAnkle;
      let standingAnkle = rAnkle;
      if (leftAngle === null || (rightAngle !== null && rightAngle < leftAngle)) {
        workingSide = 'right';
        workingHipAngle = rightAngle;
        workingAnkle = rAnkle;
        standingAnkle = lAnkle;
      }

      // Torso lean: shoulder girdle drifting laterally relative to hips,
      // measured against the neutral baseline captured at calibration.
      const shoulderHipDrift =
        midShoulder && midHip && torsoHeight
          ? Math.abs(midShoulder.x - midHip.x) / torsoHeight
          : null;

      // Swing-through: working ankle crosses the body midline (hip centre).
      let crossedCentre = false;
      if (workingAnkle && midHip) {
        const workingDir = workingSide === 'left' ? -1 : 1;
        // Abduction moves the ankle laterally (away from midline); crossing
        // past the hip centre is an adduction swing-through.
        const relative = (workingAnkle.x - midHip.x) * workingDir;
        crossedCentre = relative < -0.03;
      }

      return {
        workingHipAngle,
        workingSide,
        workingAnkle,
        standingAnkle,
        midHip,
        shoulderHipDrift,
        crossedCentre,
        torsoHeight,
      };
    },

    classify(metrics, state) {
      const a = metrics.workingHipAngle;
      const v = metrics.rates?.workingHipAngle ?? 0;
      if (a === null) return null;
      if (a >= 165) return 'neutral';
      if (a <= 150) return 'top';
      if (Math.abs(v) < MACHINE_DEFAULTS.holdVelocityDegPerSec) {
        return state === 'neutral' || state == null ? 'neutral' : state;
      }
      return v < 0 ? 'raising' : 'lowering';
    },

    formCues(metrics, ctx, baseline) {
      const { state } = ctx;
      const v = metrics.rates?.workingHipAngle ?? 0;
      const baselineDrift = baseline?.shoulderHipDrift ?? metrics.shoulderHipDrift ?? 0;
      const driftDelta =
        metrics.shoulderHipDrift !== null ? metrics.shoulderHipDrift - baselineDrift : 0;
      return [
        {
          // Lowering under control: angle increasing too fast = dropping.
          id: 'form-legraise-lower-slow',
          active: state === 'lowering' && v > 90,
        },
        {
          // Leaning the torso instead of moving the leg.
          id: 'form-legraise-torso',
          active:
            (state === 'raising' || state === 'top') &&
            metrics.shoulderHipDrift !== null &&
            driftDelta > 0.12,
        },
        {
          // Leg swings across the centre line instead of returning straight.
          id: 'form-legraise-centre',
          active: (state === 'top' || state === 'lowering') && metrics.crossedCentre === true,
        },
      ];
    },
  },
});

export function getExercise(exerciseId) {
  const exercise = EXERCISES[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise: ${exerciseId}`);
  }
  return exercise;
}

export const EXERCISE_IDS = Object.freeze(Object.keys(EXERCISES));
