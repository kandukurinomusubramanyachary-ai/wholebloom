/**
 * Bloom Strength — REAL web camera boundary.
 *
 * The ONLY place the Strength web package touches getUserMedia. Privacy and
 * lifecycle rules enforced here (PRD §12, §16):
 *   - Camera starts ONLY after an explicit user action (the Start/CTA tap).
 *     start() never calls itself.
 *   - Video only: { video: {...}, audio: false }. No microphone is ever
 *     requested.
 *   - Front-facing preference (facingMode 'user'); the preview is mirrored
 *     (scaleX(-1)) so screen directions match the user's own left/right.
 *   - Deterministic cleanup: stop() releases every MediaStreamTrack and is
 *     idempotent. It is invoked on Stop, completion, route change/unmount,
 *     page hide/background, a logout-equivalent callback and fatal errors.
 *
 * All globals are injectable (navigator/mediaStream/element/listeners) so the
 * boundary is fully testable under Node with fakes.
 */

export const CAMERA_ERRORS = Object.freeze({
  DENIED: 'denied',
  BUSY: 'busy',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
});

/** Map DOMException names / OverconstrainedError to a small reason set. */
function classifyError(err) {
  const name = err?.name || '';
  const msg = (err?.message || '').toLowerCase();
  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission/.test(msg)) {
    return CAMERA_ERRORS.DENIED;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || /busy|in use|could not start/.test(msg)) {
    return CAMERA_ERRORS.BUSY;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return CAMERA_ERRORS.UNAVAILABLE;
  }
  return CAMERA_ERRORS.ERROR;
}

export class CameraStage {
  /**
   * @param {object} args
   * @param {object} [args.navigator] inject navigator (browser default)
   * @param {object} [args.mediaStream] inject MediaStream ctor
   * @param {function} [args.onReleased] logout-equivalent / teardown hook
   * @param {function} [args.onLifecycle] called with 'hidden'|'pagehide' when
   *        the page is backgrounded/torn down. The owner (StrengthController)
   *        handles the SEMANTIC pause/freezing; the stage itself does NOT
   *        silently release the camera out from under a running session.
   * @param {boolean} [args.attachLifecycle=false] whether to attach document
   *        listeners directly (the controller attaches on itself; tests inject
   *        `doc`). Kept false by default so the orchestrator is authoritative.
   * @param {object} [args.doc] inject document (default globalThis.document)
   * @param {object} [args.win] inject window for 'pagehide' target
   */
  constructor({
    navigator: nav,
    mediaStream: MediaStreamCtor,
    onReleased = null,
    onLifecycle = null,
    attachLifecycle = false,
    doc = null,
    win = null,
  } = {}) {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    this._navigator = nav ?? g.navigator ?? null;
    this._MediaStream = MediaStreamCtor ?? g.MediaStream ?? null;
    this._doc = doc ?? (typeof g.document !== 'undefined' ? g.document : null);
    this._win = win ?? g.window ?? this._doc ?? null;
    this._onReleased = onReleased;
    this._onLifecycle = onLifecycle;
    this._stream = null;
    this._tracks = [];
    this._mirrored = true;
    this._released = false;
    this._visibilityHandler = null;

    if (attachLifecycle && this._doc) this.attachLifecycleListeners();
  }

  /**
   * Attach document visibility + pagehide listeners. `visibilitychange` fires
   * on the document; `pagehide` is on the window/document. Both targets are
   * injectable for tests. The handler notifies onLifecycle rather than
   * stopping the stream itself (the orchestrator owns that decision).
   */
  attachLifecycleListeners() {
    if (!this._doc) return;
    this._visibilityHandler = () => {
      if (this._doc.visibilityState === 'hidden') {
        this._onLifecycle?.('hidden');
      }
    };
    this._pagehideHandler = () => this._onLifecycle?.('pagehide');
    this._doc.addEventListener?.('visibilitychange', this._visibilityHandler);
    // pagehide fires on the window; fall back to document in tests.
    const pageTarget = this._win?.addEventListener ? this._win : this._doc;
    pageTarget.addEventListener?.('pagehide', this._pagehideHandler);
    this._pageTarget = pageTarget;
  }

