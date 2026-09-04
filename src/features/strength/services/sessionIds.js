/**
 * Bloom Strength — opaque session id factory.
 *
 * Platform-agnostic. Production uses crypto.randomUUID when available, else a
 * collision-resistant random fallback (Web Crypto getRandomValues). Tests
 * inject a deterministic factory (e.g. a counter), so ids remain reproducible.
 *
 * The id is the idempotent local/cloud identity for a Strength session; it
 * never encodes pose, media or health data.
 */

/** Production opaque id: `ss_<uuid>` with a safe fallback. */
export function createSessionId() {
  const g = globalThis;
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return `ss_${g.crypto.randomUUID()}`;
  }
  return `ss_${randomHex(16)}`;
}

/** Bounded factory for injection: returns a deterministic or random closure. */
export function createIdFactory(kind = 'random') {
  if (kind === 'counter') {
    let n = 0;
    return (exerciseId) => `ss_${exerciseId}_${(n++).toString(36)}`;
  }
  return (exerciseId) => {
    const base = createSessionId();
    return exerciseId ? `${base}_${exerciseId}` : base;
  };
}

function randomHex(byteCount) {
  const g = globalThis;
  const bytes = new Uint8Array(byteCount);
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteCount; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
