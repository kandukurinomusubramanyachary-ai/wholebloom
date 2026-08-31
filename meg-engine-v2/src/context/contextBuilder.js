const ALLOWED_KEYS = [
  'cycleDay', 'lastPeriod', 'cycleVariability', 'cycleLengths', 'symptoms', 'mood', 'sleepHours',
  'stress', 'recentFood', 'diet', 'cravingsHistory', 'activity', 'weightTrend', 'recentCheckIns',
  'goals', 'medications',
];

function cleanValue(value, depth = 0) {
  if (depth > 2) return undefined;
  if (typeof value === 'string') return value.replace(/[\u0000-\u001f]/g, '').slice(0, 500);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => cleanValue(item, depth + 1)).filter((item) => item !== undefined);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [key, cleanValue(item, depth + 1)]).filter(([, item]) => item !== undefined));
  return undefined;
}

function contextKeysForIntent(intent, message = '') {
  const text = String(message).toLowerCase();
  if (intent === 'activity_question' || /movement|exercise|workout|walk|activity|yoga|stretch/.test(text)) return ['cycleDay', 'symptoms', 'sleepHours', 'mood', 'stress', 'activity', 'recentCheckIns'];
  if (intent === 'diet_question' || /crav|sweet|sugar|eat|food|meal|hungry/.test(text)) return ['cycleDay', 'mood', 'stress', 'sleepHours', 'recentFood', 'diet', 'cravingsHistory', 'recentCheckIns'];
  if (intent === 'emotional' || /feel|sad|anxious|stress|overwhelm|mood/.test(text)) return ['cycleDay', 'mood', 'stress', 'sleepHours', 'recentCheckIns', 'symptoms'];
  if (intent === 'cycle_question') return ['cycleDay', 'lastPeriod', 'cycleVariability', 'cycleLengths', 'symptoms', 'mood', 'stress', 'sleepHours', 'recentCheckIns'];
  if (intent === 'symptom_question') return ['cycleDay', 'lastPeriod', 'symptoms', 'sleepHours', 'mood', 'stress', 'recentCheckIns'];
  if (intent === 'doctor_prep') return ['cycleDay', 'lastPeriod', 'cycleVariability', 'cycleLengths', 'symptoms', 'medications', 'recentCheckIns', 'goals'];
  if (intent === 'complex_health' || intent === 'simple_health') return ['cycleDay', 'lastPeriod', 'cycleVariability', 'cycleLengths', 'symptoms', 'sleepHours', 'mood', 'stress', 'diet', 'weightTrend', 'recentCheckIns'];
  return ['mood', 'sleepHours', 'recentCheckIns'];
}

function buildContext({ intent, message = '', context = {}, userContext = {} } = {}) {
  const merged = { ...userContext, ...context };
  const keys = contextKeysForIntent(intent, message);
  const selected = {};
  for (const key of keys) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    const value = cleanValue(merged[key]);
    if (value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) selected[key] = value;
  }
  return selected;
}

function contextToText(context = {}) {
  const entries = Object.entries(context);
  if (!entries.length) return 'No additional health context was provided for this turn.';
  return entries.map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n');
}

module.exports = { buildContext, contextToText, contextKeysForIntent, ALLOWED_KEYS, cleanValue };
