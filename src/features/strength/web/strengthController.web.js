/**
 * Bloom Strength — web integration controller (authoritative orchestrator).
 *
 * Composes the REAL boundaries for the web screen; Bloom later wraps it with
 * navigation/auth/Firestore/design-system UI. Nothing here records a frame —
 * pose output is transient and only the 14-field summary persists.
 *
 *   CameraStage  — getUserMedia; video-only/front/mirrored; deterministic stop
 *   PoseRuntime  — version-pinned LOCAL MediaPipe; GPU→CPU fallback; ≤2 poses
 *   InferenceMonitor — effective FPS/latency; <8fps/5s → ONE camera-free event
 *   StrengthSession — the deterministic engine (counting/cues/privacy)
 *   StrengthOutbox  — local-first persistence (injected); cloud sync UID-bound
 *   VoiceCoach      — optional local speech; every cue is mirrored as text
 *
 * Lifecycle OWNERSHIP: this controller is the single authority over when the
 * camera runs and when coaching freezes. visibility hidden / pagehide / route
 * unmount / Stop / fatal errors funnel through one path that pauses the
 * session, cancels speech, stops the inference loop and releases the camera.
 *
 * INFERENCE DURING RE-ENTRY (important): after an explicit user Resume or a
 * background resume the set is still PAUSED, but inference MUST keep running so
 * the positioning coach can observe stable re-entry. tick() therefore feeds
 * frames whenever the session is actively coaching or re-entering (CALIBRATION,
 * ACTIVE, or PAUSED-after-a-resume-request). Reps never progress and re-entry
 * time is never counted as active duration — both are guaranteed by the engine.
 *
 * The controller exposes small public phase methods (beginCountdown /
 * beginActive) so the screen never reaches into controller.session.
 *
 * Every collaborator is injectable, so the whole controller is testable under
 * Node with fakes (no DOM/camera/network).
 */

import { StrengthSession, PHASES } from '../engine/session.js';
import { InferenceMonitor } from '../engine/inferenceMonitor.js';
import { createIdFactory } from '../services/sessionIds.js';
import { CameraStage } from './cameraStage.web.js';
import { createWebPoseRuntime } from './poseRuntimeFactory.web.js';

export const CONTROLLER_STATUS = Object.freeze({
  IDLE: 'idle',
  CAMERA_DENIED: 'camera-denied',
  CAMERA_BUSY: 'camera-busy',
  CAMERA_UNAVAILABLE: 'camera-unavailable',
  MODEL_FAILED: 'model-failed',
  RUNNING: 'running',
  PAUSED: 'paused',
  BG_PAUSED: 'bg-paused',
  CAMERA_FREE: 'camera-free',
  ENDED: 'ended',
  DISPOSED: 'disposed',
});

/** Approximate target inference rate for the real-device detector loop. */
export const DEFAULT_FRAME_INTERVAL_MS = 90; // ~11 updates/sec (within 10–12)