  /** Detach lifecycle listeners (unmount). */
  detachLifecycleListeners() {
    if (this._visibilityHandler && this._doc) {
      this._doc.removeEventListener?.('visibilitychange', this._visibilityHandler);
    }
    if (this._pagehideHandler && this._pageTarget) {
      this._pageTarget.removeEventListener?.('pagehide', this._pagehideHandler);
    }
    this._visibilityHandler = null;
    this._pagehideHandler = null;
  }

  get isSupported() {
    return !!(this._navigator && typeof this._navigator.mediaDevices?.getUserMedia === 'function');
  }

  get active() {
    return !!this._stream && this._tracks.some((t) => t.readyState === 'live');
  }

  /**
   * Start the camera. MUST be called from a user gesture handler.
   * @param {object} [opts]
   * @param {HTMLElement} [opts.video] <video> element to bind + mirror
   * @returns {Promise<{ ok: boolean, stream?: MediaStream, reason?: string, error?: object }>}
   */
  async start({ video = null } = {}) {
    if (this.active) return { ok: true, stream: this._stream };
    if (!this.isSupported) {
      return { ok: false, reason: CAMERA_ERRORS.UNAVAILABLE, error: new Error('getUserMedia unavailable') };
    }
    try {
      const stream = await this._navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' }, // front-facing preference
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // video ONLY — microphone is never requested
      });
      this._stream = stream;
      this._tracks = stream.getVideoTracks ? stream.getVideoTracks() : (stream.getTracks ? stream.getTracks() : []);
      this._bindVideo(video, stream);
      this._released = false;
      return { ok: true, stream };
    } catch (err) {
      // Fatal acquisition error: never leave a partial stream live.
      this._releaseTracks();
      return { ok: false, reason: classifyError(err), error: err };
    }
  }

  /** Bind the stream to a <video> and apply the mirrored preview transform. */
  _bindVideo(video, stream) {
    if (!video) return;
    try {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute?.('playsinline', '');
      video.setAttribute?.('autoplay', '');
      // Mirrored preview for a front camera.
      video.style = video.style || {};
      video.style.transform = this._mirrored ? 'scaleX(-1)' : 'none';
      if (typeof video.play === 'function') {
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {
      /* binding is best-effort; the stream is still deterministically stopped */
    }
  }

  /**
   * Stop the camera and release every track. Idempotent. Safe to call from
   * Stop / completion / unmount / hidden / logout / fatal error.
   * @returns {{ released: boolean, trackCount: number }}
   */
  stop({ reason = 'manual' } = {}) {
    const trackCount = this._releaseTracks();
    const wasActive = trackCount > 0 || this._stream !== null;
    this._stream = null;
    if (wasActive && !this._released) {
      this._released = true;
      try { this._onReleased?.(reason); } catch { /* teardown hook never throws into caller */ }
    }
    return { released: wasActive, trackCount };
  }

  /** Release all tracks; returns how many live tracks were stopped. */
  _releaseTracks() {
    let stopped = 0;
    if (this._stream && typeof this._stream.getTracks === 'function') {
      for (const track of this._stream.getTracks()) {
        try { track.stop(); stopped += 1; } catch { /* ignore */ }
      }
    }
    for (const track of this._tracks) {
      try {
        if (track.readyState !== 'ended') { track.stop(); stopped += 1; }
      } catch { /* ignore */ }
    }
    this._tracks = [];
    return stopped;
  }

  /** Detach listeners (route unmount). Stops the camera too. */
  dispose() {
    this.stop({ reason: 'dispose' });
    this.detachLifecycleListeners();
  }
}
