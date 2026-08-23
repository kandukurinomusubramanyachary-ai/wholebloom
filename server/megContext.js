const MAX_CONTEXT_CYCLE_DAY = 500;
const MAX_CONTEXT_AVERAGE_CYCLE_LENGTH = 120;
const MAX_CONTEXT_PHASE_LENGTH = 40;
const MAX_CONTEXT_MOOD_LENGTH = 60;
const MAX_CONTEXT_ENERGY = 10;
const MAX_CONTEXT_SLEEP_HOURS = 24;
const MAX_CONTEXT_PAIN = 10;
const MAX_CONTEXT_MEALS_LOGGED = 20;
const MAX_CONTEXT_GOALS = 10;
const MAX_CONTEXT_GOAL_LENGTH = 60;
const MAX_CONTEXT_BLOCK_LINES = 12;
const MAX_CONTEXT_BLOCK_LENGTH = 900;

const PHASE_LABELS = new Map([
  ['period', 'menstrual'],
  ['period days', 'menstrual'],
  ['menstrual', 'menstrual'],
  ['menstruation', 'menstrual'],
  ['early cycle', 'follicular'],
  ['earlier cycle', 'follicular'],
  ['follicular', 'follicular'],
  ['mid cycle', 'ovulatory'],
  ['mid-cycle', 'ovulatory'],
  ['ovulation', 'ovulatory'],
  ['ovulatory', 'ovulatory'],
  ['late cycle', 'luteal'],
  ['later cycle', 'luteal'],
  ['luteal', 'luteal'],
]);

const FLOW_VALUES = new Set(['none', 'spotting', 'light', 'medium', 'heavy']);
const TRACKING_MODES = new Set(['cycle', 'pcos']);

class MegContextValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MegContextValidationError';
  }
}

function invalid(field, expectation) {
  throw new MegContextValidationError(`context.${field} ${expectation}`);
}

function cleanOptionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') invalid(field, 'must be a string');
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    invalid(field, `must be between 1 and ${maxLength} characters`);
  }
  return cleaned;
}

function cleanBoundedNumber(value, field, minimum, maximum, integer = false) {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
    || (integer && !Number.isInteger(value))
  ) {
    invalid(field, `must be ${integer ? 'an integer' : 'a number'} from ${minimum} to ${maximum}`);
  }
  return value;
}

function cleanTodayCheckin(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    invalid('todayCheckin', 'must be an object');
  }

  const cleaned = {};
  const mood = cleanOptionalString(value.mood, 'todayCheckin.mood', MAX_CONTEXT_MOOD_LENGTH);
  const energy = cleanBoundedNumber(value.energy, 'todayCheckin.energy', 0, MAX_CONTEXT_ENERGY);
  const sleep = cleanBoundedNumber(value.sleep, 'todayCheckin.sleep', 0, MAX_CONTEXT_SLEEP_HOURS);
  const pain = cleanBoundedNumber(value.pain, 'todayCheckin.pain', 0, MAX_CONTEXT_PAIN);
  if (mood !== undefined) cleaned.mood = mood;
  if (energy !== undefined) cleaned.energy = energy;
  if (sleep !== undefined) cleaned.sleep = sleep;
  if (pain !== undefined) cleaned.pain = pain;
  if (value.flow !== undefined && value.flow !== null && value.flow !== '') {
    if (typeof value.flow !== 'string' || !FLOW_VALUES.has(value.flow.toLowerCase())) {
      invalid('todayCheckin.flow', 'must be one of none, spotting, light, medium, or heavy');
    }
    cleaned.flow = value.flow.toLowerCase();
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

function cleanMegContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const cleaned = {};
  const cycleDay = cleanBoundedNumber(value.cycleDay, 'cycleDay', 1, MAX_CONTEXT_CYCLE_DAY, true);
  const averageCycleLength = cleanBoundedNumber(
    value.averageCycleLength,
    'averageCycleLength',
    10,
    MAX_CONTEXT_AVERAGE_CYCLE_LENGTH
  );
  if (cycleDay !== undefined) cleaned.cycleDay = cycleDay;
  if (averageCycleLength !== undefined) cleaned.averageCycleLength = averageCycleLength;

  if (value.currentPhase !== undefined && value.currentPhase !== null && value.currentPhase !== '') {
    const phase = cleanOptionalString(value.currentPhase, 'currentPhase', MAX_CONTEXT_PHASE_LENGTH);
    const mappedPhase = PHASE_LABELS.get(phase.toLowerCase());
    if (!mappedPhase) invalid('currentPhase', 'is not a recognized cycle phase');
    cleaned.currentPhase = mappedPhase;
  }

  const todayCheckin = cleanTodayCheckin(value.todayCheckin);
  if (todayCheckin) cleaned.todayCheckin = todayCheckin;
  const mealsLogged = cleanBoundedNumber(
    value.mealsLogged,
    'mealsLogged',
    0,
    MAX_CONTEXT_MEALS_LOGGED,
    true
  );
  if (mealsLogged !== undefined) cleaned.mealsLogged = mealsLogged;
  if (value.movementLogged !== undefined && value.movementLogged !== null) {
    if (typeof value.movementLogged !== 'boolean') {
      invalid('movementLogged', 'must be a boolean');
    }
    cleaned.movementLogged = value.movementLogged;
  }

  if (value.goals !== undefined && value.goals !== null) {
    if (!Array.isArray(value.goals) || value.goals.length > MAX_CONTEXT_GOALS) {
      invalid('goals', `must be an array with at most ${MAX_CONTEXT_GOALS} items`);
    }
    cleaned.goals = value.goals.map((goal, index) => {
      if (typeof goal !== 'string' || !goal.trim()) {
        invalid(`goals[${index}]`, 'must be a non-empty string');
      }
      return cleanOptionalString(goal, `goals[${index}]`, MAX_CONTEXT_GOAL_LENGTH);
    });
  }

  if (value.trackingMode !== undefined && value.trackingMode !== null && value.trackingMode !== '') {
    if (typeof value.trackingMode !== 'string' || !TRACKING_MODES.has(value.trackingMode)) {
      invalid('trackingMode', 'must be cycle or pcos');
    }
    cleaned.trackingMode = value.trackingMode;
  }

  return Object.keys(cleaned).length ? cleaned : null;
}