export class StrengthController {
  /**
   * @param {object} args
   * @param {string} args.exerciseId
   * @param {'web'|'native'} [args.platform='web']
   * @param {function} args.now injected clock (ms)
   * @param {function} [args.createId] session id factory (preserved across sets)
   * @param {CameraStage} [args.camera] pre-built camera stage (else default)
   * @param {object} [args.poseRuntime] { ensureLoaded(), detect(), dispose() }
   * @param {object} [args.outbox] { saveSession(), flush() } (Bloom injects)
   * @param {object} [args.voice] { speakCue(), speakCountdown(), setMuted(), cancel() }
   * @param {object} [args.videoElement] <video> to bind the preview
   * @param {number} [args.frameIntervalMs] detector loop tick (0 => manual tick)
   * @param {function} [args.onFrame], [args.onEvent] UI callbacks
   * @param {object} [args.doc]/[args.win] injectable lifecycle targets
   * @param {boolean} [args.attachLifecycle=true] wire visibility/pagehide
   */
  constructor({
    exerciseId,
    platform = 'web',
    now,
    createId = null,
    camera = null,
    poseRuntime,
    outbox = null,
    voice = null,
    videoElement = null,
    frameIntervalMs = 0,
    onFrame = null,
    onEvent = null,
    doc = null,
    win = null,
    attachLifecycle = true,
    setIntervalFn = null,
    clearIntervalFn = null,
  }) {
    this.now = now || (() => Date.now());
    this.exerciseId = exerciseId;
    this.platform = platform;
    this._createId = createId || createIdFactory('random');
    this.outbox = outbox;
    this.voice = voice;
    this.video = videoElement;
    this.frameIntervalMs = frameIntervalMs;
    this.onFrame = onFrame;
    this.onEvent = onEvent;
    this._setInterval = setIntervalFn || (typeof setInterval !== 'undefined' ? setInterval : null);
    this._clearInterval = clearIntervalFn || (typeof clearInterval !== 'undefined' ? clearInterval : null);

    // Camera stage: lifecycle callbacks are owned by the controller.
    this.camera = camera || new CameraStage({ doc, win, attachLifecycle: false });
    this.camera._onLifecycle = (kind) => this.handleBackground(kind);
    if (attachLifecycle) this.camera.attachLifecycleListeners?.();
    // Production default: the vendored local MediaPipe runtime (GPU→CPU).
    this.runtime = poseRuntime || createWebPoseRuntime({ now: this.now });

    this.session = null; // created on start (no id consumed before then)
    this.monitor = new InferenceMonitor({ now: this.now });
    this.status = CONTROLLER_STATUS.IDLE;
    this._countdownStarted = false;
    this._loopHandle = null;
    this._disposed = false;
    /** When false, detect() must not run (stopped/disposed). */
    this._inferenceAllowed = false;
    /** True while the user/background resume has requested re-entry observation. */
    this._awaitingReentry = false;
    /** True while the current PAUSED state is an automatic tracking pause
     *  (lost view / low confidence / extra person) — it recovers without an
     *  explicit Resume. Explicit user/background pauses set this false. */
    this._autoPaused = false;
    /**
     * How a backgrounded set should resume (decided at background time):
     *   'reentry' — ACTIVE/PAUSED set: restart camera, observe stable re-entry.
     *   'restart' — backgrounded during CALIBRATION/COUNTDOWN: restart camera
     *               and begin a FRESH calibration (no reps exist to preserve;
     *               a half-finished countdown must not be resumed).
     */
    this._bgResumeMode = null;
    this._recommendEmitted = false;
    /** Pending summaries that failed LOCAL save (kept for Retry). */
    this.pendingSaves = [];
  }

  _emit(event) {
    try { this.onEvent?.({ at: this.now(), ...event }); } catch { /* UI never breaks loop */ }
  }

  _newSession(mode) {
    return new StrengthSession({
      exerciseId: this.exerciseId, mode, platform: this.platform,
      now: this.now, createId: this._createId,
    });
  }

  /** True when the detector loop should be running inference this tick. */
  _shouldInfer() {
    if (this._disposed || !this._inferenceAllowed) return false;
    if (!this.session) return false;
    // Camera-free mode has no detector.
    if (this.session.mode === 'camera-free') return false;
    // RUNNING covers calibration, countdown and active — all feed frames.
    if (this.status === CONTROLLER_STATUS.RUNNING) return true;
    // PAUSED: the engine decides whether a paused set may observe recovery.
    //   - AUTO pause (lost view / low confidence / extra person): recovers on
    //     its own once stable single-person framing returns — frames keep
    //     flowing (item 8). No explicit resume required.
    //   - EXPLICIT pause (user or background): frames flow only after a
    //     resume request (_awaitingReentry), so reps cannot unfreeze without
    //     a deliberate user action.
    if (this.session.phase === PHASES.PAUSED) {
      return this._awaitingReentry || this._autoPaused === true;
    }
    return false;
  }

