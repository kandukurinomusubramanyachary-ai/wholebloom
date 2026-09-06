const OUTCOME_REWARD = {
  helped: 1,
  partly_helped: 0.5,
  neutral: 0,
  ignored: -0.25,
  worse: -1,
};

function normalizeOutcome(value) {
  const key = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(OUTCOME_REWARD, key) ? key : null;
}

function createOutcomeEvent({ intervention, outcome, at = new Date(), note = null } = {}) {
  const normalized = normalizeOutcome(outcome);
  if (!intervention?.family || !normalized) return null;
  return {
    interventionId: intervention.id || null,
    family: intervention.family,
    outcome: normalized,
    reward: OUTCOME_REWARD[normalized],
    at: at instanceof Date ? at.toISOString() : new Date(at).toISOString(),
    note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 240) : null,
  };
}

function buildInterventionPreferenceProfile(events = []) {
  const groups = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event?.family) continue;
    const reward = Number(event.reward);
    if (!Number.isFinite(reward)) continue;
    const row = groups.get(event.family) || { family: event.family, count: 0, rewardTotal: 0, worseCount: 0, helpedCount: 0 };
    row.count += 1;
    row.rewardTotal += Math.max(-1, Math.min(1, reward));
    if (reward <= -0.75) row.worseCount += 1;
    if (reward >= 0.75) row.helpedCount += 1;
    groups.set(event.family, row);
  }

  const families = {};
  for (const row of groups.values()) {
    const meanReward = row.rewardTotal / row.count;
    const confidence = row.count / (row.count + 3);
    const worseRate = row.worseCount / row.count;
    const helpedRate = row.helpedCount / row.count;
    families[row.family] = {
      count: row.count,
      meanReward,
      confidence,
      worseRate,
      helpedRate,
      adjustment: meanReward * confidence * 0.22,
      avoid: row.count >= 2 && worseRate >= 0.5,
      preferred: row.count >= 2 && helpedRate >= 0.6 && meanReward > 0.35,
    };
  }

  return { version: 'meg-outcome-profile-v3.0', families };
}

function familyAdjustment(profile, family) {
  const value = profile?.families?.[family];
  if (!value) return 0;
  if (value.avoid) return Math.min(value.adjustment, -0.18);
  return Math.max(-0.22, Math.min(0.22, Number(value.adjustment) || 0));
}

module.exports = {
  OUTCOME_REWARD,
  normalizeOutcome,
  createOutcomeEvent,
  buildInterventionPreferenceProfile,
  familyAdjustment,
};
