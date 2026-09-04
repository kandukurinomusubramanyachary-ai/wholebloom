/**
 * Bloom Strength — REAL local pose-runtime boundary (web).
 *
 * Wraps the MediaPipe Tasks Vision PoseLandmarker. All runtime + WASM + model
 * assets are LOCAL, version-pinned files vendored under
 * assets/mediapipe/<version>/. There is deliberately NO third-party CDN in any
 * code path (assertLocalAsset + the release check enforce this).
 *
 * Rules enforced here:
 *   - Up to TWO poses (numPoses: 2). Only person-0 is evaluated by Strength.
 *   - detect() returns ONLY transient, in-memory landmarks. It never stores
 *     frames, images or raw landmarks and exposes nothing to persistence.
 *   - Delegate strategy: GPU is attempted ONCE; if GPU init is unsupported the
 *     runtime falls back to the CPU/default delegate (NOT another identical
 *     GPU attempt). Only then does bounded retry apply; exhausted retries
 *     report failure so the caller offers camera-free.
 *
 * The MediaPipe modules are injected (`loadVisionTasks`) so this boundary is
 * testable under Node with fakes; production uses createWebPoseRuntime() in
 * ./poseRuntimeFactory.web.js which imports the vendored tasks-vision package
 * and resolves local asset URLs.
 */

export const POSE_RUNTIME_VERSION = '0.10.21';
export const ESM_PATH = `./assets/mediapipe/${POSE_RUNTIME_VERSION}/vision_bundle.mjs`;
export const WASM_PATH = `./assets/mediapipe/${POSE_RUNTIME_VERSION}/wasm`;
export const MODEL_PATH = `./assets/mediapipe/${POSE_RUNTIME_VERSION}/pose_landmarker_lite.task`;
export const MAX_POSES = 2;

// Attempt budget. The FIRST attempt uses GPU; every subsequent attempt is on
// the CPU/default delegate (see ensureLoaded). We do NOT re-try the same GPU
// configuration repeatedly.
export const GPU_ATTEMPTS = 1;
export const CPU_ATTEMPTS = 2;

/** Version-pinned, local-only asset manifest (used by release checks). */
export const POSE_ASSET_MANIFEST = Object.freeze({
  runtimePackage: '@mediapipe/tasks-vision',
  runtimeVersion: POSE_RUNTIME_VERSION,
  wasmPath: WASM_PATH,
  modelPath: MODEL_PATH,
  requiredFiles: [
    `${ESM_PATH}`,
    `${WASM_PATH}/vision_wasm_internal.js`,
    `${WASM_PATH}/vision_wasm_internal.wasm`,
    `${MODEL_PATH}`,
  ],
  numPoses: MAX_POSES,
  runningMode: 'VIDEO',
  localOnly: true,
});

export const RUNTIME_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  FAILED: 'failed',
  DISPOSED: 'disposed',
});

/** Third-party runtime CDNs are never permitted. */
const FORBIDDEN_REMOTE_HOSTS = [
  'cdn.jsdelivr.net', 'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com',
  'storage.googleapis.com', 'googleapis.com', 'gstatic.com',
];

/**
 * Assert an asset reference is NOT a third-party CDN.
 *  - relative paths (Vite/webpack `./assets/...`) and file/blob URLs are local;
 *  - http(s) URLs are allowed ONLY when they point at a same-origin vendored
 *    `/assets/mediapipe/` path (the production factory resolves these);
 *  - any remote URL on a known CDN host, or not under the vendored path, fails.
 */
export function assertLocalAsset(pathOrUrl) {
  if (typeof pathOrUrl !== 'string' || pathOrUrl.length === 0) {
    throw new Error('pose asset path must be a non-empty string');
  }
  const lower = pathOrUrl.toLowerCase();
  if (/^https?:\/\//i.test(pathOrUrl)) {
    if (FORBIDDEN_REMOTE_HOSTS.some((h) => lower.includes(h))) {
      throw new Error(`third-party runtime CDN is not permitted: ${pathOrUrl}`);
    }
    if (!lower.includes('/assets/mediapipe/')) {
      throw new Error(`remote runtime asset must be a vendored /assets/mediapipe path: ${pathOrUrl}`);
    }
  }
  return true;
}

/** Heuristic: does this error indicate the GPU delegate is unsupported? */
export function isGpuUnsupportedError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    /gpu|webgl|delegate|shader|context|fall ?back/.test(msg) ||
    err?.name === 'WebGLContextLost' ||
    err?.name === 'DelegateError'
  );
}

