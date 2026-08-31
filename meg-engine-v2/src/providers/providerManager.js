const { ProviderError, normalizeError } = require('./provider');

const CIRCUIT_STATES = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });
const DEFAULT_CONFIG = {
  retries: 1,
  retry: { baseDelayMs: 80, maxDelayMs: 800, jitterRatio: 0.25 },
  circuit: { failureThreshold: 3, cooldownMs: 60000, rollingWindowMs: 120000, rollingMinimumRequests: 5, failureRateThreshold: 0.6 },
  timeouts: { FAST: 12000, SMART: 25000, SAFETY: 25000, DOCTOR: 25000, LOCAL: 45000 },
};

function isRetryable(error) {
  if (error?.retryable !== undefined) return error.retryable;
  return !error?.status || [408, 409, 425, 429, 500, 502, 503, 504].includes(Number(error.status));
}

function wait(ms, signal) {
  if (!ms) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(new ProviderError('request cancelled', { code: 'CLIENT_ABORT', retryable: false }));
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; if (signal) signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    if (!signal) return;
    const onAbort = () => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', onAbort); reject(new ProviderError('request cancelled', { code: 'CLIENT_ABORT', retryable: false })); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function linkAbortSignals(parentSignal, childController) {
  if (!parentSignal) return () => {};
  const abort = () => childController.abort(parentSignal.reason);
  if (parentSignal.aborted) abort();
  else parentSignal.addEventListener('abort', abort, { once: true });
  return () => parentSignal.removeEventListener('abort', abort);
}

function nextWithAbort(iterator, clientSignal, providerSignal, provider) {
  const activeSignals = [clientSignal, providerSignal].filter(Boolean);
  const aborted = activeSignals.find((signal) => signal.aborted);
  if (aborted) return Promise.reject(new ProviderError('request cancelled', { provider, code: aborted === clientSignal ? 'CLIENT_ABORT' : 'TIMEOUT', retryable: aborted !== clientSignal }));
  if (!activeSignals.length) return iterator.next();
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => activeSignals.forEach((signal) => signal.removeEventListener('abort', onAbort));
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const abortedSignal = activeSignals.find((signal) => signal.aborted);
      try { iterator.return?.(); } catch {}
      reject(new ProviderError('request cancelled', { provider, code: abortedSignal === clientSignal ? 'CLIENT_ABORT' : 'TIMEOUT', retryable: abortedSignal !== clientSignal }));
    };
    activeSignals.forEach((signal) => signal.addEventListener('abort', onAbort, { once: true }));
    iterator.next().then((value) => { if (!settled) { settled = true; cleanup(); resolve(value); } }, (error) => { if (!settled) { settled = true; cleanup(); reject(error); } });
  });
}