  /** Start with the camera from an explicit user gesture. */
  async startWithCamera() {
    if (this._disposed) return { ok: false, status: this.status };
    this._inferenceAllowed = true;
    this._awaitingReentry = false;
    this._bgResumeMode = null;
    this._countdownStarted = false;
    this._recommendEmitted = false;
    this.monitor.reset();

    const res = await this.camera.start({ video: this.video });
    if (!res.ok) {
      this.status =
        res.reason === 'denied' ? CONTROLLER_STATUS.CAMERA_DENIED
        : res.reason === 'busy' ? CONTROLLER_STATUS.CAMERA_BUSY
        : CONTROLLER_STATUS.CAMERA_UNAVAILABLE;
      this._emit({ type: 'camera-error', reason: res.reason });
      return { ok: false, status: this.status, reason: res.reason };
    }
    const loaded = await this.runtime.ensureLoaded();
    if (!loaded) {
      this.camera.stop({ reason: 'model-load' });
      this.status = CONTROLLER_STATUS.MODEL_FAILED;
      this._emit({ type: 'model-failed' });
      return { ok: false, status: this.status, reason: 'model-load' };
    }
    this.session = this._newSession('camera');
    this.session.start(); // -> CALIBRATION
    this.status = CONTROLLER_STATUS.RUNNING; // frames flow during calibration
    this._inferenceAllowed = true;
    this._emit({ type: 'running', mode: 'camera' });
    this._startLoop();
    return { ok: true, status: this.status };
  }

  /** Start a camera-free set (no camera/model). Manual +1 counts. */
  startCameraFree() {
    if (this._disposed) return { ok: false, status: this.status };
    this.camera.stop({ reason: 'camera-free' });
    this._stopLoop();
    this.session = this._newSession('camera-free');
    this.monitor.reset();
    this.status = CONTROLLER_STATUS.CAMERA_FREE;
    this.session.start();
    this._inferenceAllowed = false; // no detector in camera-free mode
    this._awaitingReentry = false;
    this._bgResumeMode = null;
    this._emit({ type: 'running', mode: 'camera-free' });
    return { ok: true, status: this.status };
  }

  /**
   * Explicit, safe camera → camera-free transition.
   * Stops the detector loop, releases EVERY MediaStreamTrack, disposes the
   * pose runtime, silences cues; the camera set is ENDED (summary preserved +
   * persisted) and a FRESH camera-free set begins. Reps are never lost.
   */
  switchToCameraFree() {
    if (this._disposed) return { ok: false, status: this.status };
    const hadCameraSet = this.status === CONTROLLER_STATUS.RUNNING
      || this.status === CONTROLLER_STATUS.PAUSED
      || this.status === CONTROLLER_STATUS.BG_PAUSED;

    this._inferenceAllowed = false;
    this._awaitingReentry = false;
    this._stopLoop();

    let carriedSummary = null;
    if (hadCameraSet) {
      const cameraSummary = this.session.stop();
      carriedSummary = cameraSummary;
      this._persist(cameraSummary, { source: 'camera-switch' });
    }

    const stopped = this.camera.stop({ reason: 'switch-camera-free' });
    try { this.runtime?.dispose?.(); } catch { /* ignore */ }
    this._silence();

    this.session = this._newSession('camera-free');
    this.monitor.reset();
    this.status = CONTROLLER_STATUS.CAMERA_FREE;
    this.session.start();

    this._emit({
      type: 'camera-free-switched',
      cameraReleased: stopped.released,
      liveTracksStopped: stopped.trackCount,
      carriedSummary: carriedSummary ? {
        id: carriedSummary.id, acceptedReps: carriedSummary.acceptedReps,
        completionState: carriedSummary.completionState,
      } : null,
    });
    this._emit({ type: 'running', mode: 'camera-free' });
    return {
      ok: true, status: this.status,
      cameraReleased: stopped.released,
      liveTracksStopped: stopped.trackCount,
      carriedSummary,
    };
  }

  // --- public phase orchestration (screen never touches session directly) ---

  /**
   * Camera-guided phase transitions (beginCountdown / beginActive) are ONLY
   * valid while the controller/camera set is live and coaching. A
   * backgrounded / paused / stopped / ended / disposed state must never be
   * able to advance the set merely because the engine phase still reads
   * CALIBRATION/COUNTDOWN (e.g. a stale UI countdown timer firing after the
   * camera was released).
   */
  _guardedCameraSet() {
    return this.status === CONTROLLER_STATUS.RUNNING;
  }

