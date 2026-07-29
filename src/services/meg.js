import { auth } from './firebase';
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
  {
    id: 'body-frustration',
    text: 'I feel frustrated with my body',
    mode: MODE_IDS.LISTEN,
  },
  {
    id: 'period-waiting',
    text: 'My period has not arrived',
    mode: MODE_IDS.UNDERSTAND,
  },
  {
    id: 'plan-missed',
    text: 'I could not follow my plan',
    mode: MODE_IDS.LISTEN,
  },
  {
    id: 'need-listening',
    text: 'I need someone to listen',
    mode: MODE_IDS.LISTEN,
  },
  {
    id: 'plan-today',
    text: 'Help me plan the rest of today',
    mode: MODE_IDS.PLAN,
  },
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

const EMOTIONS = [
  {
    id: 'overwhelmed',
    pattern: /\b(overwhelmed|too much|cannot cope|can't cope)\b/i,
    recognition: 'That sounds like a lot to carry at once.',
  },
  {
    id: 'frustrated',
    pattern: /\b(frustrated|angry|fed up|hate my body)\b/i,
    recognition: 'That frustration makes sense, especially when your body feels hard to read.',
  },
  {
    id: 'anxious',
    pattern: /\b(anxious|worried|scared|nervous|panic)\b/i,
    recognition: 'It sounds unsettling to sit with that uncertainty.',
  },
  {
    id: 'low',
    pattern: /\b(sad|low|down|hopeless|lonely|crying)\b/i,
    recognition: 'That sounds tender and difficult.',
  },
  {
    id: 'exhausted',
    pattern: /\b(tired|exhausted|drained|fatigue|no energy)\b/i,
    recognition: 'You sound worn out, and it is understandable that everything feels harder from there.',
  },
  {
    id: 'guilty',
    pattern: /\b(failed|failure|guilty|could not|couldn\'t|did not manage)\b/i,
    recognition: 'Missing a plan can feel discouraging, but it does not erase the care you have already shown yourself.',
  },
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
  spotting: 'spotting',
  light: 'light bleeding',
  medium: 'medium bleeding',
  heavy: 'heavy bleeding',
};

function wait(milliseconds) {
  if (!milliseconds) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readableList(values) {
  const items = values.filter(Boolean);
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isPeriodConcern(text) {
  return /\b(period|cycle|bleeding|late|arriv|missed)\b/i.test(text);
}

function contextObservation(context = {}) {
  const checkin = context.todayCheckin || {};
  const observations = [];

  if (MOOD_LABELS[checkin.mood]) observations.push(`feeling ${MOOD_LABELS[checkin.mood]}`);
  if (safeNumber(checkin.energy) !== null && Number(checkin.energy) <= 3) {
    observations.push('lower energy');
  }
  if (safeNumber(checkin.sleep) !== null && Number(checkin.sleep) < 6) {
    observations.push('shorter sleep');
  }
  if (safeNumber(checkin.pain) !== null && Number(checkin.pain) >= 5) {
    observations.push('more discomfort');
  }
  if (FLOW_LABELS[checkin.flow]) observations.push(FLOW_LABELS[checkin.flow]);

  if (!observations.length) return '';
  return `Today you logged ${readableList(observations.slice(0, 3))}.`;
}

function recognizeEmotion(message, context = {}) {
  const match = EMOTIONS.find((emotion) => emotion.pattern.test(message));
  if (match) return match.recognition;

  const mood = context.todayCheckin?.mood;
  if (mood === 'low') return 'It sounds like today may already feel a little heavy.';
  if (mood === 'anxious') return 'It sounds like there may already be some uncertainty in today.';
  if (mood === 'overwhelmed') return 'It sounds like today may already feel full.';
  return 'I am here with you.';
}

function choosePlanActions(context = {}) {
  const checkin = context.todayCheckin || {};
  const energy = safeNumber(checkin.energy);
  const sleep = safeNumber(checkin.sleep);
  const pain = safeNumber(checkin.pain);
  const flow = checkin.flow;
  const symptoms = Array.isArray(checkin.symptoms) ? checkin.symptoms : [];

  if (flow === 'heavy' || (pain !== null && pain >= 7)) {
    return [
      'Make the next hour lighter: rest, sip water, and use your usual gentle comfort measure if it is safe for you.',
      'If the bleeding feels unusually heavy, the pain becomes severe, or you feel faint, seek urgent medical care.',
    ];
  }
  if ((energy !== null && energy <= 3) || (sleep !== null && sleep < 5)) {
    return [
      'Choose the easiest nourishing food or drink available to you.',
      'Let movement be optional; five quiet minutes or gentle stretching is enough.',
    ];
  }
  if (symptoms.includes('cravings') || checkin.cravings) {
    return [
      'Have the food you want, and add a protein or fibre source if one is easy to reach.',
      'Take five unhurried minutes before your next task.',
    ];
  }
  if (checkin.mood === 'anxious' || safeNumber(checkin.stress) >= 7) {
    return [
      'Put both feet on the floor and take five slow breaths.',
      'Choose just one task that would make the rest of today feel easier.',
    ];
  }
  return [
    'Add one protein or fibre source to your next meal.',
    'Take a short walk or five quiet minutes, whichever your body prefers.',
  ];
}

function periodExplanation(context = {}) {
  const cycleDay = safeNumber(context.currentCycleDay);
  const averageCycleLength = safeNumber(context.averageCycleLength);
  const parts = [];

  if (cycleDay) {
    parts.push(`Your logs place you around cycle day ${cycleDay}.`);
  }
  if (averageCycleLength && context.periodCount >= 2) {
    parts.push(`Your recent logged cycles average about ${averageCycleLength} days, but an average cannot say exactly when this period will begin.`);
  } else {
    parts.push('There is not enough cycle history to make a dependable estimate yet.');
  }
  parts.push('PCOS and many everyday factors can make timing vary; this is an observation, not a diagnosis.');
  return parts.join(' ');
}

function conversationResponse(context = {}) {
  const observation = contextObservation(context);
  const opening = observation
    ? `You could begin with: “I want to explain what today has felt like before we look for solutions. ${observation}”`
    : 'You could begin with: “I want to explain what this has felt like before we look for solutions.”';
  return `${opening} Then ask: “Could you listen first, and help me think about next steps after?”`;
}

function doctorResponse(context = {}) {
  const cycleDetail = context.currentCycleDay
    ? `You can mention that your current log is around cycle day ${context.currentCycleDay}, while making clear that cycle dates are estimates.`
    : 'Start with when the change began and how it affects daily life.';
  return `${cycleDetail} Write down two things: the symptoms or cycle changes you have noticed, and the questions you want answered. Bloom can organise your logs, but it cannot diagnose their cause.`;
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
    (state.todayCheckin?.date === today ? state.todayCheckin : null) ||
    checkins.find((entry) => entry.date === today) ||
    null;
  const meals = (Array.isArray(state.meals) ? state.meals : []).filter((entry) => entry.date === today);
  const movements = (Array.isArray(state.movements) ? state.movements : []).filter((entry) => entry.date === today);
  const periods = Array.isArray(state.periods) ? state.periods : [];

  return {
    date: today,
    currentCycleDay: safeNumber(state.currentCycleDay),
    currentPhase: state.currentPhase?.label || null,
    averageCycleLength: safeNumber(state.averageCycleLength),
    periodCount: periods.length,
    todayCheckin,
    meals,
    movements,
    goals: state.profile?.goals || state.settings?.goals || [],
    trackingMode: state.profile?.trackingMode || state.settings?.trackingMode || 'cycle',
  };
}

export function describeMegContext(context = {}) {
  const details = [];
  if (context.currentCycleDay) details.push(`Cycle day ${context.currentCycleDay}`);
  if (context.todayCheckin) {
    const checkinDetails = [];
    if (MOOD_LABELS[context.todayCheckin.mood]) {
      checkinDetails.push(MOOD_LABELS[context.todayCheckin.mood]);
    }
    if (safeNumber(context.todayCheckin.energy) !== null) {
      checkinDetails.push(`energy ${context.todayCheckin.energy}/10`);
    }
    if (safeNumber(context.todayCheckin.sleep) !== null) {
      checkinDetails.push(`${context.todayCheckin.sleep}h sleep`);
    }
    details.push(checkinDetails.length ? `Today: ${checkinDetails.join(' · ')}` : 'Today’s check-in');
  }
  if (context.meals?.length) details.push(`${context.meals.length} meal${context.meals.length === 1 ? '' : 's'} logged`);
  if (context.movements?.length) details.push('Movement logged');
  return details;
}

export function buildLocalMegResponse({ message, mode, context = {}, memory = [] }) {
  const text = normalizeText(message);
  const recognition = recognizeEmotion(text, context);
  const observation = contextObservation(context);
  const previousUserText = memory
    .filter((entry) => entry?.role === 'user')
    .map((entry) => entry.text)
    .join(' ');
  const repeatedConcern =
    previousUserText &&
    ((isPeriodConcern(text) && isPeriodConcern(previousUserText)) ||
      (/\b(plan|failed|could not|couldn\'t)\b/i.test(text) &&
        /\b(plan|failed|could not|couldn\'t)\b/i.test(previousUserText)));
  const continuity = repeatedConcern
    ? ' It sounds like this has been coming up more than once.'
    : '';

  if (isPeriodConcern(text)) {
    return `${recognition}${continuity} ${periodExplanation(context)} Would it help more to talk about how the waiting feels, or make one small plan for today?`;
  }

  if (/\b(plan|failed|failure|could not|couldn\'t|did not manage)\b/i.test(text)) {
    if (mode !== MODE_IDS.PLAN) {
      return `${recognition}${continuity} A plan is a support, not a test. Would you like me to listen for a moment, or help make the next step smaller?`;
    }
  }

  if (mode === MODE_IDS.LISTEN) {
    return `${recognition}${continuity} You do not need to make this sound useful or positive here. What part feels hardest right now?`;
  }

  if (mode === MODE_IDS.UNDERSTAND) {
    const contextSentence = observation || 'There is not a complete check-in for today, so I will not guess at a pattern.';
    return `${recognition}${continuity} ${contextSentence} That is an observation from what you logged, not a diagnosis. Would you like to look at one detail, or stay with how it feels?`;
  }

  if (mode === MODE_IDS.PLAN) {
    const actions = choosePlanActions(context);
    return `${recognition} Let’s keep it small. 1. ${actions[0]} 2. ${actions[1]} You can choose just one.`;
  }

  if (mode === MODE_IDS.CONVERSATION) {
    return `${recognition} ${conversationResponse(context)}`;
  }

  if (mode === MODE_IDS.DOCTOR) {
    return `${recognition} ${doctorResponse(context)}`;
  }

  return `${recognition}${continuity} Would it help more if I listened, helped you understand, or made one small plan?`;
}

export function createLocalMegProvider({ latencyMs = 260 } = {}) {
  return {
    id: 'bloom-local',
    kind: 'local',
    async reply(request) {
      await wait(latencyMs);
      return {
        text: buildLocalMegResponse(request),
        source: 'local',
      };
    },
  };
}

const DEFAULT_MEG_API_BASE_URL = 'http://127.0.0.1:3001';
const MEG_REQUEST_TIMEOUT_MS = 95000;

function megApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_MEG_API_URL;
  const isDevelopment = typeof __DEV__ === 'undefined' || __DEV__;
  return resolveMegApiBaseUrl({
    configuredValue: configured,
    isDevelopment,
    developmentFallback: DEFAULT_MEG_API_BASE_URL,
  });
}

function apiHistory(messages = [], currentMessage = '') {
  const cleaned = messages
    .filter((entry) => entry?.role === 'user' || entry?.role === 'assistant')
    .map((entry) => ({
      role: entry.role,
      content: normalizeText(entry.content ?? entry.text),
    }))
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
    id: 'ollama-local',
    kind: 'local-api',
    async reply(request) {
      const message = normalizeText(request?.message);
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in before messaging Meg.');
      }
      const idToken = await currentUser.getIdToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${baseUrl}/api/meg/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            message,
            conversationId: request?.conversationId,
            messageId: request?.messageId,
            mode: request?.mode || null,
            supportMode: request?.supportMode || request?.mode || null,
            language: request?.language || 'en',
            history: apiHistory(
              [...(request?.memory || []), ...(request?.history || [])],
              message
            ),
          }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || `Local Meg service returned ${response.status}.`);
        }
        if (typeof payload?.message !== 'string' || !payload.message.trim()) {
          throw new Error('Local Meg service returned an empty response.');
        }
        return {
          text: payload.message.trim(),
          conversationId: safeResponseString(payload.conversationId)
            || safeResponseString(request?.conversationId),
          messageId: safeResponseString(payload.messageId),
          source: safeResponseString(payload.source, 64) || 'meg-api',
          safety: safeResponseString(payload.safety, 64),
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
  return (
    error?.code === 'OFFLINE' ||
    error?.name === 'NetworkError' ||
    /offline|network request failed|failed to fetch/i.test(error?.message || '')
  );
}

export class MegServiceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'MegServiceError';
    this.cause = cause;
    this.offline = isOfflineError(cause);
  }
}

export function createMegService({ provider, fallbackProvider } = {}) {
  const primaryProvider = provider || createLocalMegApiProvider();
  const fallback = fallbackProvider || null;

  return {
    provider: primaryProvider,
    async send(request) {
      const message = normalizeText(request?.message);
      if (!message) throw new MegServiceError('Write a message before sending.');

      const urgent = detectUrgentSafety(message);


      try {
        const result = await callProvider(primaryProvider, { ...request, message });
        if (!result?.text) throw new Error('Meg provider returned an empty response.');
        return urgent
          ? { ...result, safety: urgent.kind, urgent: true }
          : result;
      } catch (error) {
        if (fallback && fallback !== primaryProvider) {
          try {
            const result = await callProvider(fallback, { ...request, message });
            if (!result?.text) throw new Error('Meg fallback returned an empty response.');
            return {
              ...result,
              usedFallback: true,
              offline: isOfflineError(error),
            };
          } catch (fallbackError) {
            throw new MegServiceError(
              'Meg couldn\'t respond right now. Please try again.',
              fallbackError
            );
          }
        }
        throw new MegServiceError(
          'Meg couldn\'t respond right now. Please try again.',
          error
        );
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