class ProviderManager {
  constructor({ providers = {}, config = {}, now = () => Date.now(), random = Math.random } = {}) {
    this.providers = providers;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retry: { ...DEFAULT_CONFIG.retry, ...(config.retry || {}) },
      circuit: { ...DEFAULT_CONFIG.circuit, ...(config.circuit || {}) },
      timeouts: { ...DEFAULT_CONFIG.timeouts, ...(config.timeouts || {}) },
    };
    this.now = now;
    this.random = random;
    this.health = new Map();
  }

  stateFor(name) {
    if (!this.health.has(name)) this.health.set(name, {
      state: CIRCUIT_STATES.CLOSED, consecutiveFailures: 0, outcomes: [], recent429s: 0,
      lastLatencyMs: null, lastErrorCode: null, openedAt: null, probeInFlight: false,
    });
    return this.health.get(name);
  }

  pruneOutcomes(state) {
    const cutoff = this.now() - this.config.circuit.rollingWindowMs;
    state.outcomes = state.outcomes.filter((item) => item.at >= cutoff);
  }

  circuitState(name) {
    const state = this.stateFor(name);
    this.pruneOutcomes(state);
    if (state.state === CIRCUIT_STATES.OPEN && state.openedAt + this.config.circuit.cooldownMs <= this.now()) {
      state.state = CIRCUIT_STATES.HALF_OPEN;
      state.probeInFlight = false;
    }
    return state.state;
  }

  acquire(name) {
    const state = this.stateFor(name);
    const circuit = this.circuitState(name);
    if (circuit === CIRCUIT_STATES.OPEN) return false;
    if (circuit === CIRCUIT_STATES.HALF_OPEN) {
      if (state.probeInFlight) return false;
      state.probeInFlight = true;
    }
    return true;
  }

  releaseProbe(name) { this.stateFor(name).probeInFlight = false; }

  markSuccess(name, latencyMs) {
    const state = this.stateFor(name);
    state.state = CIRCUIT_STATES.CLOSED;
    state.consecutiveFailures = 0;
    state.probeInFlight = false;
    state.lastLatencyMs = latencyMs;
    state.lastErrorCode = null;
    state.outcomes.push({ at: this.now(), ok: true, latencyMs });
    this.pruneOutcomes(state);
  }

  markFailure(name, error, latencyMs) {
    const state = this.stateFor(name);
    const status = Number(error?.status);
    state.consecutiveFailures += 1;
    state.lastLatencyMs = latencyMs;
    state.lastErrorCode = error?.code || error?.name || 'PROVIDER_ERROR';
    if (status === 429) state.recent429s += 1;
    state.outcomes.push({ at: this.now(), ok: false, status, latencyMs });
    this.pruneOutcomes(state);
    const failures = state.outcomes.filter((item) => !item.ok).length;
    const total = state.outcomes.length;
    const rate = total ? failures / total : 0;
    const enoughSamples = total >= this.config.circuit.rollingMinimumRequests;
    if (state.state === CIRCUIT_STATES.HALF_OPEN || state.consecutiveFailures >= this.config.circuit.failureThreshold || (enoughSamples && rate >= this.config.circuit.failureRateThreshold)) {
      state.state = CIRCUIT_STATES.OPEN;
      state.openedAt = this.now();
      state.probeInFlight = false;
    }
  }

  configured(name) {
    const provider = this.providers[name];
    return Boolean(provider && (typeof provider.isConfigured !== 'function' || provider.isConfigured()));
  }

  status() {
    return Object.fromEntries(Object.keys(this.providers).map((name) => {
      const state = this.stateFor(name);
      return [name, {
        configured: this.configured(name), state: this.circuitState(name), circuitOpen: this.circuitState(name) === CIRCUIT_STATES.OPEN,
        consecutiveFailures: state.consecutiveFailures, recent429s: state.recent429s, lastLatencyMs: state.lastLatencyMs,
      }];
    }));
  }

  async healthCheck() {
    const results = {};
    await Promise.all(Object.entries(this.providers).map(async ([name, provider]) => {
      if (!this.configured(name)) { results[name] = { configured: false, available: false, state: this.circuitState(name) }; return; }
      const started = this.now();
      let available = false;
      try { available = typeof provider.healthCheck === 'function' ? await provider.healthCheck() : true; } catch { available = false; }
      results[name] = { configured: true, available, latencyMs: this.now() - started, state: this.circuitState(name) };
    }));
    return results;
  }

  retryDelay(attempt) {
    const { baseDelayMs, maxDelayMs, jitterRatio } = this.config.retry;
    const exponential = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt));
    const jitter = exponential * jitterRatio * ((this.random() * 2) - 1);
    return Math.max(0, Math.round(exponential + jitter));
  }

  async *stream({ providerNames = [], route = 'FAST', messages, temperature = 0.7, maxTokens = 900, signal } = {}, state = {}) {
    const candidates = [...new Set(providerNames.map((name) => String(name).toLowerCase()))];
    const errors = [];
    const maxAttempts = 1 + Math.max(0, Number(this.config.retries) || 0);
    const timeoutMs = this.config.timeouts[route] || this.config.timeouts.FAST;

    for (const name of candidates) {
      const provider = this.providers[name];
      if (!provider || !this.configured(name) || !this.acquire(name)) continue;
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const controller = new AbortController();
          const unlink = linkAbortSignals(signal, controller);
          const timeout = setTimeout(() => controller.abort(new Error('provider timeout')), timeoutMs);
          const startedAt = this.now();
          let emitted = false;
          state.attempts = (state.attempts || 0) + 1;
          state.retries = state.retries || 0;
          state.attemptLog = state.attemptLog || [];
          state.attemptLog.push({ provider: name, attempt: attempt + 1 });
          try {
            if (signal?.aborted) throw new ProviderError('request cancelled', { provider: name, code: 'CLIENT_ABORT', retryable: false });
            const stream = provider.stream({ messages, temperature, maxTokens, signal: controller.signal });
            while (true) {
              const next = await nextWithAbort(stream, signal, controller.signal, name);
              if (next.done) break;
              if (signal?.aborted) throw new ProviderError('request cancelled', { provider: name, code: 'CLIENT_ABORT', retryable: false });
              const token = next.value;
              const text = typeof token === 'string' ? token : token?.text;
              if (!text) continue;
              emitted = true;
              state.provider = name;
              state.providerConnectMs = state.providerConnectMs ?? (this.now() - startedAt);
              state.providerLatencyMs = this.now() - startedAt;
              if (!state.firstTokenAt) state.firstTokenAt = this.now();
              yield text;
            }
            if (!emitted) throw new ProviderError(`${name} returned an empty response`, { provider: name, retryable: true, code: 'EMPTY_RESPONSE' });
            this.markSuccess(name, this.now() - startedAt);
            state.totalProviderMs = this.now() - startedAt;
            return;
          } catch (error) {
            let normalized;
            try { normalized = typeof provider.normalizeError === 'function' ? provider.normalizeError(error) : normalizeError(error, name); } catch (normalizationError) { normalized = normalizeError(normalizationError, name, 'NORMALIZATION_ERROR'); }
            if (signal?.aborted) normalized.code = 'CLIENT_ABORT';
            if (emitted) normalized.partial = true;
            errors.push({ provider: name, status: normalized.status, code: normalized.code || normalized.name });
            this.markFailure(name, normalized, this.now() - startedAt);
            state.lastErrorCode = normalized.code || normalized.name;
            if (normalized.code === 'CLIENT_ABORT') throw normalized;
            if (!emitted && this.circuitState(name) === CIRCUIT_STATES.OPEN) break;
            if (!emitted && attempt + 1 < maxAttempts && isRetryable(normalized)) {
              state.retries += 1;
              await wait(this.retryDelay(attempt), signal);
              continue;
            }
            if (emitted) throw normalized;
            break;
          } finally {
            clearTimeout(timeout);
            unlink();
          }
        }
      } finally {
        this.releaseProbe(name);
      }
      state.fallbacks = (state.fallbacks || 0) + 1;
    }

    const error = new ProviderError('No usable Meg provider completed the request', { retryable: false, code: 'ALL_PROVIDERS_FAILED' });
    error.attempts = errors;
    throw error;
  }

  async generate(request, state = {}) { let text = ''; for await (const token of this.stream(request, state)) text += token; return text; }
}

module.exports = { ProviderManager, isRetryable, CIRCUIT_STATES, wait };