  /** Calibration → countdown. Validates the controller state + engine phase. */
  beginCountdown() {
    if (!this.session) return { ok: false, reason: 'no-session' };
    if (!this._guardedCameraSet()) {
      return { ok: false, reason: 'camera-set-not-live', status: this.status };
    }
    const phase = this.session.beginCountdown();
    if (phase === null) return { ok: false, reason: 'not-calibration-or-not-ready' };
    this._countdownStarted = true;
    this._emit({ type: 'countdown-began' });
    return { ok: true, phase };
  }

  /**
   * Screen helper: safe to call every frame while in calibration. Begins the
   * countdown exactly once, once calibration is ready. Returns true on the
   * frame it transitions.
   */
  beginCountdownWhenReady() {
    if (!this.session || this.session.mode === 'camera-free') return false;
    if (this._countdownStarted) return false;
    if (this.session.phase !== PHASES.CALIBRATION) return false;
    const res = this.beginCountdown();
    return res.ok === true;
  }

  /** Countdown → active set. Validates the controller state + engine phase. */
  beginActive() {
    if (!this.session) return { ok: false, reason: 'no-session' };
    // A backgrounded/stopped camera must NEVER enter an active guided set,
    // even if the engine phase still says COUNTDOWN (stale countdown timer).
    if (!this._guardedCameraSet()) {
      return { ok: false, reason: 'camera-set-not-live', status: this.status };
    }
    const phase = this.session.beginActive();
    if (phase === null) return { ok: false, reason: 'not-countdown' };
    this.status = CONTROLLER_STATUS.RUNNING;
    this._emit({ type: 'active-began' });
    return { ok: true, phase };
  }

  _startLoop() {
    if (this.frameIntervalMs > 0 && this._setInterval) {
      this._stopLoop();
      this._loopHandle = this._setInterval(() => { this.tick(); }, this.frameIntervalMs);
    }
  }

  _stopLoop() {
    if (this._loopHandle !== null && this._clearInterval) this._clearInterval(this._loopHandle);
    this._loopHandle = null;
  }

  _silence() {
    try { this.session?._scheduler?.silence?.(); } catch { /* ignore */ }
    try { this.voice?.cancel?.(); } catch { /* ignore */ }
  }

  /** One detector-loop iteration (production loop or deterministic test tick). */
  async tick() {
    if (this._disposed || !this._shouldInfer()) return null;

    const wasReentry = this._awaitingReentry;
    const t0 = this.now();
    const result = await this.runtime.detect(this.video, t0);
    const latencyMs = this.now() - t0;

    // Re-check after the await: a background/stop may have landed mid-detect.
    if (!this._inferenceAllowed || this._disposed) return null;

    if (!result.ok) {
      this._fatalFallback(result.reason || 'model-error');
      return null;
    }

    this.monitor.recordUpdate({ latencyMs });
    const phaseBefore = this.session.phase;
    const frame = this.session.feedPoses(result.poses);
    this._mirrorCues(frame);

    // Detect the re-entry → ACTIVE transition the engine just made. This
    // covers BOTH explicit resume (wasReentry / _awaitingReentry) and the
    // automatic tracking-pause recovery (_autoPaused).
    if (phaseBefore === PHASES.PAUSED && this.session.phase === PHASES.ACTIVE) {
      this._awaitingReentry = false;
      this._autoPaused = false;
      this.status = CONTROLLER_STATUS.RUNNING;
      this._emit({ type: 'resumed', automatic: !wasReentry });
    } else if (this.status === CONTROLLER_STATUS.RUNNING && this.session.phase === PHASES.PAUSED) {
      // The engine entered an automatic tracking pause this frame. The
      // controller stays RUNNING so the loop keeps feeding recovery frames;
      // an explicit user pause is requested separately via userPause().
      this._autoPaused = true;
    }

    // Slow-inference recommendation: emit ONLY on the transition into it.
    const latch = this.monitor.shouldRecommendCameraFree() || this.session.checkSlowInference();
    if (latch && !this._recommendEmitted) {
      this._recommendEmitted = true;
      this._emit({ type: 'recommend-camera-free', stats: this.monitor.stats() });
    }

    this.onFrame?.({ ...frame, inference: this.monitor.stats(), delegate: result.delegate });

    if (frame.setComplete) await this._complete();
    return frame;
  }

