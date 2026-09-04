/**
 * Bloom Strength — real-device validation harness.
 *
 * For on-device validation ONLY. It runs the three approved exercises,
 * compares ground-truth / manual rep labels against the deterministic engine
 * count, and reports privacy-safe aggregate metrics. Thresholds are never
 * auto-tuned: the harness only MEASURES. Any threshold change must increment
 * the exercise version and re-run professional review (see reviewGate); the
 * harness fingerprints the exercise configuration so a silent tuning attempt
 * is detectable and invalidates approval.
 *
 * Privacy: unless explicit DEVELOPMENT-ONLY consent is given, the harness
 * records only coarse counts/timing aggregates — never frames, images, raw
 * landmarks, coordinates or angle timelines.
 */

import { EXERCISE_IDS, getExercise } from '../engine/exercises.js';
import { allExerciseFingerprints } from '../engine/exerciseFingerprint.js';
import { assertNoForbiddenData } from '../services/strengthPrivacy.js';

export const VALIDATION_PRIVACY_VERSION = 'strength-validation-v1';

/**
 * One validated exercise run.
 * @typedef {object} ValidationRun
 * @property {string} exerciseId
 * @property {number} exerciseVersion
 * @property {number} manualReps   ground-truth / tap-labelled reps
 * @property {number} engineReps   deterministic engine accepted reps
 * @property {number} meanFps
 * @property {number|null} meanLatencyMs
 * @property {number} durationSeconds
 */

export class DeviceValidationHarness {
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.devConsent=false] - explicit development-only
   *        consent enabling richer (still privacy-scanned) diagnostics.
   */
  constructor({ devConsent = false } = {}) {
    this.devConsent = !!devConsent;
    /** @type {ValidationRun[]} */
    this.runs = [];
    this.fingerprints = allExerciseFingerprints();
  }

  /** Only the three approved exercises may be validated. */
  _assertExercise(exerciseId) {
    if (!EXERCISE_IDS.includes(exerciseId)) {
      throw new Error(`Validation harness only supports the approved exercises: ${EXERCISE_IDS.join(', ')}`);
    }
  }

  /**
   * Record one completed validation run and return the per-run disagreement.
   */
  recordRun({
    exerciseId,
    manualReps,
    engineReps,
    meanFps,
    meanLatencyMs = null,
    durationSeconds,
  }) {
    this._assertExercise(exerciseId);
    const version = getExercise(exerciseId).exerciseVersion;
    const run = {
      exerciseId,
      exerciseVersion: version,
      manualReps: Math.round(manualReps),
      engineReps: Math.round(engineReps),
      meanFps: Math.round(meanFps * 100) / 100,
      meanLatencyMs: meanLatencyMs === null ? null : Math.round(meanLatencyMs),
      durationSeconds: Math.round(durationSeconds),
      disagreement: Math.abs(Math.round(engineReps) - Math.round(manualReps)),
      fingerprint: this._fingerprintFor(exerciseId),
    };
    this.runs.push(run);
    return run;
  }

  _fingerprintFor(exerciseId) {
    return this.fingerprints.find((f) => f.exerciseId === exerciseId)?.fingerprint ?? null;
  }

  /**
   * Aggregate privacy-safe report. Never contains media/landmark data; the
   * result is additionally run through the deep privacy scan. With
   * devConsent, per-run timing detail is included; without it only coarse
   * aggregates are returned.
   */
  report() {
    const perExercise = EXERCISE_IDS.map((id) => {
      const runs = this.runs.filter((r) => r.exerciseId === id);
      const totalDisagreement = runs.reduce((a, r) => a + r.disagreement, 0);
      const fpsVals = runs.map((r) => r.meanFps);
      const meanFps = fpsVals.length
        ? Math.round((fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length) * 100) / 100
        : null;
      return {
        exerciseId: id,
        exerciseVersion: getExercise(id).exerciseVersion,
        runs: runs.length,
        totalManualReps: runs.reduce((a, r) => a + r.manualReps, 0),
        totalEngineReps: runs.reduce((a, r) => a + r.engineReps, 0),
        totalDisagreement,
        meanFps,
        fingerprint: this._fingerprintFor(id),
      };
    });

    const report = {
      privacyVersion: VALIDATION_PRIVACY_VERSION,
      devConsent: this.devConsent,
      generatedFromApprovedExercisesOnly: true,
      thresholdsTuned: false, // harness never tunes; a changed fingerprint flags review
      perExercise,
      // Coarse inference summary only.
      inference: {
        targetFps: '10-15',
        minAcceptableFps: 8,
      },
    };

    if (this.devConsent) {
      // Development-only: still privacy-safe per-run timing/count detail.
      report.devDiagnostics = this.runs.map((r) => ({
        exerciseId: r.exerciseId,
        exerciseVersion: r.exerciseVersion,
        disagreement: r.disagreement,
        meanFps: r.meanFps,
        meanLatencyMs: r.meanLatencyMs,
        durationSeconds: r.durationSeconds,
      }));
    }

    // Fail closed: the report must never carry forbidden data.
    assertNoForbiddenData(report);
    return report;
  }

  /**
   * Detect whether a recorded run was captured against a different exercise
   * configuration fingerprint than the one currently shipped (i.e. thresholds
   * changed without a version/review). Returns the list of exercise ids whose
   * fingerprints do not match the current build.
   */
  detectSilentThresholdChange(currentFingerprints = allExerciseFingerprints()) {
    const current = new Map(currentFingerprints.map((f) => [f.exerciseId, f.fingerprint]));
    const changed = [];
    for (const run of this.runs) {
      if (run.fingerprint && current.get(run.exerciseId) !== run.fingerprint) {
        if (!changed.includes(run.exerciseId)) changed.push(run.exerciseId);
      }
    }
    return changed;
  }
}
