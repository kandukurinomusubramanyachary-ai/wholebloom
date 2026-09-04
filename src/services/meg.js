import { auth } from './firebase';
import { MEG_QA_FAILURE_CATEGORY } from './megQaTiming';
const { resolveMegApiBaseUrl } = require('./megUrlPolicy');

const MODE_IDS = {
  LISTEN: 'listen',
  UNDERSTAND: 'understand',
  PLAN: 'plan',
  CONVERSATION: 'conversation',
  DOCTOR: 'doctor',
};

export const MEG_MODES = [
  {
    id: MODE_IDS.LISTEN,
    label: 'Just listen',
    description: 'A quiet place to say what is on your mind.',
    icon: 'ear-outline',
  },
  {
    id: MODE_IDS.UNDERSTAND,
    label: 'Help me understand',
    description: 'Look gently at what you have logged.',
    icon: 'sparkles-outline',
  },
  {
    id: MODE_IDS.PLAN,
    label: 'Give me a small plan',
    description: 'Choose one or two realistic next steps.',
    icon: 'list-outline',
  },
  {
    id: MODE_IDS.CONVERSATION,
    label: 'Prepare for a conversation',
    description: 'Find calm words for someone you trust.',
    icon: 'chatbubbles-outline',
  },
  {
    id: MODE_IDS.DOCTOR,
    label: 'Prepare for a doctor visit',
    description: 'Organise what you want to mention or ask.',
    icon: 'medkit-outline',
  },
];

export const MEG_SUGGESTED_PROMPTS = [
  { id: 'body-frustration', text: 'I feel frustrated with my body', mode: MODE_IDS.LISTEN },
  { id: 'period-waiting', text: 'My period has not arrived', mode: MODE_IDS.UNDERSTAND },
  { id: 'plan-missed', text: 'I could not follow my plan', mode: MODE_IDS.LISTEN },
  { id: 'need-listening', text: 'I need someone to listen', mode: MODE_IDS.LISTEN },
  { id: 'plan-today', text: 'Help me plan the rest of today', mode: MODE_IDS.PLAN },
];