  /**
   * Speak + surface visible text for any cues this frame produced. Every
   * spoken cue is ALWAYS mirrored as text (mute only silences audio).
   */
  _mirrorCues(frame) {
    if (!frame || !Array.isArray(frame.cues)) return;
    for (const cue of frame.cues) {
      let text = cue.id;
      let spoke = false;
      if (this.voice) {
        try {
          const r = this.voice.speakCue(cue) || {};
          if (r.text) text = r.text;
          spoke = !!r.spoke;
        } catch { /* text still shows */ }
      }
      // Visible cue text is emitted so the UI always mirrors it (mute or not).
      this._emit({ type: 'cue', cue, text, spoke });
    }
  }

  /** Speak a countdown step (3/2/1) and mirror it as text. */
  speakCountdown(step) {
    let text = String(step);
    if (this.voice) {
      try {
        const r = this.voice.speakCountdown(step) || {};
        if (r.text) text = r.text;
      } catch { /* text only */ }
    }
    this._emit({ type: 'countdown', step, text });
    return text;
  }

  manualRep() {
    if (this.status !== CONTROLLER_STATUS.CAMERA_FREE) return null;
    const r = this.session.manualRep();
    // Mirror any rep cue as visible text (+ voice when available).
    if (r && r.cue) {
      if (this.voice) { try { this.voice.speakCue(r.cue); } catch { /* ignore */ } }
      this._emit({ type: 'cue', cue: r.cue });
    }
    this.onFrame?.(r);
    if (r.setComplete) this._complete();
    return r;
  }

  /**
   * Explicit user pause. ONLY valid while the set is ACTIVE — pausing during
   * calibration/countdown is rejected cleanly (the controller must not show a
   * paused state the engine never entered).
   */
  userPause() {
    if (this.status !== CONTROLLER_STATUS.RUNNING) return { ok: false, reason: 'not-running' };
    if (!this.session || this.session.phase !== PHASES.ACTIVE) {
      return { ok: false, reason: 'not-active' };
    }
    this.session.userPause(); // engine: ACTIVE -> PAUSED (freezes reps)
    this._awaitingReentry = false;
    this._autoPaused = false; // explicit pause: recovery needs a Resume press
    this._inferenceAllowed = true; // loop stays available; no re-entry yet
    this.status = CONTROLLER_STATUS.PAUSED;
    this._silence();
    this._emit({ type: 'paused', reason: 'user' });
    return { ok: true, status: this.status };
  }

  /**
   * User taps Resume after an explicit pause. The set STAYS paused while the
   * coach observes stable re-entry; inference is re-enabled HERE so frames flow
   * during PAUSED. When feedPoses() reaches ACTIVE, tick() flips the controller
   * to RUNNING and emits 'resumed'. Reps never progress during re-entry.
   */
  userResume() {
    if (this.status !== CONTROLLER_STATUS.PAUSED) return { ok: false, reason: 'not-user-paused' };
    if (!this.session || this.session.phase !== PHASES.PAUSED) return { ok: false, reason: 'not-paused' };
    this.session.userResume(); // engine: begins re-entry observation (stays PAUSED)
    this._awaitingReentry = true;
    this._inferenceAllowed = true;
    this.status = CONTROLLER_STATUS.PAUSED;
    this._startLoop();
    this._emit({ type: 'resume-requested' });
    return { ok: true, status: this.status };
  }

