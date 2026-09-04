/**
 * Bloom Strength — local voice coach (browser speech synthesis).
 *
 * Uses device/browser speech synthesis only; every utterance is mirrored as
 * visible text by the screen layer. No audio is recorded or sent anywhere
 * (no microphone permission is ever requested — PRD §12). When speech is
 * unavailable the session continues text-only with a one-time notice.
 *
 * This wrapper is browser-facing. The engine never imports it; the screen
 * translates deterministic cue ids into speak/text via strengthCopy.
 */

import { CUE_COPY, repCueCopy, COUNT_DOWN_COPY } from '../strengthCopy.js';

export class VoiceCoach {
  /**
   * @param {object} [opts]
   * @param {Window} [opts.win] - inject window for tests
   */
  constructor({ win = typeof window !== 'undefined' ? window : null } = {}) {
    this.win = win;
    this.supported = !!(win && 'speechSynthesis' in win && win.SpeechSynthesisUtterance);
    this.muted = false;
    this._current = null;
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.cancel();
  }

  /** Cancel any in-flight utterance (higher-priority cue / pause / stop). */
  cancel() {
    if (this.supported) {
      try {
        this.win.speechSynthesis.cancel();
      } catch {
        /* browser quirk — text mirror still works */
      }
    }
    this._current = null;
  }

  /**
   * Speak a cue by id. Returns { text, spoke } so the screen can mirror text
   * regardless of whether audio played.
   */
  speakCue(cue) {
    if (!cue) return { text: '', spoke: false };
    let copy;
    if (cue.priority === 4 || cue.id.startsWith('rep-')) {
      const n = cue.repNumber ?? cue.id.replace('rep-', '');
      copy = repCueCopy(n);
    } else {
      copy = CUE_COPY[cue.id];
    }
    if (!copy) return { text: '', spoke: false };

    const spoke = this._say(copy.say);
    return { text: copy.text, spoke };
  }

  speakCountdown(step) {
    const copy = COUNT_DOWN_COPY[step];
    if (!copy) return { text: '', spoke: false };
    const spoke = this._say(copy.say);
    return { text: copy.text, spoke };
  }

  _say(text) {
    if (this.muted || !text) return false;
    if (!this.supported) return false;
    try {
      this.win.speechSynthesis.cancel(); // one active cue at a time
      const u = new this.win.SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;
      this.win.speechSynthesis.speak(u);
      this._current = u;
      return true;
    } catch {
      return false;
    }
  }
}