const SELF_HARM_PATTERNS = [
  /\bkill myself\b/i,
  /\bhurt myself\b/i,
  /\bend my life\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bdo(?:n't| not) want to (?:be alive|live)\b/i,
  /\bbetter off dead\b/i,
];

const URGENT_MEDICAL_PATTERNS = [
  /\b(?:fainted|fainting|passed out)\b/i,
  /\bchest pain\b/i,
  /\b(?:cannot|can't|can not) breathe\b/i,
  /\btrouble breathing\b/i,
  /\bsevere (?:pelvic |abdominal |stomach )?pain\b/i,
  /\b(?:soaking|soaked) (?:through )?(?:a |one )?(?:pad|tampon).*(?:hour|60 minutes)\b/i,
  /\bbleeding (?:very |so )?heavily\b/i,
];

const MOOD_LABELS = {
  calm: 'calm',
  happy: 'happy',
  joyful: 'happy',
  low: 'low',
  anxious: 'anxious',
  irritated: 'irritated',
  irritable: 'irritated',
  overwhelmed: 'overwhelmed',
  emotionally_sensitive: 'emotionally sensitive',
  tender: 'emotionally sensitive',
};

const FLOW_LABELS = {
  none: 'no bleeding',
  spotting: 'spotting',
  light: 'light bleeding',
  medium: 'medium bleeding',
  heavy: 'heavy bleeding',
};

const MAX_CONTEXT_GOALS = 10;
const MAX_CONTEXT_STRING_LENGTH = 60;
const MAX_CONTEXT_PHASE_LENGTH = 40;
const MAX_CONTEXT_MEALS_LOGGED = 20;
const CONTEXT_FLOWS = new Set(['none', 'spotting', 'light', 'medium', 'heavy']);
const CONTEXT_TRACKING_MODES = new Set(['cycle', 'pcos']);
const MEG_REQUEST_TIMEOUT_MS = 95000;

function normalizeText(value) {
  return String(value || '').trim();
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function cleanMegContextForRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const cleaned = {};
  const numberInRange = (candidate, minimum, maximum, integer = false) => (
    typeof candidate === 'number'
    && Number.isFinite(candidate)
    && candidate >= minimum
    && candidate <= maximum
    && (!integer || Number.isInteger(candidate))
      ? candidate
      : null
  );
  const shortString = (candidate, maxLength) => {
    if (typeof candidate !== 'string') return null;
    const normalized = candidate.trim();
    return normalized && normalized.length <= maxLength ? normalized : null;
  };

  const cycleDay = numberInRange(value.cycleDay, 1, 500, true);
  const averageCycleLength = numberInRange(value.averageCycleLength, 10, 120);
  const currentPhase = shortString(value.currentPhase, MAX_CONTEXT_PHASE_LENGTH);
  if (cycleDay !== null) cleaned.cycleDay = cycleDay;
  if (averageCycleLength !== null) cleaned.averageCycleLength = averageCycleLength;
  if (currentPhase) cleaned.currentPhase = currentPhase;

  if (value.todayCheckin && typeof value.todayCheckin === 'object' && !Array.isArray(value.todayCheckin)) {
    const checkin = {};
    const mood = shortString(value.todayCheckin.mood, MAX_CONTEXT_STRING_LENGTH);
    const energy = numberInRange(value.todayCheckin.energy, 0, 10);
    const sleep = numberInRange(value.todayCheckin.sleep, 0, 24);
    const pain = numberInRange(value.todayCheckin.pain, 0, 10);
    const flow = typeof value.todayCheckin.flow === 'string'
      && CONTEXT_FLOWS.has(value.todayCheckin.flow.toLowerCase())
      ? value.todayCheckin.flow.toLowerCase()
      : null;
    if (mood) checkin.mood = mood;
    if (energy !== null) checkin.energy = energy;
    if (sleep !== null) checkin.sleep = sleep;
    if (pain !== null) checkin.pain = pain;
    if (flow) checkin.flow = flow;
    if (Object.keys(checkin).length) cleaned.todayCheckin = checkin;
  }

  const mealsLogged = numberInRange(value.mealsLogged, 0, MAX_CONTEXT_MEALS_LOGGED, true);
  if (mealsLogged !== null) cleaned.mealsLogged = mealsLogged;
  if (typeof value.movementLogged === 'boolean') cleaned.movementLogged = value.movementLogged;
  if (Array.isArray(value.goals)) {
    cleaned.goals = value.goals
      .slice(0, MAX_CONTEXT_GOALS)
      .map((goal) => shortString(goal, MAX_CONTEXT_STRING_LENGTH))
      .filter(Boolean);
  }
  if (CONTEXT_TRACKING_MODES.has(value.trackingMode)) cleaned.trackingMode = value.trackingMode;

  return Object.keys(cleaned).length ? cleaned : null;
}

export function detectUrgentSafety(message) {
  const text = normalizeText(message);
  if (!text) return null;
  if (SELF_HARM_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      kind: 'mental-health',
      text: 'I am really glad you told me. I cannot provide crisis support, and you deserve immediate human help. Please contact local emergency services or go to the nearest emergency department now, and stay with someone you trust if you can. If you are in immediate danger, do not stay alone.',
    };
  }
  if (URGENT_MEDICAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      kind: 'medical',
      text: 'What you described may need urgent medical attention. Please seek urgent care now or contact local emergency services, especially if symptoms are severe, worsening, or you feel faint. Meg cannot assess or diagnose an emergency.',
    };
  }
  return null;
}

