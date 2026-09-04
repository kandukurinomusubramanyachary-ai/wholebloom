/**
 * Bloom Strength — local-first storage with UID-scoped outbox.
 *
 * Writes session summaries locally first, then retries UID-scoped Firestore
 * sync. Critical privacy/isolation rules (PRD §12, §14, AC-04/AC-11):
 *  - Only a serialized summary (strengthPrivacy.serializeSessionSummary) may
 *    enter the outbox — never frames, landmarks or raw geometry.
 *  - The outbox is keyed by owner UID. Logout/UID switch NEVER exposes one
 *    user's queued records to another UID; pending rows for a signed-out user
 *    become unreachable and are deleted on demand.
 *  - Network failure never erases a completed set: the summary stays local
 *    and the summary screen is not blocked.
 *  - Cloud sync is bound to the OWNER UID captured for each record, not the
 *    UID that happens to be current when an async flush completes
 *    (`syncFn({ uid, summary })`). This makes a mid-flush auth switch safe.
 *
 * The adapter is injected (AsyncStorage on native, localStorage on web, an
 * in-memory map in tests) so this module stays platform-agnostic.
 */

import { serializeSessionSummary } from './strengthPrivacy.js';

const STORAGE_PREFIX = 'bloom.strength.outbox.';
const LOCAL_SESSIONS_PREFIX = 'bloom.strength.sessions.';

export const SAVE_STATUS = Object.freeze({
  SAVED_LOCAL: 'saved-local',
  SYNCED: 'synced',
  SYNC_PENDING: 'sync-pending',
  SAVE_ERROR: 'save-error',
});

export class StrengthOutbox {
  /**
   * @param {object} args
   * @param {function(): (string|null)} args.getUid - current signed-in UID
   * @param {{ getItem(k):Promise<string|null>, setItem(k,v):Promise<void>, removeItem(k):Promise<void> }} args.adapter
   * @param {function({uid:string, summary:object}): Promise<void>} [args.syncFn]
   *        Cloud sync. Receives the OWNER UID (captured at enqueue time) plus
   *        the sanitized summary, so a flush never syncs under the wrong UID.
   * @param {function} [args.now]
   * @param {boolean} [args.immediateSync=true] best-effort sync inline on save
   */
  constructor({ getUid, adapter, syncFn = null, now = () => Date.now(), immediateSync = true }) {
    this.getUid = getUid;
    this.adapter = adapter;
    this.syncFn = syncFn;
    this.now = now;
    // When false, saveSession only enqueues locally; cloud sync happens on an
    // explicit flush() (used to exercise the UID-bound flush path deterministically).
    this.immediateSync = immediateSync;
  }

  _requireUid() {
    const uid = this.getUid();
    if (!uid) throw new Error('Cannot write Strength outbox without a signed-in UID');
    return uid;
  }

  _outboxKey(uid) {
    return `${STORAGE_PREFIX}${uid}`;
  }
  _sessionsKey(uid) {
    return `${LOCAL_SESSIONS_PREFIX}${uid}`;
  }

