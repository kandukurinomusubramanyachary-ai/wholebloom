import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, firebaseConfigurationError } from './firebase';
import { requireLocalDateKey } from '../utils/dateKey';

function requireFirebase() {
  if (firebaseConfigurationError || !auth || !db) {
    throw new Error('Bloom account storage is not available on this build.');
  }
}

function requireCurrentUser() {
  requireFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in before saving to Bloom.');
  return user;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item));
  }

  if (!isPlainObject(value)) return value;

  return Object.entries(value).reduce((result, [key, item]) => {
    if (item !== undefined) result[key] = stripUndefined(item);
    return result;
  }, {});
}

function timestampToIso(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return value;
}

function materialiseDocument(value) {
  if (Array.isArray(value)) return value.map(materialiseDocument);
  if (!isPlainObject(value)) return timestampToIso(value);
  return Object.entries(value).reduce((result, [key, item]) => {
    result[key] = materialiseDocument(item);
    return result;
  }, {});
}

function userDocument(uid) {
  return doc(db, 'users', uid);
}

function userCollection(uid, name) {
  return collection(db, 'users', uid, name);
}

export async function loadCurrentUserData() {
  const { uid } = requireCurrentUser();
  const [profileSnapshot, periodSnapshot, checkinSnapshot] = await Promise.all([
    getDoc(userDocument(uid)),
    getDocs(userCollection(uid, 'cycleLogs')),
    getDocs(userCollection(uid, 'checkIns')),
  ]);

  const remoteProfile = profileSnapshot.exists()
    ? materialiseDocument(profileSnapshot.data())
    : null;
  const profile = remoteProfile
    ? {
        ...remoteProfile,
        name: remoteProfile.name || remoteProfile.firstName || '',
      }
    : null;
  const periods = periodSnapshot.docs
    .map((snapshot) => {
      const value = materialiseDocument(snapshot.data());
      return {
        ...value,
        id: value.id || `period-${snapshot.id}`,
        startDate: value.startDate || snapshot.id,
      };
    })
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const checkins = checkinSnapshot.docs
    .map((snapshot) => {
      const value = materialiseDocument(snapshot.data());
      return {
        ...value,
        id: value.id || snapshot.id,
        date: value.date || snapshot.id,
      };
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return { profile, periods, checkins };
}

export async function saveCurrentUserProfile(profile) {
  const { uid } = requireCurrentUser();
  const {
    name,
    createdAt: ignoredCreatedAt,
    updatedAt: ignoredUpdatedAt,
    lastActiveAt: ignoredLastActiveAt,
    ...rest
  } = profile || {};
  const firstName = String(name ?? rest.firstName ?? '').trim();
  const payload = stripUndefined({
    ...rest,
    firstName,
    updatedAt: serverTimestamp(),
  });
  await setDoc(userDocument(uid), payload, { merge: true });
  return { ...profile, firstName, name: firstName };
}

async function saveDatedRecord(collectionName, date, value) {
  const { uid } = requireCurrentUser();
  const key = requireLocalDateKey(date);
  const reference = doc(db, 'users', uid, collectionName, key);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    const record = { ...(value || {}) };
    delete record.createdAt;
    const payload = stripUndefined({
      ...record,
      updatedAt: serverTimestamp(),
      ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
    });
    transaction.set(reference, payload, { merge: true });
  });

  return { ...value, updatedAt: new Date().toISOString() };
}

export async function saveCurrentUserPeriod(period, previousStartDate = null) {
  const { uid } = requireCurrentUser();
  const startDate = requireLocalDateKey(period?.startDate, 'period start date');
  const previousKey = previousStartDate
    ? requireLocalDateKey(previousStartDate, 'previous period start date')
    : startDate;
  const reference = doc(db, 'users', uid, 'cycleLogs', startDate);
  const previousReference = doc(db, 'users', uid, 'cycleLogs', previousKey);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    const previous = previousKey === startDate
      ? existing
      : await transaction.get(previousReference);
    const record = { ...(period || {}) };
    delete record.createdAt;
    delete record.updatedAt;
    if (
      previousKey !== startDate
      && existing.exists()
      && existing.data()?.id !== record.id
    ) {
      const conflict = new Error('A period is already logged for this start date.');
      conflict.code = 'period-date-conflict';
      throw conflict;
    }
    const preservedCreatedAt = !existing.exists() && previous.exists()
      ? previous.data().createdAt
      : undefined;
    const payload = stripUndefined({
      ...record,
      date: startDate,
      startDate,
      updatedAt: serverTimestamp(),
      ...(!existing.exists()
        ? { createdAt: preservedCreatedAt || serverTimestamp() }
        : {}),
    });

    transaction.set(reference, payload, { merge: true });
    if (previousKey !== startDate) transaction.delete(previousReference);
  });

  return {
    ...period,
    date: startDate,
    startDate,
    updatedAt: new Date().toISOString(),
  };
}

export function saveCurrentUserCheckin(checkin) {
  const date = requireLocalDateKey(checkin?.date, 'check-in date');
  return saveDatedRecord('checkIns', date, { ...checkin, date });
}

async function deleteDatedRecord(collectionName, date) {
  const { uid } = requireCurrentUser();
  const key = requireLocalDateKey(date);
  await deleteDoc(doc(db, 'users', uid, collectionName, key));
}

export function deleteCurrentUserPeriod(startDate) {
  return deleteDatedRecord('cycleLogs', startDate);
}

export function deleteCurrentUserCheckin(date) {
  return deleteDatedRecord('checkIns', date);
}

export async function deleteAllCurrentUserTrackingData() {
  const { uid } = requireCurrentUser();
  const snapshots = await Promise.all([
    getDocs(userCollection(uid, 'cycleLogs')),
    getDocs(userCollection(uid, 'checkIns')),
  ]);
  const references = snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.ref));

  for (let index = 0; index < references.length; index += 450) {
    const batch = writeBatch(db);
    references.slice(index, index + 450).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}
