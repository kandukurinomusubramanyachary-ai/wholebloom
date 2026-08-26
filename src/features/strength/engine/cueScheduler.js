const { STRENGTH_DEFAULTS } = require('../constants');

function createCueScheduler(options = {}) {
  const config = { ...STRENGTH_DEFAULTS, ...options };
  const lastById = new Map();
  const countById = new Map();
  const starts = [];
  let active = null;
  let lastStart = -Infinity;
  let encouragementCount = 0;

  function prune(now) {
    while (starts.length && starts[0] <= now - config.cueWindowMs) starts.shift();
  }

  function schedule(candidates, now, context = {}) {
    prune(now);
    const eligible = (candidates || [])
      .filter(Boolean)
      .filter((cue) => !(context.trackingBlocked && cue.priority < 90))
      .filter((cue) => now - (lastById.get(cue.id) ?? -Infinity) >= (cue.cooldownMs || 0))
      .filter((cue) => (countById.get(cue.id) || 0) < (cue.maxPerSession ?? Infinity))
      .filter((cue) => cue.priority !== 30 || encouragementCount < config.encouragementPerSet)
      .sort((a, b) => b.priority - a.priority);
    const cue = eligible[0];
    if (!cue) return null;
    if (now - lastStart < config.cueMinimumGapMs && (!active || cue.priority <= active.priority)) return null;
    if (starts.length >= config.cueWindowLimit && cue.priority < 90) return null;

    const cancel = Boolean(active && cue.priority > active.priority);
    active = cue;
    lastStart = now;
    starts.push(now);
    lastById.set(cue.id, now);
    countById.set(cue.id, (countById.get(cue.id) || 0) + 1);
    if (cue.priority === 30) encouragementCount += 1;
    return { cue, cancel };
  }

  function clearActive(id) {
    if (!id || active?.id === id) active = null;
  }

  function snapshot() {
    return Object.fromEntries(countById.entries());
  }

  return { clearActive, schedule, snapshot };
}

module.exports = { createCueScheduler };