export class PoseRuntime {
  /**
   * @param {object} args
   * @param {function} args.loadVisionTasks - loader returning
   *        { FilesetResolver, PoseLandmarker }. Production passes the vendored
   *        tasks-vision dynamic import; tests inject a fake.
   * @param {function} [args.now]
   * @param {function} [args.sleep] injected awaitable backoff (ms)
   * @param {object} [args.paths] { wasmPath, modelPath } (defaults local)
   * @param {number} [args.maxPoses=2]
   * @param {number} [args.gpuAttempts=1]
   * @param {number} [args.cpuAttempts=2]
   * @param {number} [args.retryBaseMs=250]
   */
  constructor({
    loadVisionTasks,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    paths = {},
    maxPoses = MAX_POSES,
    gpuAttempts = GPU_ATTEMPTS,
    cpuAttempts = CPU_ATTEMPTS,
    retryBaseMs = 250,
  }) {
    this._loadVisionTasks = loadVisionTasks;
    this._now = now;
    this._sleep = sleep;
    this.wasmPath = paths.wasmPath ?? WASM_PATH;
    this.modelPath = paths.modelPath ?? MODEL_PATH;
    this.maxPoses = Math.min(MAX_POSES, maxPoses);
    this.gpuAttempts = gpuAttempts;
    this.cpuAttempts = cpuAttempts;
    this.retryBaseMs = retryBaseMs;
    this.status = RUNTIME_STATUS.IDLE;
    this._landmarker = null;
    this.attempts = []; // { delegate, ok, error }
    this.delegate = null; // 'GPU' | 'CPU' once ready
    this.lastError = null;
  }

  /** Build the ordered delegate attempt list: GPU first, then CPU. */
  _delegatePlan() {
    const plan = [];
    for (let i = 0; i < this.gpuAttempts; i++) plan.push('GPU');
    for (let i = 0; i < this.cpuAttempts; i++) plan.push('CPU');
    return plan;
  }

  /**
   * Load the landmarker with a GPU→CPU delegate fallback and bounded retries.
   * Returns true when ready (records the active delegate); false after the
   * whole plan is exhausted (caller offers camera-free).
   */
  async ensureLoaded() {
    if (this.status === RUNTIME_STATUS.READY && this._landmarker) return true;
    if (this.status === RUNTIME_STATUS.DISPOSED) return false;

    assertLocalAsset(this.wasmPath);
    assertLocalAsset(this.modelPath);

    this.status = RUNTIME_STATUS.LOADING;

    let fileset = null;
    const plan = this._delegatePlan();
    for (let i = 0; i < plan.length; i++) {
      const delegate = plan[i];
      try {
        // Each attempt loads the vendored module + resolves the WASM fileset
        // and creates the landmarker on this attempt's delegate.
        const vision = await this._loadVisionTasks();
        if (!fileset) {
          fileset = await vision.FilesetResolver.forVisionTasks(this.wasmPath);
        }
        const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: this.modelPath, delegate },
          runningMode: 'VIDEO',
          numPoses: this.maxPoses,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        this._landmarker = landmarker;
        this.delegate = delegate;
        this.status = RUNTIME_STATUS.READY;
        this.attempts.push({ delegate, ok: true });
        this.lastError = null;
        return true;
      } catch (err) {
        this.attempts.push({ delegate, ok: false, error: String(err?.message || err) });
        this.lastError = err;
        const gpuFailed = delegate === 'GPU';
        const nextIsCpu = plan[i + 1] === 'CPU';
        // GPU failure falls straight to CPU (we never re-try the same failing
        // GPU configuration). A CPU failure backs off before the next bounded
        // CPU attempt.
        if (!gpuFailed && i < plan.length - 1) {
          await this._sleep(this.retryBaseMs * (i + 1));
        } else if (gpuFailed && nextIsCpu) {
          // Immediate GPU→CPU delegate fallback.
        }
      }
    }

    this.status = RUNTIME_STATUS.FAILED;
    return false;
  }


  /**
   * Run one video-frame inference. Returns a fresh transient poses array of up
   * to `maxPoses` entries; NOTHING is stored.
   */
  async detect(video, timestampMs) {
    const ready = await this.ensureLoaded();
    if (!ready) {
      return { ok: false, poses: [], reason: 'model-load' };
    }
    try {
      const result = this._landmarker.detectForVideo(video, timestampMs);
      const poses = (result.landmarks || []).slice(0, this.maxPoses).map((landmarks) => ({
        landmarks: landmarks.map((lm) => ({
          x: lm.x, y: lm.y, z: lm.z ?? 0, visibility: lm.visibility ?? 0,
        })),
      }));
      return { ok: true, poses, delegate: this.delegate };
    } catch (err) {
      this.lastError = err;
      this.status = RUNTIME_STATUS.FAILED;
      return { ok: false, poses: [], reason: 'inference-error' };
    }
  }

  /** Free the landmarker. After dispose, detect signals camera-free. */
  dispose() {
    try { this._landmarker?.close?.(); } catch { /* ignore */ }
    this._landmarker = null;
    this.status = RUNTIME_STATUS.DISPOSED;
  }
}