function joinNatural(values) {
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function buildUserContextBlock(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return '';
  const lines = [];
  if (context.cycleDay) {
    lines.push(`Current cycle day: ${context.cycleDay}${context.currentPhase ? ` (${context.currentPhase} phase)` : ''}.`);
  } else if (context.currentPhase) {
    lines.push(`Current cycle phase: ${context.currentPhase}.`);
  }
  if (context.averageCycleLength) {
    lines.push(`Average cycle length: about ${context.averageCycleLength} days.`);
  }

  const checkin = context.todayCheckin || {};
  const checkinParts = [];
  if (checkin.mood) checkinParts.push(`mood ${checkin.mood}`);
  if (checkin.energy !== undefined) checkinParts.push(`energy ${checkin.energy}/10`);
  if (checkin.sleep !== undefined) checkinParts.push(`sleep ${checkin.sleep}h`);
  if (checkin.pain !== undefined) checkinParts.push(`pain/cramps ${checkin.pain}/10`);
  if (checkin.flow && checkin.flow !== 'none') checkinParts.push(`${checkin.flow} flow`);
  if (checkinParts.length) lines.push(`Today she logged: ${joinNatural(checkinParts)}.`);

  const activityParts = [];
  if (context.mealsLogged > 0) {
    activityParts.push(`${context.mealsLogged} meal${context.mealsLogged === 1 ? '' : 's'} today`);
  }
  if (context.movementLogged) activityParts.push('movement today');
  if (activityParts.length) lines.push(`She has logged ${joinNatural(activityParts)}.`);
  if (context.goals?.length) {
    lines.push(`Her current goals: ${joinNatural(context.goals.slice(0, 3))}.`);
  }
  if (context.trackingMode === 'pcos') {
    lines.push('Her focus is understanding PCOS or irregular cycles.');
  }

  if (!lines.length) return '';
  const footer = 'Use only what is relevant. Weave it in naturally; never list fields or say you were given data. These are observations, never a diagnosis.';
  const boundedLines = lines.slice(0, MAX_CONTEXT_BLOCK_LINES - 1);
  while ([...boundedLines, footer].join('\n').length > MAX_CONTEXT_BLOCK_LENGTH) {
    boundedLines.pop();
  }
  return [...boundedLines, footer].join('\n');
}

module.exports = {
  MAX_CONTEXT_CYCLE_DAY,
  MAX_CONTEXT_AVERAGE_CYCLE_LENGTH,
  MAX_CONTEXT_PHASE_LENGTH,
  MAX_CONTEXT_MOOD_LENGTH,
  MAX_CONTEXT_ENERGY,
  MAX_CONTEXT_SLEEP_HOURS,
  MAX_CONTEXT_PAIN,
  MAX_CONTEXT_MEALS_LOGGED,
  MAX_CONTEXT_GOALS,
  MAX_CONTEXT_GOAL_LENGTH,
  MAX_CONTEXT_BLOCK_LINES,
  MAX_CONTEXT_BLOCK_LENGTH,
  MegContextValidationError,
  cleanMegContext,
  buildUserContextBlock,
};
