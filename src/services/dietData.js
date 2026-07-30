import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, firebaseConfigurationError } from './firebase';
import { stripUndefined } from './userData';

const BATCH_LIMIT = 450;

function requireCurrentUser(expectedUid = null) {
  if (firebaseConfigurationError || !auth || !db) {
    throw new Error('Bloom account storage is not available on this build.');
  }
  const user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) {
    throw new Error('Please sign in before syncing Diet data.');
  }
  return user;
}

function requireDocumentId(value, label = 'Diet record ID') {
  const id = String(value || '').trim();
  if (!id || id.length > 160 || id.includes('/')) {
    throw new Error(`A valid ${label} is required.`);
  }
  return id;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function timestampToIso(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return value;
}

function materialise(value) {
  if (Array.isArray(value)) return value.map(materialise);
  if (!isPlainObject(value)) return timestampToIso(value);
  return Object.entries(value).reduce((result, [key, item]) => {
    result[key] = materialise(item);
    return result;
  }, {});
}

function recordTime(value) {
  const parsed = Date.parse(
    value?.updatedAt
    || value?.recordedAt
    || value?.createdAt
    || value?.reflection?.recordedAt
    || ''
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMeaningfulProfile(value) {
  return Boolean(value && typeof value === 'object' && Object.keys(value).length);
}

function preparePayload(value) {
  const payload = { ...(value || {}) };
  delete payload.createdAt;
  delete payload.updatedAt;
  return stripUndefined(payload);
}

async function setWithTimestamps(reference, value) {
  const existing = await getDoc(reference);
  await setDoc(reference, {
    ...preparePayload(value),
    updatedAt: serverTimestamp(),
    ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
  }, { merge: true });
}

function userDietCollection(uid, name) {
  return collection(db, 'users', uid, name);
}

function userDietDocument(uid, name, id) {
  return doc(db, 'users', uid, name, requireDocumentId(id));
}

export function mergeDietRecords(localRecords = [], remoteRecords = []) {
  const records = new Map();

  (Array.isArray(localRecords) ? localRecords : []).forEach((record) => {
    if (!record?.id) return;
    records.set(String(record.id), record);
  });

  (Array.isArray(remoteRecords) ? remoteRecords : []).forEach((record) => {
    if (!record?.id) return;
    const id = String(record.id);
    const local = records.get(id);
    if (!local || recordTime(record) > recordTime(local)) records.set(id, record);
  });

  return [...records.values()].sort((left, right) => (
    String(left.date || left.updatedAt || '').localeCompare(
      String(right.date || right.updatedAt || '')
    )
  ));
}

export function mergeDietProfile(localProfile = null, remoteProfile = null) {
  if (!hasMeaningfulProfile(remoteProfile)) return localProfile || null;
  if (!hasMeaningfulProfile(localProfile)) return remoteProfile;
  if (!recordTime(localProfile)) return localProfile;
  return recordTime(remoteProfile) > recordTime(localProfile) ? remoteProfile : localProfile;
}

export function applyDietReflections(meals = [], reflections = []) {
  const reflectionByMeal = new Map();
  (Array.isArray(reflections) ? reflections : []).forEach((reflection) => {
    const mealId = String(reflection?.mealLogId || reflection?.mealId || '').trim();
    if (!mealId) return;
    const current = reflectionByMeal.get(mealId);
    if (!current || recordTime(reflection) > recordTime(current)) {
      reflectionByMeal.set(mealId, reflection);
    }
  });

  return (Array.isArray(meals) ? meals : []).map((meal) => {
    const remoteReflection = reflectionByMeal.get(String(meal?.id || ''));
    if (!remoteReflection) return meal;
    const existingTime = recordTime({
      updatedAt: meal?.reflection?.recordedAt || meal?.reflectionUpdatedAt,
    });
    if (existingTime > recordTime(remoteReflection)) return meal;
    const outcome = remoteReflection.outcome
      || (Array.isArray(remoteReflection.outcomes) ? remoteReflection.outcomes[0] : null);
    if (!outcome) return meal;
    return {
      ...meal,
      reflection: {
        ...(isPlainObject(meal.reflection) ? meal.reflection : {}),
        outcome,
        recordedAt: remoteReflection.recordedAt
          || remoteReflection.updatedAt
          || remoteReflection.createdAt
          || null,
      },
    };
  });
}

export async function loadCurrentUserDietData(expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  const [profileSnapshot, mealsSnapshot, reflectionsSnapshot, observationsSnapshot] =
    await Promise.all([
      getDoc(doc(db, 'users', uid, 'dietProfile', 'main')),
      getDocs(userDietCollection(uid, 'mealLogs')),
      getDocs(userDietCollection(uid, 'mealReflections')),
      getDocs(userDietCollection(uid, 'dietObservations')),
    ]);

  const fromSnapshot = (snapshot) => snapshot.docs.map((item) => ({
    ...materialise(item.data()),
    id: materialise(item.data()).id || item.id,
  }));

  return {
    profile: profileSnapshot.exists() ? materialise(profileSnapshot.data()) : null,
    meals: fromSnapshot(mealsSnapshot),
    reflections: fromSnapshot(reflectionsSnapshot),
    observations: fromSnapshot(observationsSnapshot),
  };
}

export async function saveCurrentUserDietProfile(profile, expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  const reference = doc(db, 'users', uid, 'dietProfile', 'main');
  await setWithTimestamps(reference, profile);
}

function reflectionFromMeal(meal) {
  const reflection = isPlainObject(meal?.reflection) ? meal.reflection : null;
  const outcome = reflection?.outcome || meal?.afterMealReflection || meal?.reflectionOutcome;
  if (!outcome || !meal?.id) return null;
  return {
    id: `reflection-${meal.id}`,
    mealId: String(meal.id),
    mealLogId: String(meal.id),
    outcome: String(outcome),
    outcomes: [String(outcome)],
    recordedAt: reflection?.recordedAt || meal?.reflectionUpdatedAt || meal?.updatedAt || null,
  };
}

export async function saveCurrentUserMeal(meal, expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  const mealId = requireDocumentId(meal?.id, 'meal ID');
  await setWithTimestamps(userDietDocument(uid, 'mealLogs', mealId), {
    ...meal,
    id: mealId,
  });

  const reflection = reflectionFromMeal(meal);
  if (reflection) await saveCurrentUserMealReflection(reflection, uid);
}

export async function deleteCurrentUserMeal(mealId, expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  const id = requireDocumentId(mealId, 'meal ID');
  const batch = writeBatch(db);
  batch.delete(userDietDocument(uid, 'mealLogs', id));
  batch.delete(userDietDocument(uid, 'mealReflections', id));
  await batch.commit();
}

export async function saveCurrentUserMealReflection(reflection, expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  const mealId = requireDocumentId(
    reflection?.mealLogId || reflection?.mealId,
    'meal reflection ID'
  );
  await setWithTimestamps(userDietDocument(uid, 'mealReflections', mealId), {
    ...reflection,
    id: reflection?.id || `reflection-${mealId}`,
    mealId,
    mealLogId: mealId,
  });
}

export async function saveCurrentUserDietObservation(observation, expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  const id = requireDocumentId(observation?.id, 'Diet observation ID');
  await setWithTimestamps(userDietDocument(uid, 'dietObservations', id), {
    ...observation,
    id,
    isCausal: false,
  });
}

export async function syncCurrentUserDietSnapshot(
  { profile = null, meals = [], observations = [] } = {},
  expectedUid = null
) {
  const operations = [];
  if (hasMeaningfulProfile(profile)) {
    operations.push(saveCurrentUserDietProfile(profile, expectedUid));
  }
  (Array.isArray(meals) ? meals : []).forEach((meal) => {
    if (meal?.id) operations.push(saveCurrentUserMeal(meal, expectedUid));
  });
  (Array.isArray(observations) ? observations : []).forEach((observation) => {
    if (observation?.id) operations.push(saveCurrentUserDietObservation(observation, expectedUid));
  });
  await Promise.allSettled(operations);
}

async function deleteReferences(references) {
  for (let index = 0; index < references.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    references.slice(index, index + BATCH_LIMIT).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export async function deleteAllCurrentUserDietData(expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  const snapshots = await Promise.all([
    getDocs(userDietCollection(uid, 'dietProfile')),
    getDocs(userDietCollection(uid, 'mealLogs')),
    getDocs(userDietCollection(uid, 'mealReflections')),
    getDocs(userDietCollection(uid, 'dietObservations')),
  ]);
  await deleteReferences(
    snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.ref))
  );
}

export async function deleteCurrentUserDietObservation(observationId, expectedUid = null) {
  const { uid } = requireCurrentUser(expectedUid);
  await deleteDoc(userDietDocument(uid, 'dietObservations', observationId));
}
