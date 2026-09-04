/**
 * Bloom Strength — slow-inference monitoring.
 *
 * The detector loop reports every produced pose update (and the time the
 * inference took). From those samples we derive the EFFECTIVE update rate
 * (updates/sec) and mean latency. Target is 10–15 updates/sec; if the rate
 * stays below 8/sec for 5 continuous seconds the UI must surface the
 * camera-free recommendation — Bloom never keeps presenting confident
 * coaching on an unreliable signal indefinitely.
 *
 * Pure + deterministic given an injected clock (`now()`). No media is ever
 * recorded or referenced; only timing primitives leave this module.
 */

export const DEFAULT_TARGET_FPS = 12;
export const MIN_ACCEPTABLE_FPS = 8;
export const SLOW_DWELL_MS = 5000;
export const WINDOW_MS = 10000;
export const LATENCY_WARN_MS = 300;

export class InferenceMonitor {
  /**
   * @param {object} [opts]
   * @param {function} [opts.now] injected clock (ms)
   * @param {number} [opts.targetFps=12]
   * @param {number} [opts.minFps=8]
   * @param {number} [opts.slowDwellMs=5000]
   * @param {number} [opts.windowMs=10000]
   */
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.targetFps = opts.targetFps ?? DEFAULT_TARGET_FPS;
    this.minFps = opts.minFps ?? MIN_ACCEPTABLE_FPS;
    this.slowDwellMs = opts.slowDwellMs ?? SLOW_DWELL_MS;
    this.windowMs = opts.windowMs ?? WINDOW_MS;

    this._samples = []; // { at, latencyMs }
    this._slowSince = null;
    this._signaled = false;
  }

  reset() {
    this._samples = [];
    this._slowSince = null;
    this._signaled = false;
  }

  /**
   * Record one produced pose update.
   * @param {object} [s]
   * @param {number} [s.latencyMs] wall time the landmark inference took.
   */
  recordUpdate({ latencyMs = null } = {}) {
    const at = this.now();
    this._samples.push({ at, latencyMs: typeof latencyMs === 'number' ? latencyMs : null });
    // Trim to the observation window.
    const cutoff = at - this.windowMs;
    while (this._samples.length > 2 && this._samples[0].at < cutoff) {
      this._samples.shift();
    }
  }

  /** Effective updates/sec over the recent window (0 if not enough samples). */
  effectiveFps() {
    const t = this.now();
    const recent = this._samples.filter((s) => s.at >= t - this.windowMs);
    if (recent.length < 2) return 0;
    const span = recent[recent.length - 1].at - recent[0].at;
    if (span <= 0) return 0;
    return (recent.length - 1) / (span / 1000);
  }

  /** Mean inference latency (ms) over the window, or null if unreported. */
  meanLatencyMs() {
    const lat = this._samples.map((s) => s.latencyMs).filter((v) => typeof v === 'number');
    if (lat.length === 0) return null;
    return lat.reduce((a, b) => a + b, 0) / lat.length;
  }

  stats() {
    return {
      fps: Math.round(this.effectiveFps() * 100) / 100,
      meanLatencyMs: this.meanLatencyMs(),
      targetFps: this.targetFps,
      minFps: this.minFps,
      samples: this._samples.length,
    };
  }

  /**
   * Call after each update. Returns true ONCE when the effective rate has
   * been below minFps continuously for slowDwellMs, so the UI can recommend
   * camera-free mode. Latching: once signaled it stays true for the set (the
   * recommendation is not withdrawn by a brief recovery).
   */
  shouldRecommendCameraFree() {
    if (this._signaled) return true;
    const t = this.now();
    const fps = this.effectiveFps();
    // Need a few samples before judging (avoid a cold-start false positive).
    if (this._samples.length < 3) {
      this._slowSince = null;
      return false;
    }
    if (fps > 0 && fps < this.minFps) {
      if (this._slowSince === null) this._slowSince = t;
      if (t - this._slowSince >= this.slowDwellMs) {
        this._signaled = true;
        return true;
      }
    } else {
      this._slowSince = null;
    }
    return false;
  }

  /** Whether the recommendation has already been raised for this set. */
  get signaled() {
    return this._signaled;
  }
}
