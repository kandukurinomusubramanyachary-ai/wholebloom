/**
 * Strength's runtime contracts are documented here rather than persisted as
 * camera data. Landmark arrays live only for the current inference frame.
 *
 * @typedef {'bodyweight-squat-v1'|'wall-pushup-v1'|'side-leg-raise-v1'} ExerciseId
 * @typedef {'learn'|'select'|'safety'|'permission'|'loading'|'calibrating'|'ready'|'countdown'|'active'|'paused'|'saving'|'save_error'|'summary'|'fallback'} StrengthPhase
 * @typedef {{id:string, exerciseId:ExerciseId, exerciseVersion:number, startedAt:string, completedAt?:string, durationSeconds:number, targetReps:number, acceptedReps:number, pauseCount:number, cueCounts?:Record<string,number>, completionState:'completed'|'stopped'|'abandoned', platform:'web'|'native', privacyVersion:1}} StrengthSummary
 */

export const STRENGTH_TYPES_VERSION = 1;