export function buildMegContext(state = {}, now = new Date()) {
  const today = localDateKey(now);
  const checkins = Array.isArray(state.checkins) ? state.checkins : [];
  const todayCheckin =
    (state.todayCheckin?.date === today ? state.todayCheckin : null)
    || checkins.find((entry) => entry.date === today)
    || null;
  const meals = (Array.isArray(state.meals) ? state.meals : []).filter((entry) => entry.date === today);
  const movements = (Array.isArray(state.movements) ? state.movements : []).filter((entry) => entry.date === today);

  const boundedNumber = (value, minimum, maximum, integer = false) => {
    const number = safeNumber(value);
    if (number === null || number < minimum || number > maximum || (integer && !Number.isInteger(number))) return null;
    return number;
  };
  const boundedString = (value, maxLength) => {
    if (typeof value !== 'string') return null;
    const cleaned = value.trim();
    return cleaned && cleaned.length <= maxLength ? cleaned : null;
  };

  const sourceCheckin = todayCheckin && typeof todayCheckin === 'object' ? todayCheckin : {};
  const boundedCheckin = {};
  const mood = boundedString(sourceCheckin.mood, MAX_CONTEXT_STRING_LENGTH);
  const energy = boundedNumber(sourceCheckin.energy, 0, 10);
  const sleep = boundedNumber(sourceCheckin.sleep, 0, 24);
  const pain = boundedNumber(sourceCheckin.pain, 0, 10);
  const flow = typeof sourceCheckin.flow === 'string'
    && CONTEXT_FLOWS.has(sourceCheckin.flow.toLowerCase())
    ? sourceCheckin.flow.toLowerCase()
    : null;
  if (mood) boundedCheckin.mood = mood;
  if (energy !== null) boundedCheckin.energy = energy;
  if (sleep !== null) boundedCheckin.sleep = sleep;
  if (pain !== null) boundedCheckin.pain = pain;
  if (flow) boundedCheckin.flow = flow;

  const goalValues = Array.isArray(state.profile?.goals)
    ? state.profile.goals
    : Array.isArray(state.settings?.goals) ? state.settings.goals : [];
  const goals = goalValues
    .slice(0, MAX_CONTEXT_GOALS)
    .map((goal) => boundedString(goal, MAX_CONTEXT_STRING_LENGTH))
    .filter(Boolean);
  const trackingModeValue = state.profile?.trackingMode || state.settings?.trackingMode;

  return cleanMegContextForRequest({
    cycleDay: boundedNumber(state.currentCycleDay, 1, 500, true),
    currentPhase: boundedString(state.currentPhase?.label, MAX_CONTEXT_PHASE_LENGTH),
    averageCycleLength: boundedNumber(state.averageCycleLength, 10, 120),
    todayCheckin: Object.keys(boundedCheckin).length ? boundedCheckin : null,
    mealsLogged: Math.min(meals.length, MAX_CONTEXT_MEALS_LOGGED),
    movementLogged: movements.some((entry) => entry?.status !== 'not_today'),
    goals,
    trackingMode: CONTEXT_TRACKING_MODES.has(trackingModeValue) ? trackingModeValue : 'cycle',
  });
}

export function describeMegContext(context = {}) {
  const details = [];
  if (context.cycleDay) details.push(`Cycle day ${context.cycleDay}`);
  if (context.currentPhase) details.push(context.currentPhase);
  if (context.averageCycleLength) details.push(`Average cycle ${context.averageCycleLength} days`);
  if (context.todayCheckin) {
    const checkinDetails = [];
    if (context.todayCheckin.mood) checkinDetails.push(MOOD_LABELS[context.todayCheckin.mood] || context.todayCheckin.mood);
    if (safeNumber(context.todayCheckin.energy) !== null) checkinDetails.push(`energy ${context.todayCheckin.energy}/10`);
    if (safeNumber(context.todayCheckin.sleep) !== null) checkinDetails.push(`${context.todayCheckin.sleep}h sleep`);
    if (safeNumber(context.todayCheckin.pain) !== null) checkinDetails.push(`pain ${context.todayCheckin.pain}/10`);
    if (FLOW_LABELS[context.todayCheckin.flow]) checkinDetails.push(FLOW_LABELS[context.todayCheckin.flow]);
    details.push(checkinDetails.length ? `Today: ${checkinDetails.join(' · ')}` : 'Today’s check-in');
  }
  if (context.mealsLogged) details.push(`${context.mealsLogged} meal${context.mealsLogged === 1 ? '' : 's'} logged`);
  if (context.movementLogged) details.push('Movement logged');
  if (context.goals?.length) details.push(`Goals: ${context.goals.join(', ')}`);
  if (context.trackingMode === 'pcos') details.push('PCOS support mode');
  return details;
}

function megApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_MEG_API_URL;
  const isDevelopment = typeof __DEV__ === 'undefined' || __DEV__;
  return resolveMegApiBaseUrl({ configuredValue: configured, isDevelopment });
}

function apiHistory(messages = [], currentMessage = '') {
  const cleaned = messages
    .filter((entry) => entry?.role === 'user' || entry?.role === 'assistant')
    .map((entry) => ({ role: entry.role, content: normalizeText(entry.content ?? entry.text) }))
    .filter((entry) => entry.content);
  const last = cleaned[cleaned.length - 1];
  if (last?.role === 'user' && last.content === currentMessage) cleaned.pop();
  return cleaned.slice(-8);
}

function safeResponseString(value, maxLength = 256) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

