const STATE_VERSION = 'meg-state-v3.0';

const EMOTIONAL_DISTRESS = /\b(sad|anxious|anxiety|overwhelmed|lonely|stressed|angry|upset|terrible|awful|scared|crying|hopeless|exhausted|so done|rough day|bad day)\b/i;
const LISTENING_CUE = /\b(just listen|need to vent|let me vent|don'?t give advice|no advice|can i vent)\b/i;
const CRISIS_CUE = /\b(kill myself|suicide|suicidal|end my life|don'?t want to live|hurt myself|self[- ]?harm)\b/i;
const CYCLE_CUE = /\b(period|cycle|menstruat|spotting|bleeding|late|irregular|ovulat)\w*/i;
const FOOD_CUE = /\b(crav|sweet|sugar|hungry|food|meal|eat|diet)\w*/i;
const ACTIVITY_CUE = /\b(walk|exercise|workout|movement|yoga|stretch)\w*/i;
const DOCTOR_CUE = /\b(doctor|appointment|clinic|gyn(?:ae)?cologist|report|lab result|prescription|medication)\b/i;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function numeric(value, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedMood(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().slice(0, 80);
}

function symptomSeverity(symptoms = []) {
  if (!Array.isArray(symptoms)) return { score: 0, flags: [] };
  let score = 0;
  const flags = [];
  for (const symptom of symptoms.slice(0, 12)) {
    const text = String(symptom || '').toLowerCase();
    const pain = text.match(/pain\s*(\d{1,2})(?:\s*\/\s*10)?/i);
    if (pain) {
      const value = numeric(pain[1], 0, 10);
      if (value !== null) {
        score = Math.max(score, value / 10);
        if (value >= 8) flags.push('severe_pain_reported');
        else if (value >= 6) flags.push('moderate_pain_reported');
      }
    }
    if (/heavy bleeding|very heavy bleeding|faint|fainting|chest pain|shortness of breath|severe dizziness/.test(text)) {
      score = Math.max(score, 0.95);
      flags.push('potential_red_flag_symptom');
    }
    if (/cramp|nausea|fatigue|bloat|headache|migraine|acne|hair loss/.test(text)) {
      score = Math.max(score, 0.35);
    }
  }
  if (symptoms.length >= 3) score = Math.max(score, 0.5);
  return { score: clamp(score), flags: unique(flags) };
}

function inferEmotionalState(message, context) {
  const signals = [];
  let score = 0;
  const mood = normalizedMood(context.mood);
  const stress = numeric(context.stress, 0, 10);

  if (EMOTIONAL_DISTRESS.test(message)) {
    score += 0.45;
    signals.push('distress_language');
  }
  if (LISTENING_CUE.test(message)) {
    score += 0.2;
    signals.push('explicit_listening_request');
  }
  if (/sad|low|awful|terrible|anxious|overwhelmed|angry|upset|stressed/.test(mood)) {
    score += 0.35;
    signals.push('low_mood_context');
  }
  if (stress !== null) {
    score += (stress / 10) * 0.35;
    if (stress >= 7) signals.push('high_stress_context');
  }

  return { score: clamp(score), signals: unique(signals) };
}

function inferRecoveryState(context) {
  const signals = [];
  let strain = 0;
  const sleepHours = numeric(context.sleepHours, 0, 24);

  if (sleepHours !== null) {
    if (sleepHours < 4) {
      strain = 0.95;
      signals.push('very_low_sleep');
    } else if (sleepHours < 6) {
      strain = 0.75;
      signals.push('low_sleep');
    } else if (sleepHours < 7) {
      strain = 0.4;
      signals.push('borderline_sleep');
    }
  }

  return { strain: clamp(strain), sleepHours, signals };
}

function inferCycleState(message, context) {
  const signals = [];
  let uncertainty = 0;
  const cycleDay = numeric(context.cycleDay, 1, 500);
  const variability = numeric(context.cycleVariability, 0, 200);

  if (CYCLE_CUE.test(message)) {
    uncertainty += 0.35;
    signals.push('cycle_language');
  }
  if (variability !== null) {
    if (variability >= 14) {
      uncertainty += 0.5;
      signals.push('high_cycle_variability');
    } else if (variability >= 7) {
      uncertainty += 0.25;
      signals.push('moderate_cycle_variability');
    }
  }
  if (/\b(late|irregular|missed)\b/i.test(message)) {
    uncertainty += 0.35;
    signals.push('cycle_uncertainty_language');
  }

  return { uncertainty: clamp(uncertainty), cycleDay, variability, signals: unique(signals) };
}

function inferBehaviorState(message, context) {
  const signals = [];
  const foodRelevant = FOOD_CUE.test(message);
  const activityRelevant = ACTIVITY_CUE.test(message);
  const activity = typeof context.activity === 'string' ? context.activity.toLowerCase() : '';

  if (foodRelevant) signals.push('food_relevant');
  if (activityRelevant) signals.push('activity_relevant');
  if (/no movement/.test(activity)) signals.push('no_movement_logged');
  if (/movement logged/.test(activity)) signals.push('movement_logged');

  return { foodRelevant, activityRelevant, signals: unique(signals) };
}

function deriveRisk({ message, physical }) {
  const flags = [...physical.flags];
  if (CRISIS_CUE.test(message)) flags.push('crisis_language_detected');

  let level = 'low';
  if (flags.includes('crisis_language_detected')) level = 'urgent';
  else if (flags.includes('potential_red_flag_symptom')) level = 'high';
  else if (flags.includes('severe_pain_reported')) level = 'elevated';

  return { level, flags: unique(flags) };
}

function deriveNeeds({ message, emotional, recovery, physical, cycle, behavior, risk }) {
  const needs = [];
  if (risk.level === 'urgent') return ['safety_escalation'];
  if (LISTENING_CUE.test(message)) needs.push('listen');
  if (emotional.score >= 0.5) needs.push('emotional_support');
  if (physical.score >= 0.6) needs.push('symptom_clarification');
  if (recovery.strain >= 0.65) needs.push('recovery');
  if (cycle.uncertainty >= 0.45) needs.push('cycle_understanding');
  if (behavior.foodRelevant) needs.push('nutrition_support');
  if (behavior.activityRelevant) needs.push('movement_support');
  if (DOCTOR_CUE.test(message)) needs.push('doctor_prep');
  if (!needs.length) needs.push('conversation');
  return unique(needs);
}

function estimateState({ message = '', context = {}, recentMessages = [], memories = [], now = new Date() } = {}) {
  const text = String(message || '').trim().slice(0, 4000);
  const safeContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const emotional = inferEmotionalState(text, safeContext);
  const recovery = inferRecoveryState(safeContext);
  const physical = symptomSeverity(safeContext.symptoms);
  const cycle = inferCycleState(text, safeContext);
  const behavior = inferBehaviorState(text, safeContext);
  const risk = deriveRisk({ message: text, physical });
  const needs = deriveNeeds({ message: text, emotional, recovery, physical, cycle, behavior, risk });

  const evidence = unique([
    ...emotional.signals,
    ...recovery.signals,
    ...physical.flags,
    ...cycle.signals,
    ...behavior.signals,
  ]);
  const contextSignals = Object.keys(safeContext).length;
  const historySignals = Math.min(Array.isArray(recentMessages) ? recentMessages.length : 0, 6);
  const memorySignals = Math.min(Array.isArray(memories) ? memories.length : 0, 4);
  const confidence = clamp(0.42 + Math.min(contextSignals, 5) * 0.07 + historySignals * 0.025 + memorySignals * 0.02);

  return {
    version: STATE_VERSION,
    observedAt: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
    emotional,
    recovery,
    physical,
    cycle,
    behavior,
    risk,
    needs,
    confidence,
    evidence,
  };
}

module.exports = {
  STATE_VERSION,
  estimateState,
  symptomSeverity,
  inferEmotionalState,
  inferRecoveryState,
  inferCycleState,
  inferBehaviorState,
  deriveRisk,
  deriveNeeds,
  clamp,
};
