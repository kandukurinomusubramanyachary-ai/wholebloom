function safePhrase(value, max = 120) { return String(value || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }

function extractMemories({ message = '', context = {}, intent } = {}) {
  const text = safePhrase(message, 1000);
  const memories = [];
  const add = (layer, content, tags, importance = 0.5) => memories.push({ layer, content: safePhrase(content), tags: [...new Set([...(tags || []), intent].filter(Boolean))], importance });

  const preference = text.match(/\b(?:i|my)\s+(?:prefer|like|want|eat)\s+(vegetarian|vegan|dairy[- ]?free|gluten[- ]?free|low[- ]?carb)\b/i);
  if (preference) add('profile', `User prefers ${preference[1].toLowerCase()} options.`, ['diet', 'preference'], 0.85);
  const goal = text.match(/\b(?:my goal is|i want to)\s+([^.!?]{5,100})/i);
  if (goal) add('profile', `User's stated goal: ${goal[1].trim()}.`, ['goal'], 0.8);
  const communication = text.match(/\b(?:please|i)\s+(?:keep|make)\s+(?:your )?(?:answers|responses)\s+(short|brief|concise|detailed|simple)\b/i);
  if (communication) add('profile', `User prefers ${communication[1].toLowerCase()} responses.`, ['communication_preference'], 0.75);

  if (context.sleepHours !== undefined && Number(context.sleepHours) < 6) add('episodic', `Sleep has been limited to about ${context.sleepHours} hours recently.`, ['sleep', 'wellbeing'], 0.65);
  if (context.mood) add('episodic', `User recently described their mood as ${safePhrase(context.mood, 80)}.`, ['mood', 'wellbeing'], 0.55);
  if (context.stress) add('episodic', `User recently reported stress: ${safePhrase(context.stress, 80)}.`, ['stress', 'wellbeing'], 0.55);
  if (/\b(crav(?:ing|ings)?|sweets?|sugar)\b/i.test(text)) add('episodic', 'User mentioned increased sweet or sugar cravings.', ['cravings', 'diet'], 0.6);
  const late = text.match(/\b(?:period|cycle)\b[^.?!]{0,40}\b(\d{1,3})\s+days?\s+late\b/i);
  if (late) add('episodic', `User reported that their period or cycle was ${late[1]} days late.`, ['cycle', 'period'], 0.7);
  if (Array.isArray(context.symptoms) && context.symptoms.length) add('episodic', `Recent symptoms noted: ${context.symptoms.slice(0, 6).map((item) => safePhrase(item, 40)).join(', ')}.`, ['symptom'], 0.55);

  const pattern = context.derivedPattern || context.derivedPatterns?.[0];
  if (pattern?.label && Number.isFinite(Number(pattern.occurrences)) && Number.isFinite(Number(pattern.total))) {
    add('derived_pattern', `Bloom tracking shows ${pattern.label} in ${pattern.occurrences} of ${pattern.total} recent check-ins; this is an observation, not a diagnosis.`, ['derived_pattern', 'tracking'], 0.55);
  }
  return memories.filter((memory) => memory.content.length > 0);
}

module.exports = { extractMemories, safePhrase };