  async _readList(key) {
    const raw = await this.adapter.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async _writeList(key, list) {
    await this.adapter.setItem(key, JSON.stringify(list));
  }

  _invokeSync(uid, summary) {
    // The ONLY supported contract: syncFn({ uid, summary }) — cloud sync is
    // bound to the owner UID captured for the record.
    return this.syncFn({ uid, summary });
  }

  /**
   * Persist a completed/stopped/abandoned session. Validates and serializes
   * through the privacy schema BEFORE anything is stored.
   *
   * Distinguishes (item 9):
   *   - a true LOCAL failure (no UID, serialization/privacy, storage adapter)
   *     -> throws / status SAVE_ERROR (the caller must NOT claim "saved"),
   *   - a CLOUD/network failure -> local write succeeds, status SYNC_PENDING,
   *     syncError populated (summary screen is not blocked).
   *
   * @returns {Promise<{summary, status, syncError?}>}
   */
  async saveSession(input) {
    const uid = this._requireUid(); // throws on missing UID (true failure)
    // Serialization/privacy failure throws (true failure — never fake-saved).
    const summary = serializeSessionSummary(input);

    // Local sessions write. A storage-adapter failure is a TRUE local failure.
    const sessionsKey = this._sessionsKey(uid);
    const sessions = await this._readList(sessionsKey);
    const existing = sessions.findIndex((s) => s.summary.id === summary.id);
    const record = { summary, state: 'local', savedAt: this.now(), attempts: 0, ownerUid: uid };
    if (existing >= 0) sessions[existing] = { ...sessions[existing], summary, ownerUid: uid };
    else sessions.push(record);
    await this._writeList(sessionsKey, sessions); // throws -> propagates to caller

    // Outbox queue.
    const outboxKey = this._outboxKey(uid);
    const outbox = await this._readList(outboxKey);
    if (!outbox.some((s) => s.summary.id === summary.id)) {
      outbox.push({ summary, queuedAt: this.now(), attempts: 0, ownerUid: uid });
      await this._writeList(outboxKey, outbox);
    }

    // Best-effort immediate sync; cloud failures stay queued, never throw.
    if (this.syncFn && this.immediateSync) {
      try {
        await this._invokeSync(uid, summary);
        await this._markSynced(uid, summary.id);
        return { summary, status: SAVE_STATUS.SYNCED };
      } catch (err) {
        return { summary, status: SAVE_STATUS.SYNC_PENDING, syncError: err };
      }
    }
    return { summary, status: SAVE_STATUS.SAVED_LOCAL };
  }

  async _markSynced(uid, sessionId) {
    const outboxKey = this._outboxKey(uid);
    const outbox = await this._readList(outboxKey);
    const remaining = outbox.filter((s) => s.summary.id !== sessionId);
    await this._writeList(outboxKey, remaining);

    const sessionsKey = this._sessionsKey(uid);
    const sessions = await this._readList(sessionsKey);
    for (const rec of sessions) {
      if (rec.summary.id === sessionId) {
        rec.state = 'synced';
        rec.syncedAt = this.now();
      }
    }
    await this._writeList(sessionsKey, sessions);
  }

  /**
   * Retry queued records. The UID is CAPTURED at flush start (or passed
   * explicitly) so an auth switch during the await never reads/writes or
   * syncs under a different user. Each record is synced with its OWNER uid.
   * Successfully synced records are permanently removed; failures stay.
   */
  async flush(explicitUid = null) {
    const uid = explicitUid || this._requireUid();
    if (!this.syncFn) return { flushed: 0, failed: 0, syncedIds: [], uid };

    const outboxKey = this._outboxKey(uid);
    const sessionsKey = this._sessionsKey(uid);
    const queued = await this._readList(outboxKey);

    const failed = [];
    const synced = [];
    for (const item of queued) {
      // Bind to the record's owner (defense in depth: same uid in normal use).
      const ownerUid = item.ownerUid || uid;
      try {
        await this._invokeSync(ownerUid, item.summary);
        synced.push({ id: item.summary.id, uid: ownerUid });
      } catch (err) {
        failed.push({
          ...item,
          ownerUid,
          attempts: (item.attempts ?? 0) + 1,
          lastAttemptAt: this.now(),
          lastError: String(err?.message || err),
        });
      }
    }

    // One authoritative outbox write: only records that actually failed stay.
    await this._writeList(outboxKey, failed);

    const syncedIds = synced.map((s) => s.id);
    if (syncedIds.length > 0) {
      const sessions = await this._readList(sessionsKey);
      let changed = false;
      for (const rec of sessions) {
        if (syncedIds.includes(rec.summary.id) && rec.state !== 'synced') {
          rec.state = 'synced';
          rec.syncedAt = this.now();
          changed = true;
        }
      }
      if (changed) await this._writeList(sessionsKey, sessions);
    }

    return { flushed: syncedIds.length, failed: failed.length, syncedIds, synced, uid };
  }

  /** Read-only local session list for the current UID. */
  async listSessions() {
    const uid = this._requireUid();
    const sessions = await this._readList(this._sessionsKey(uid));
    return sessions.map((r) => r.summary);
  }

  /** Pending sync count for the current UID (drives "saved locally" copy). */
  async pendingCount() {
    const uid = this._requireUid();
    return (await this._readList(this._outboxKey(uid))).length;
  }

  /** Delete all Strength data for a UID (account deletion / data rights). */
  async deleteUserData(uid) {
    const target = uid || this._requireUid();
    await this.adapter.removeItem(this._sessionsKey(target));
    await this.adapter.removeItem(this._outboxKey(target));
  }

  /**
   * Called on logout. The previous UID's outbox is NEVER readable by the
   * next session; returns the signed-out UID's storage keys so the app can
   * delete them if the user chooses.
   */
  onLogout(previousUid) {
    if (!previousUid) return null;
    return {
      sessionsKey: this._sessionsKey(previousUid),
      outboxKey: this._outboxKey(previousUid),
    };
  }
}
