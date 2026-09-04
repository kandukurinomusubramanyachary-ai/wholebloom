/**
 * Bloom Strength — exercise threshold fingerprint.
 *
 * A stable string over the parameters that DEFINE counting and cueing
 * behavior: version, machine gate timings, target reps, view, the numeric
 * band/threshold constants embedded in classify()/formCues() source, and the
 * required-landmark/visibility configuration. Any silent tuning of the
 * deterministic behavior changes the fingerprint; the validation harness
 * records it and the professional-review gate treats an unsigned fingerprint
 * (or an exerciseVersion bump) as invalidating approval.
 *
 * Pure + deterministic. No camera/network. The source-derived hash is a
 * safety net: the authoritative change signal remains an exerciseVersion
 * bump enforced by code review and the review gate.
 */

import { EXERCISES } from './exercises.js';

/** FNV-1a 32-bit — deterministic, dependency-free string hash. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Build the canonical descriptor for one exercise. */
export function exerciseFingerprint(exercise) {
  const machine = {
    resetState: exercise.machine.resetState,
    peakState: exercise.machine.peakState,
    angleField: exercise.machine.angleField,
    minFramesPerState: exercise.machine.minFramesPerState,
    minPeakHoldMs: exercise.machine.minPeakHoldMs,
    minCycleMs: exercise.machine.minCycleMs,
    resetThreshold: exercise.machine.resetThreshold ?? null,
    holdVelocityDegPerSec: exercise.machine.holdVelocityDegPerSec,
  };
  const requiredGroups = (exercise.requiredGroups || []).map((g) => ({
    name: g.name,
    requireBoth: !!g.requireBoth,
  }));
  // Source of the numeric band logic is the classify/formCues functions
  // themselves; include their (deterministic) source so a changed threshold
  // literal moves the fingerprint even if the author forgets to bump.
  const behaviorSource =
    exercise.classify.toString() + '|' +
    exercise.formCues.toString();

  const descriptor = {
    id: exercise.id,
    exerciseVersion: exercise.exerciseVersion,
    targetReps: exercise.targetReps,
    cameraView: exercise.cameraView,
    visibilityCueLabel: exercise.visibilityCueLabel,
    machine,
    requiredGroups,
    behaviorHash: fnv1a(behaviorSource),
  };
  return {
    ...descriptor,
    fingerprint: fnv1a(JSON.stringify(descriptor)),
  };
}

export function allExerciseFingerprints() {
  return Object.keys(EXERCISES).map((id) => {
    const fp = exerciseFingerprint(EXERCISES[id]);
    return { exerciseId: id, exerciseVersion: fp.exerciseVersion, fingerprint: fp.fingerprint };
  });
}
