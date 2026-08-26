import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { storage } from '../../../services/storage';
import { STRENGTH_DEFAULTS } from '../constants';

const { enqueueSummary, pruneOutbox } = require('./strengthOutbox');
const { serializeStrengthSummary } = require('../engine/strengthPrivacy');

function firestoreSummary(summary) {
  const safe = serializeStrengthSummary(summary);
  return {
    ...safe,
    startedAt: Timestamp.fromDate(new Date(safe.startedAt)),
    ...(safe.completedAt ? { completedAt: Timestamp.fromDate(new Date(safe.completedAt)) } : {}),
  };
}

async function upload(uid, summary) {
  if (!db || !uid) throw new Error('strength_cloud_unavailable');
  await setDoc(doc(db, 'users', uid, 'strengthSessions', summary.id), firestoreSummary(summary));
}

export async function flushStrengthOutbox(uid) {
  let queue = pruneOutbox(await storage.getStrengthOutbox(), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs);
  const remaining = [];
  for (const item of queue) {
    try {
      await upload(uid, item.summary);
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }
  await storage.setStrengthOutbox(remaining);
  return { uploaded: queue.length - remaining.length, remaining: remaining.length };
}

export async function saveStrengthSummary(uid, input) {
  const summary = serializeStrengthSummary(input);
  const current = pruneOutbox(await storage.getStrengthOutbox(), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs);
  await storage.setStrengthOutbox(enqueueSummary(current, summary));
  try {
    await upload(uid, summary);
    const latest = pruneOutbox(await storage.getStrengthOutbox(), Date.now(), STRENGTH_DEFAULTS.outboxMaxAgeMs)
      .filter((item) => item.summary.id !== summary.id);
    await storage.setStrengthOutbox(latest);
    return { summary, synced: true };
  } catch {
    return { summary, synced: false };
  }
}