  /**
   * Single background/teardown path for visibility hidden, pagehide, route
   * unmount and screen/background signals: freeze reps, cancel speech, stop
   * inference, release the camera, block further detect().
   */
  handleBackground(kind = 'hidden') {
    if (this._disposed) return;
    // A live camera set exists in any coaching/re-entry state (RUNNING covers
    // calibration/countdown/active/auto-paused).
    const cameraSet = this.status === CONTROLLER_STATUS.RUNNING
      || this.status === CONTROLLER_STATUS.PAUSED;
    // Capture the engine phase BEFORE onHidden(), so resume can be phase-aware.
    const phase = this.session ? this.session.phase : null;
    this.session?.onHidden?.(); // engine pauses if ACTIVE; cancels speech
    this._inferenceAllowed = false;
    this._awaitingReentry = false;
    this._autoPaused = false; // background requires deliberate resume
    this._stopLoop();
    this.camera.stop({ reason: kind });
    this._silence();

    if (cameraSet && this.status !== CONTROLLER_STATUS.ENDED) {
      // Decide how this set should resume.
      //   ACTIVE/PAUSED set -> stable re-entry ('reentry').
      //   CALIBRATION/COUNTDOWN -> a fresh calibration ('restart'); there are
      //     no reps to preserve and a half-finished countdown must not resume.
      const needsRestart = phase === PHASES.CALIBRATION || phase === PHASES.COUNTDOWN;
      this._bgResumeMode = needsRestart ? 'restart' : 'reentry';
      if (phase === PHASES.COUNTDOWN) {
        // Invalidate any countdown so a stale UI timer cannot call beginActive.
        this._countdownStarted = false;
      }
      this.status = CONTROLLER_STATUS.BG_PAUSED;
    }
    // Tell the screen the phase it backgrounded from so it can cancel its own
    // 3-2-1 timer and reset countdown UI.
    this._emit({ type: 'background-paused', kind, phase });
  }

  /**
   * Resume after backgrounding, phase-aware:
   *   - ACTIVE/PAUSED set ('reentry'): restart camera, stay PAUSED, observe
   *     stable re-entry; tick() flips to RUNNING once the engine returns ACTIVE.
   *   - CALIBRATION/COUNTDOWN ('restart'): restart camera and start a FRESH
   *     calibration session (stale pre-background calibration/half countdown is
   *     discarded). Frames flow immediately in RUNNING; calibrationReady is
   *     reached again, then a new 3-2-1 countdown runs.
   */
  async resumeFromBackground() {
    if (this.status !== CONTROLLER_STATUS.BG_PAUSED) return { ok: false, status: this.status };
    const res = await this.camera.start({ video: this.video });
    if (!res.ok) return { ok: false, status: this.status, reason: res.reason };

    const mode = this._bgResumeMode === 'restart' ? 'restart' : 'reentry';

    if (mode === 'restart') {
      // Fresh camera-guided session begins in CALIBRATION with reset coach /
      // baseline — no stale pre-background state is trusted.
      this.session = this._newSession('camera');
      this.monitor.reset();
      this._recommendEmitted = false;
      this._awaitingReentry = false;
      this._autoPaused = false;
      this._countdownStarted = false;
      this.session.start(); // -> CALIBRATION
      this.status = CONTROLLER_STATUS.RUNNING;
      this._inferenceAllowed = true;
      this._startLoop();
      this._emit({ type: 'resume-attempted', restart: true, phase: PHASES.CALIBRATION });
      return { ok: true, status: this.status, restart: true };
    }

    // Re-entry path: begin stable re-entry observation on the existing set.
    if (this.session && this.session.phase === PHASES.PAUSED) this.session.userResume();
    this._inferenceAllowed = true;
    this._awaitingReentry = true;
    this.status = CONTROLLER_STATUS.PAUSED; // re-entry hold gates coaching resume
    this._startLoop();
    this._emit({ type: 'resume-attempted', restart: false });
    return { ok: true, status: this.status, restart: false };
  }

  async _complete() {
    this._stopLoop();
    this._inferenceAllowed = false;
    this._awaitingReentry = false;
    this.camera.stop({ reason: 'complete' });
    this.status = CONTROLLER_STATUS.ENDED;
    const summary = this.session.buildSummary();
    this._emit({ type: 'complete', completionState: summary.completionState });
    await this._persist(summary, { source: 'complete' });
  }

