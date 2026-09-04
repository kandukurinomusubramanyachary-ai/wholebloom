import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { StrengthOutbox, serializeSessionSummary } from './index.js';

const adapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

function requireUid(uid) {
  const clean = String(uid || '').trim();
  if (!clean) throw new Error('Strength requires a signed-in Bloom account.');
  return clean;
}

function timestampMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.toDate === 'function') return value.toDate().getTime();
  return null;
}

export function strengthSummaryToFirestore(input) {
  const safe = serializeSessionSummary(input);
  return {
    ...safe,
    startedAt: Timestamp.fromMillis(safe.startedAt),
    completedAt: Timestamp.fromMillis(safe.completedAt),
  };
}

export function firestoreStrengthToSummary(data = {}) {
  const startedAt = timestampMillis(data.startedAt);
  const completedAt = timestampMillis(data.completedAt);
  if (startedAt === null || completedAt === null) return null;
  try {
    return serializeSessionSummary({ ...data, startedAt, completedAt });
  } catch {
    return null;
  }
}

async function syncStrengthSummary({ uid, summary }) {
  const ownerUid = requireUid(uid);
  if (!db) throw new Error('Bloom cloud storage is unavailable on this build.');
  const safe = serializeSessionSummary(summary);
  await setDoc(
    doc(db, 'users', ownerUid, 'strengthSessions', safe.id),
    strengthSummaryToFirestore(safe),
    { merge: false }
  );
}

export function createBloomStrengthOutbox(uid, options = {}) {
  const ownerUid = requireUid(uid);
  return new StrengthOutbox({
    getUid: () => ownerUid,
    adapter,
    syncFn: options.sync === false ? null : syncStrengthSummary,
    immediateSync: options.immediateSync !== false,
    now: options.now || (() => Date.now()),
  });
}

export async function flushBloomStrengthOutbox(uid) {
  return createBloomStrengthOutbox(uid).flush(requireUid(uid));
}

export async function loadBloomStrengthSessions(uid, { includeCloud = true } = {}) {
  const ownerUid = requireUid(uid);
  const outbox = createBloomStrengthOutbox(ownerUid, { sync: false });
  const local = await outbox.listSessions();
  if (!includeCloud || !db) return local;

  try {
    const snapshot = await getDocs(collection(db, 'users', ownerUid, 'strengthSessions'));
    const remote = snapshot.docs
      .map((item) => firestoreStrengthToSummary(item.data()))
      .filter(Boolean);
    const merged = new Map();
    remote.forEach((summary) => merged.set(summary.id, summary));
    local.forEach((summary) => merged.set(summary.id, summary));
    return [...merged.values()].sort((a, b) => b.completedAt - a.completedAt);
  } catch {
    return local;
  }
}

export async function deleteLocalStrengthData(uid) {
  const ownerUid = requireUid(uid);
  return createBloomStrengthOutbox(ownerUid, { sync: false }).deleteUserData(ownerUid);
}
