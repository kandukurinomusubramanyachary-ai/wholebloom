const os = require('node:os');
const path = require('node:path');
const { createApp: createMegEngineApp } = require('../meg-engine-v2/src/app');
const { loadConfig } = require('../meg-engine-v2/src/config/env');
const { createBufferedChatRunner, ChatRequestError } = require('../meg-engine-v2/src/http/chatHandler');
const { cleanSupportMode } = require('../meg-engine-v2/src/prompts/support-mode');

function shortString(value, max = 120) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function numberInRange(value, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function mapBloomContext(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return {};
  const mapped = {};
  const checkin = context.todayCheckin && typeof context.todayCheckin === 'object'
    ? context.todayCheckin
    : {};

  const cycleDay = numberInRange(context.cycleDay, 1, 500);
  if (cycleDay !== null) mapped.cycleDay = cycleDay;

  const mood = shortString(checkin.mood, 60);
  if (mood) mapped.mood = mood;

  const sleepHours = numberInRange(checkin.sleep, 0, 24);
  if (sleepHours !== null) mapped.sleepHours = sleepHours;

  const stress = numberInRange(checkin.stress, 0, 10);
  if (stress !== null) mapped.stress = stress;

  const symptoms = [];
  const pain = numberInRange(checkin.pain, 0, 10);
  if (pain !== null && pain > 0) symptoms.push(`pain ${pain}/10`);
  const flow = shortString(checkin.flow, 30);
  if (flow && flow !== 'none') symptoms.push(`${flow} bleeding`);
  if (Array.isArray(checkin.symptoms)) {
    for (const item of checkin.symptoms.slice(0, 10)) {
      const cleaned = shortString(item, 60);
      if (cleaned) symptoms.push(cleaned);
    }
  }
  if (symptoms.length) mapped.symptoms = [...new Set(symptoms)].slice(0, 12);

  const recentCheckIns = [];
  const phase = shortString(context.currentPhase, 60);
  if (phase) recentCheckIns.push(`Current phase: ${phase}`);
  const averageCycleLength = numberInRange(context.averageCycleLength, 10, 120);
  if (averageCycleLength !== null) recentCheckIns.push(`Recent average cycle length: ${averageCycleLength} days`);
  const mealsLogged = numberInRange(context.mealsLogged, 0, 20);
  if (mealsLogged !== null) recentCheckIns.push(`${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} logged today`);
  if (context.movementLogged === true) recentCheckIns.push('Movement logged today');
  if (recentCheckIns.length) mapped.recentCheckIns = recentCheckIns;

  if (mealsLogged !== null && mealsLogged > 0) {
    mapped.recentFood = [`${mealsLogged} meal${mealsLogged === 1 ? '' : 's'} logged today`];
  }
  if (typeof context.movementLogged === 'boolean') {
    mapped.activity = context.movementLogged ? 'movement logged today' : 'no movement logged today';
  }

  if (Array.isArray(context.goals)) {
    const goals = context.goals.slice(0, 10).map((goal) => shortString(goal, 80)).filter(Boolean);
    if (goals.length) mapped.goals = goals;
  }

  return mapped;
}

function routeModeForSupportMode(value) {
  const supportMode = cleanSupportMode(value);
  if (supportMode === 'doctor') return 'doctor';
  if (supportMode === 'understand' || supportMode === 'plan' || supportMode === 'conversation') return 'smart';
  return 'auto';
}

function resolveMegV2DataDir(environment = process.env) {
  const configured = typeof environment.MEG_V2_DATA_DIR === 'string'
    ? environment.MEG_V2_DATA_DIR.trim()
    : '';
  const production = String(environment.NODE_ENV || '').trim().toLowerCase() === 'production';
  if (production && !configured) {
    throw new Error('MEG_V2_DATA_DIR is required in production and must point to durable storage.');
  }
  return configured || path.join(os.tmpdir(), 'bloom-meg-v2');
}

function buildMegV2Environment(environment = process.env) {
  return {
    ...environment,
    MEG_API_KEY: '',
    ENABLE_LOCAL_FALLBACK: environment.ENABLE_LOCAL_FALLBACK || 'false',
    RATE_LIMIT_PER_MINUTE: environment.RATE_LIMIT_PER_MINUTE || '60',
    DATA_DIR: resolveMegV2DataDir(environment),
    ENGINE_VERSION: environment.ENGINE_VERSION || '0.2.0-bloom-live',
  };
}

function createMegV2Bridge({ environment = process.env, engineOverrides = {} } = {}) {
  const config = engineOverrides.config || loadConfig(buildMegV2Environment(environment));
  const engineApp = createMegEngineApp({ ...engineOverrides, config });
  const runtime = engineApp.locals.meg;
  const runChat = createBufferedChatRunner({
    config: runtime.config,
    providerManager: runtime.providerManager,
    store: runtime.store,
    cache: runtime.cache,
    coordinator: runtime.coordinator,
    logger: runtime.logger,
  });

  return {
    config,
    runtime,
    async chat({ uid, body = {}, signal } = {}) {
      if (typeof uid !== 'string' || !uid.trim()) {
        throw new ChatRequestError('unauthorized', { status: 401 });
      }
      const supportMode = cleanSupportMode(body.supportMode ?? body.mode);
      const result = await runChat({
        userId: uid.trim(),
        conversationId: body.conversationId,
        messageId: body.messageId,
        message: body.message,
        mode: routeModeForSupportMode(supportMode),
        supportMode,
        language: body.language || 'en',
        context: mapBloomContext(body.context),
        history: Array.isArray(body.history) ? body.history : [],
      }, { signal });

      return {
        message: result.text,
        conversationId: result.conversationId,
        messageId: result.metadata?.messageId || result.messageId || body.messageId || null,
        source: 'meg-v2',
        safety: result.safety || null,
        urgent: Boolean(result.urgent),
        engineVersion: config.engineVersion,
        traceId: result.metadata?.traceId || null,
      };
    },
    health() {
      return {
        engineVersion: config.engineVersion,
        providers: typeof runtime.providerManager.status === 'function'
          ? runtime.providerManager.status()
          : {},
        persistence: runtime.store?.driver || 'custom',
      };
    },
  };
}

module.exports = {
  createMegV2Bridge,
  buildMegV2Environment,
  resolveMegV2DataDir,
  mapBloomContext,
  routeModeForSupportMode,
};