export function createLocalMegApiProvider({
  baseUrl = megApiBaseUrl(),
  timeoutMs = MEG_REQUEST_TIMEOUT_MS,
} = {}) {
  return {
    id: 'meg-v2-api',
    kind: 'authenticated-api',
    async reply(request) {
      const qaTiming = request?.qaTiming;
      const message = normalizeText(request?.message);
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        qaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.AUTH);
        throw new Error('Please sign in before messaging Meg.');
      }

      const tokenStartedAt = qaTiming?.mark();
      let idToken;
      try {
        idToken = await currentUser.getIdToken();
        qaTiming?.recordDuration('client_token_acquisition_ms', tokenStartedAt);
      } catch (error) {
        qaTiming?.recordDuration('client_token_acquisition_ms', tokenStartedAt);
        qaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.AUTH);
        throw error;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const httpStartedAt = qaTiming?.mark();
        let response;
        try {
          response = await fetch(`${baseUrl}/api/meg/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
              ...(qaTiming ? { 'x-meg-trace-id': qaTiming.traceId } : {}),
            },
            body: JSON.stringify({
              message,
              conversationId: request?.conversationId,
              messageId: request?.messageId,
              mode: request?.mode || null,
              supportMode: request?.supportMode || request?.mode || null,
              language: request?.language || 'en',
              context: cleanMegContextForRequest(request?.context),
              history: apiHistory([...(request?.memory || []), ...(request?.history || [])], message),
            }),
            signal: controller.signal,
          });
        } catch (error) {
          qaTiming?.recordDuration('client_http_total_ms', httpStartedAt);
          qaTiming?.setFailure(error?.name === 'AbortError'
            ? MEG_QA_FAILURE_CATEGORY.PROVIDER_TIMEOUT
            : MEG_QA_FAILURE_CATEGORY.NETWORK);
          throw error;
        }

        qaTiming?.setStatus(response.status);
        if (response.status === 401) qaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.AUTH);
        const payload = await response.json().catch(() => {
          qaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PARSE);
          return {};
        });
        qaTiming?.recordDuration('client_http_total_ms', httpStartedAt);

        if (!response.ok) {
          qaTiming?.setFailure(response.status === 401
            ? MEG_QA_FAILURE_CATEGORY.AUTH
            : MEG_QA_FAILURE_CATEGORY.UNKNOWN);
          throw new Error(payload?.error || `Meg V2 returned ${response.status}.`);
        }
        if (typeof payload?.message !== 'string' || !payload.message.trim()) {
          qaTiming?.setFailure(MEG_QA_FAILURE_CATEGORY.PARSE);
          throw new Error('Meg V2 returned an empty response.');
        }

        return {
          text: payload.message.trim(),
          conversationId: safeResponseString(payload.conversationId) || safeResponseString(request?.conversationId),
          messageId: safeResponseString(payload.messageId),
          source: safeResponseString(payload.source, 64) || 'meg-v2',
          safety: safeResponseString(payload.safety, 64),
          urgent: Boolean(payload.urgent),
          engineVersion: safeResponseString(payload.engineVersion, 80),
          traceId: safeResponseString(payload.traceId, 160),
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function callProvider(provider, request) {
  if (typeof provider === 'function') return provider(request);
  if (provider && typeof provider.reply === 'function') return provider.reply(request);
  throw new Error('Meg provider must be a function or expose reply(request).');
}

function isOfflineError(error) {
  return error?.code === 'OFFLINE'
    || error?.name === 'NetworkError'
    || /offline|network request failed|failed to fetch/i.test(error?.message || '');
}

export class MegServiceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'MegServiceError';
    this.cause = cause;
    this.offline = isOfflineError(cause);
  }
}

export function createMegService({ provider } = {}) {
  const primaryProvider = provider || createLocalMegApiProvider();
  return {
    provider: primaryProvider,
    async send(request) {
      const message = normalizeText(request?.message);
      if (!message) throw new MegServiceError('Write a message before sending.');
      const urgent = detectUrgentSafety(message);
      try {
        const result = await callProvider(primaryProvider, { ...request, message });
        if (!result?.text) throw new Error('Meg V2 returned an empty response.');
        return urgent ? { ...result, safety: result.safety || urgent.kind, urgent: true } : result;
      } catch (error) {
        throw new MegServiceError("Meg couldn't respond right now. Please try again.", error);
      }
    },
  };
}

let defaultMegService = null;
function getDefaultMegService() {
  if (!defaultMegService) defaultMegService = createMegService();
  return defaultMegService;
}

export const megService = {
  async send(request) {
    return getDefaultMegService().send(request);
  },
};