  async stop() {
    this._stopLoop();
    this._inferenceAllowed = false;
    this._awaitingReentry = false;
    const summary = this.session.stop();
    this.camera.stop({ reason: 'stop' });
    this._silence();
    this.status = CONTROLLER_STATUS.ENDED;
    this._emit({ type: 'stopped', completionState: summary.completionState });
    await this._persist(summary, { source: 'stop' });
    return summary;
  }

  _fatalFallback(reason) {
    this._stopLoop();
    this._inferenceAllowed = false;
    this._awaitingReentry = false;
    this.camera.stop({ reason });
    this.status = CONTROLLER_STATUS.MODEL_FAILED;
    if (!this._recommendEmitted) {
      this._recommendEmitted = true;
      this._emit({ type: 'recommend-camera-free', reason });
    }
  }

  /** Mute/unmute the LOCAL voice coach. Visible text cues are unaffected. */
  setMuted(muted) {
    this.voice?.setMuted?.(muted);
    this._emit({ type: muted ? 'muted' : 'unmuted' });
    return muted;
  }

  /**
   * Persistence result reporting. Cloud/network failure is 'sync-pending'
   * (local OK). A THROWN save (no UID / local adapter / serialization-privacy)
   * is a true SAVE ERROR: the summary is retained for retry and a save-error
   * event is emitted rather than claiming it is stored.
   */
  async _persist(summary, meta = {}) {
    if (!this.outbox) return null;
    const { display, ...persistable } = summary; // display never persists
    try {
      const res = await this.outbox.saveSession(persistable);
      if (res && res.status === 'sync-pending') {
        this._emit({ type: 'persistence', status: 'sync-pending', error: String(res.syncError?.message || ''), ...meta });
      } else if (res && res.status === 'synced') {
        this._emit({ type: 'persistence', status: 'synced', ...meta });
      } else {
        this._emit({ type: 'persistence', status: 'saved-local', ...meta });
      }
      this.pendingSaves = this.pendingSaves.filter((p) => p.id !== summary.id);
      return res;
    } catch (err) {
      this.pendingSaves.push(summary);
      this._emit({ type: 'persistence', status: 'save-error', error: String(err?.message || err), ...meta });
      return { status: 'save-error', error: err, summary };
    }
  }

  /** Retry previously failed local saves. */
  async retryPendingSaves() {
    if (!this.outbox) return { retried: 0, errors: [] };
    const stillFailing = [];
    let retried = 0;
    for (const summary of this.pendingSaves) {
      try {
        const { display, ...persistable } = summary;
        await this.outbox.saveSession(persistable);
        retried += 1;
      } catch (err) {
        stillFailing.push({ id: summary.id, error: String(err?.message || err) });
      }
    }
    this.pendingSaves = this.pendingSaves.filter((p) => stillFailing.some((f) => f.id === p.id));
    if (stillFailing.length === 0) this._emit({ type: 'persistence', status: 'saved-local', source: 'retry' });
    return { retried, errors: stillFailing };
  }

  /** Route unmount / logout teardown: abandon the set, release everything. */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._inferenceAllowed = false;
    this._awaitingReentry = false;
    this._stopLoop();
    this.session?.abandon?.();
    this.camera.stop({ reason: 'dispose' });
    this.camera.detachLifecycleListeners?.();
    this.camera.dispose?.();
    try { this.runtime?.dispose?.(); } catch { /* ignore */ }
    this._silence();
    this.status = CONTROLLER_STATUS.DISPOSED;
    this._emit({ type: 'disposed' });
  }
}

/**
 * Pure button-state helper for the screen. Stop is enabled while a live set
 * exists (running / paused / bg-paused / camera-free) and disabled once there
 * is nothing to stop (idle / ended / disposed / fatal camera-or-model states).
 */
export function stopEnabled(status) {
  return (
    status === CONTROLLER_STATUS.RUNNING ||
    status === CONTROLLER_STATUS.PAUSED ||
    status === CONTROLLER_STATUS.BG_PAUSED ||
    status === CONTROLLER_STATUS.CAMERA_FREE
  );
}
