/**
 * Bloom Strength — cue scheduler.
 *
 * Deterministic spoken-cue arbitration (PRD §10 cue scheduler):
 *   Priority 1  stop / system failure        — cancels all lower speech
 *   Priority 2  tracking / framing           — lost-view help, never a form dig
 *   Priority 3  exercise form                 — ONE persistent reviewed cue
 *   Priority 4  rep completion                — short count
 *   Priority 5  encouragement                 — at most once per set
 *
 * Guardrails: at most one active spoken cue; ≥3s between cues; no more than
 * 4 coaching (priority 2+3) cues per minute; per-cue cooldowns; stale speech
 * is cancelled when a higher-priority cue appears. All times come from an
 * injected clock so behavior is fully reproducible in tests.
 */

export const CUE_PRIORITY = Object.freeze({
  system: 1,
  tracking: 2,
  form: 3,
  rep: 4,
  encouragement: 5,
});

const DEFAULT_GUARDRAILS = Object.freeze({
  minGapMs: 3000,
  /** A PERSISTENT system condition (e.g. two people keep standing in frame)
   *  re-announces at most this often. The FIRST system cue still interrupts
   *  instantly; repeat announcements are throttled so the detector loop
   *  cannot speak the same system cue every frame. */
  systemRepeatMs: 3000,
  coachingPerMinute: 4,
  // A form condition must be persistently offered for this long before it
  // qualifies to speak. At 12fps this is ~3 frames; the session only offers a
  // form cue while its reviewed condition stays true, so one-frame flicker
  // never reaches the cooldown window.
  persistFormMs: 250,
  formCooldownMs: 9000,
  trackingCooldownMs: 5000,
});

