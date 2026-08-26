const { EXERCISE_COPY, FOCUS_COPY } = require('../constants');

function mostFrequentCue(cueCounts = {}) {
  return Object.entries(cueCounts)
    .filter(([id]) => FOCUS_COPY[id])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
}

function buildStrengthObservation(summary, repDurations = []) {
  if (summary.acceptedReps === summary.targetReps && summary.pauseCount === 0) {
    return 'You completed the full set without pausing.';
  }
  if (repDurations.length >= 4) {
    const half = Math.floor(repDurations.length / 2);
    const first = repDurations.slice(0, half).reduce((sum, value) => sum + value, 0) / half;
    const lastValues = repDurations.slice(-half);
    const last = lastValues.reduce((sum, value) => sum + value, 0) / lastValues.length;
    if (last <= first * 0.9) return 'Your last few reps were steadier than the first ones.';
  }
  const name = EXERCISE_COPY[summary.exerciseId]?.name || 'this exercise';
  return `You completed ${summary.acceptedReps} reps of ${name}.`;
}

function buildStrengthFocus(cueCounts) {
  const cueId = mostFrequentCue(cueCounts);
  return cueId ? FOCUS_COPY[cueId] : null;
}

module.exports = { buildStrengthFocus, buildStrengthObservation, mostFrequentCue };
