/**
 * Bloom Strength — professional-review gate.
 *
 * PRD §9: no public availability until all three exercises carry an approved
 * review status. The signed review version is stored with the exercise
 * definition and release record. v1 ships as 'pending-pro' — the gate blocks
 * production exposure until a qualified physiotherapist/strength professional
 * has reviewed on-device and signed off.
 */

import { EXERCISES } from './exercises.js';

/**
 * Review records. In production these ship frozen with the app and are
 * updated only through a reviewed release. Empty == pending-pro for all.
 * Each approved record: { exerciseId, exerciseVersion, reviewer, reviewedAt, status }.
 */
export const REVIEW_RECORDS = Object.freeze({
  // Example of a signed record (filled in by release process):
  // squat: { exerciseId: 'squat', exerciseVersion: 1, reviewer: '…',
  //          reviewedAt: 0, status: 'approved', onDevice: true },
});

export function getReviewStatus(exerciseId) {
  const record = REVIEW_RECORDS[exerciseId];
  if (!record) return { status: 'pending-pro', record: null };
  if (record.status !== 'approved' || record.onDevice !== true) {
    return { status: 'pending-pro', record };
  }
  const exercise = EXERCISES[exerciseId];
  if (!exercise || record.exerciseVersion !== exercise.exerciseVersion) {
    // A threshold change invalidates the sign-off (exerciseVersion bump).
    return { status: 'stale', record };
  }
  return { status: 'approved', record };
}

/**
 * Gate used by the feature layer before exposing an exercise.
 * @param {string} exerciseId
 * @param {object} [opts]
 * @param {boolean} [opts.allowPendingPro=false] - internal/dev builds only
 * @returns {{ allowed: boolean, status: string, reason: string|null }}
 */
export function assertExerciseApproved(exerciseId, opts = {}) {
  const { allowPendingPro = false } = opts;
  const { status } = getReviewStatus(exerciseId);
  if (status === 'approved') return { allowed: true, status, reason: null };
  if (allowPendingPro) {
    return { allowed: true, status, reason: `Exercise ${exerciseId} is ${status}; dev/validation use only` };
  }
  return {
    allowed: false,
    status,
    reason: `Exercise ${exerciseId} has no approved professional review (status: ${status})`,
  };
}

/** Whole-feature gate: public beta requires ALL THREE exercises approved. */
export function strengthBetaApproved(opts = {}) {
  const results = Object.keys(EXERCISES).map((id) => assertExerciseApproved(id, opts));
  const allApproved = results.every((r) => r.status === 'approved');
  return {
    approved: allApproved,
    exercises: results,
  };
}