export class CueScheduler {
  /**
   * @param {object} [opts]
   * @param {function} [opts.now] injected clock (required for determinism)
   */
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.g = { ...DEFAULT_GUARDRAILS, ...(opts.guardrails || {}) };
    this._lastSpokenAt = null;
    this._lastSpokenId = null;
    this._activeCue = null; // { id, priority, at }
    this._coachingTimes = []; // timestamps of p2/p3 speech
    this._cooldowns = new Map(); // cueId -> next eligible ms
    this._formFirstSeen = new Map(); // cueId -> first persist timestamp
    this._encouragementUsed = false;
    this.cueCounts = {}; // spoken cue id -> count (allowed summary field)
  }

  reset() {
    this._lastSpokenAt = null;
    this._lastSpokenId = null;
    this._activeCue = null;
    this._coachingTimes = [];
    this._cooldowns.clear();
    this._formFirstSeen.clear();
    this._encouragementUsed = false;
    this.cueCounts = {};
  }

  /**
   * Offer one frame's candidate cues. Candidates are collected by the caller
   * (session): system failures, tracking cue, active form cues, rep count,
   * encouragement eligibility.
   *
   * @param {object} frame
   * @param {Array<{id:string,priority:number,cooldownMs?:number}>} [frame.candidates]
   * @param {boolean} [frame.repCompleted] - offer the rep-count cue
   * @param {number} [frame.repNumber]
   * @param {boolean} [frame.offerEncouragement] - set may speak encouragement
   * @returns {{ speak: object|null, cancel: object|null, counts: object }}
   *   speak: cue to utter (also mirrored as text by UI); cancel: previously
   *   active cue that must be interrupted.
   */
  offer(frame = {}) {
    const result = this._offerInner(frame);
    // Rep counts are NOT coaching cues and are already captured as
    // acceptedReps in the summary schema; keep them out of cueCounts.
    this.cueCounts = Object.fromEntries(
      Object.entries(this.cueCounts).filter(([id]) => !id.startsWith('rep-')),
    );
    result.counts = this.cueCounts;
    return result;
  }

  _offerInner(frame = {}) {
    const t = this.now();
    const candidates = frame.candidates || [];
    let cancel = null;

    // System cue (priority 1) always interrupts lower speech. The FIRST
    // announcement speaks immediately and cancels any active cue; a PERSISTENT
    // system condition re-offered on subsequent detector frames is throttled
    // by systemRepeatMs so it never repeats every frame.
    const system = candidates.find((c) => c.priority === CUE_PRIORITY.system);
    if (system) {
      const sameActive =
        this._activeCue && this._activeCue.id === system.id;
      const spokeRecently =
        this._lastSpokenId === system.id &&
        this._lastSpokenAt !== null &&
        t - this._lastSpokenAt < (system.cooldownMs ?? this.g.systemRepeatMs);

      if (sameActive && spokeRecently) {
        // Same persistent condition still in effect and recently announced:
        // keep it active, interrupt nothing, do not re-speak/re-count.
        return { speak: null, cancel: null, counts: this.cueCounts };
      }

      // New system condition (or repeat window elapsed): interrupt any
      // LOWER-priority speech and announce immediately.
      const cancel = this._takeActive(system, t);
      this._record(system, t);
      return { speak: system, cancel, counts: this.cueCounts };
    }

    // Build the ordered list of live candidates this frame.
    const live = [];

    const tracking = candidates
      .filter((c) => c.priority === CUE_PRIORITY.tracking)
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (tracking) live.push(tracking);

    const form = this._selectFormCue(
      candidates.filter((c) => c.priority === CUE_PRIORITY.form),
      t,
    );
    if (form) live.push(form);

    // Rep completion (priority 4): offered when a rep was just counted.
    if (frame.repCompleted) {
      live.push({
        id: `rep-${frame.repNumber ?? ''}`,
        priority: CUE_PRIORITY.rep,
        repNumber: frame.repNumber,
      });
    }

    // Encouragement (priority 5): once per set, never while ANY p1–p3
    // condition is present this frame (even one still inside its persistence
    // window), and never interrupting a correction.
    const anyFormCondition = (frame.candidates || [])
      .some((c) => c.priority === CUE_PRIORITY.form);
    if (
      frame.offerEncouragement &&
      !this._encouragementUsed &&
      !tracking &&
      !form &&
      !anyFormCondition
    ) {
      live.push({ id: 'encouragement', priority: CUE_PRIORITY.encouragement });
    }

    if (live.length === 0) {
      // Clear stale active cue if its condition has vanished.
      if (this._activeCue && t - this._activeCue.at >= this.g.minGapMs) {
        this._activeCue = null;
      }
      return { speak: null, cancel: null, counts: this.cueCounts };
    }

    // Highest priority wins. Lower priority number = higher priority.
    live.sort((a, b) => a.priority - b.priority);
    const best = live[0];

    // Higher-priority cue interrupts whatever is active.
    if (this._activeCue && best.priority < this._activeCue.priority) {
      cancel = this._activeCue;
    }

    if (this._canSpeak(best, t)) {
      // Speaking a higher-priority cue cancels stale lower speech.
      if (!cancel && this._activeCue && best.id !== this._activeCue.id) {
        cancel = this._activeCue;
      }
      this._record(best, t);
      if (best.priority === CUE_PRIORITY.encouragement) {
        this._encouragementUsed = true;
      }
      // Per-cue cooldown.
      const cd = best.cooldownMs ?? (best.priority === CUE_PRIORITY.tracking
        ? this.g.trackingCooldownMs
        : best.priority === CUE_PRIORITY.form
          ? this.g.formCooldownMs
          : 0);
      if (cd > 0) this._cooldowns.set(best.id, t + cd);
      this._activeCue = { id: best.id, priority: best.priority, at: t };
      return { speak: best, cancel, counts: this.cueCounts };
    }

    return { speak: null, cancel, counts: this.cueCounts };
  }

  /** Stop all speech (pause, stop, hidden tab). Returns cue to cancel, if any. */
  silence() {
    const cancel = this._activeCue;
    this._activeCue = null;
    return cancel;
  }

  _selectFormCue(formCandidates, t) {
    // Persistence: a form condition must stay active across frames for
    // persistFormMs before it qualifies. Track first-seen per cue id.
    const liveIds = new Set(formCandidates.map((c) => c.id));
    for (const [id, firstAt] of [...this._formFirstSeen.entries()]) {
      if (!liveIds.has(id)) this._formFirstSeen.delete(id);
    }
    const persistent = formCandidates
      .map((c) => {
        const first = this._formFirstSeen.get(c.id) ?? t;
        if (!this._formFirstSeen.has(c.id)) this._formFirstSeen.set(c.id, t);
        return { cue: c, first };
      })
      .filter(({ first }) => t - first >= this.g.persistFormMs);

    if (persistent.length === 0) return null;
    // One form cue at a time: stable selection by fixed priority order.
    persistent.sort((a, b) => a.cue.id.localeCompare(b.cue.id));
    return persistent[0].cue;
  }

  _canSpeak(cue, t) {
    // Cooldown per cue id.
    const cdUntil = this._cooldowns.get(cue.id);
    if (cdUntil && t < cdUntil) return false;

    // Minimum gap between ANY spoken cues.
    if (this._lastSpokenAt !== null && t - this._lastSpokenAt < this.g.minGapMs) {
      return false;
    }

    // Coaching cap (priority 2+3): at most 4 per rolling 60s.
    if (cue.priority === CUE_PRIORITY.tracking || cue.priority === CUE_PRIORITY.form) {
      const cutoff = t - 60000;
      this._coachingTimes = this._coachingTimes.filter((ts) => ts > cutoff);
      if (this._coachingTimes.length >= this.g.coachingPerMinute) return false;
      this._coachingTimes.push(t);
    }
    return true;
  }

  _record(cue, t) {
    this._lastSpokenAt = t;
    this._lastSpokenId = cue.id;
    this.cueCounts[cue.id] = (this.cueCounts[cue.id] ?? 0) + 1;
  }

  _takeActive(system, t) {
    const cancel = this._activeCue && this._activeCue.priority > system.priority
      ? this._activeCue
      : null;
    this._activeCue = { id: system.id, priority: system.priority, at: t };
    return cancel;
  }
}
