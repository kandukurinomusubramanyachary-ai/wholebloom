const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { after, before, beforeEach } = test;

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-bloom-auth';
const RULES_PATH = path.join(__dirname, '..', 'firestore.rules');

let testEnvironment;

function firestoreEmulatorAddress() {
  const value = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const separator = value.lastIndexOf(':');
  const host = value.slice(0, separator);
  const port = Number(value.slice(separator + 1));

  if (!host || !Number.isInteger(port)) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be in host:port format.');
  }

  return { host, port };
}

function validWaitlistEntry() {
  return {
    firstName: 'Asha',
    email: 'asha@example.com',
    optionalContact: '',
    answers: { cycleSupport: true },
    consent: true,
    interestScore: 3,
    interestLevel: 'high',
    source: 'landing_page',
    createdAt: serverTimestamp(),
  };
}

function validCycleLog(overrides = {}) {
  return {
    id: 'period-2026-07-27',
    date: '2026-07-27',
    startDate: '2026-07-27',
    endDate: '2026-07-31',
    flow: 'light',
    source: 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function validCheckIn(overrides = {}) {
  return {
    id: '2026-07-27',
    date: '2026-07-27',
    flow: 'light',
    symptoms: ['cramps'],
    symptomSeverity: { cramps: 'mild' },
    mood: 'calm',
    energy: 5,
    notes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function validDietProfile(overrides = {}) {
  return {
    eatingPreference: 'vegetarian',
    allergies: [],
    intolerances: [],
    dislikedFoods: [],
    religiousExclusions: [],
    culturalExclusions: [],
    cookingSetup: 'hostel_basic',
    timeAvailable: 'under_15_minutes',
    budget: 'low_cost',
    goals: ['steadier_energy'],
    recentIngredients: ['rice'],
    favouriteIngredients: ['dal'],
    savedSuggestions: [],
    dismissedObservationIds: [],
    deletedMealIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function validMealLog(id = 'meal-1', overrides = {}) {
  return {
    id,
    mealId: id,
    date: '2026-07-27',
    name: 'Rice and dal',
    ingredients: ['Rice', 'Dal'],
    source: 'diet_suggestion',
    symptoms: [],
    notes: '',
    creationPlatform: 'android',
    schemaVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function validMealReflection(mealId = 'meal-1', overrides = {}) {
  return {
    id: `reflection-${mealId}`,
    mealId,
    mealLogId: mealId,
    outcome: 'steady_energy',
    outcomes: ['steady_energy'],
    recordedAt: '2026-07-27T12:00:00.000Z',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function validDietObservation(id = 'diet-observation-steady', overrides = {}) {
  return {
    id,
    text: 'A descriptive pattern based on five reflected meals.',
    status: 'observation_available',
    sampleSize: 5,
    minimumSampleSize: 5,
    matchingCount: 4,
    sourceMealIds: ['meal-1', 'meal-2', 'meal-3', 'meal-4', 'meal-5'],
    isCausal: false,
    dismissed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

before(async () => {
  const { host, port } = firestoreEmulatorAddress();
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

after(async () => {
  await testEnvironment?.cleanup();
});

test('an owner can read and write their profile, period, check-in and Diet documents', async () => {
  const ownerDb = testEnvironment.authenticatedContext('user-a').firestore();
  const references = [
    [doc(ownerDb, 'users/user-a'), { firstName: 'Asha' }],
    [doc(ownerDb, 'users/user-a/cycleLogs/2026-07-27'), validCycleLog()],
    [doc(ownerDb, 'users/user-a/checkIns/2026-07-27'), validCheckIn()],
    [doc(ownerDb, 'users/user-a/dietProfile/main'), validDietProfile()],
    [doc(ownerDb, 'users/user-a/mealLogs/meal-1'), validMealLog()],
    [doc(ownerDb, 'users/user-a/mealReflections/meal-1'), validMealReflection()],
    [
      doc(ownerDb, 'users/user-a/dietObservations/diet-observation-steady'),
      validDietObservation(),
    ],
  ];

  for (const [reference, value] of references) {
    await assertSucceeds(setDoc(reference, value));
    await assertSucceeds(getDoc(reference));
  }
});

test('one authenticated user cannot read or write another user\'s period or Diet data', async () => {
  const userADb = testEnvironment.authenticatedContext('user-a').firestore();

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/user-b'), { firstName: 'Bela' });
    await setDoc(
      doc(context.firestore(), 'users/user-b/cycleLogs/2026-07-27'),
      { date: '2026-07-27' }
    );
    await setDoc(
      doc(context.firestore(), 'users/user-b/mealLogs/meal-1'),
      { id: 'meal-1', date: '2026-07-27', name: 'Private meal' }
    );
  });

  await assertFails(getDoc(doc(userADb, 'users/user-b')));
  await assertFails(getDoc(doc(userADb, 'users/user-b/cycleLogs/2026-07-27')));
  await assertFails(getDoc(doc(userADb, 'users/user-b/mealLogs/meal-1')));
  await assertFails(setDoc(
    doc(userADb, 'users/user-b/cycleLogs/2026-07-27'),
    validCycleLog()
  ));
  await assertFails(setDoc(
    doc(userADb, 'users/user-b/mealLogs/meal-1'),
    validMealLog()
  ));
});

test('an unauthenticated client cannot read or write user period, check-in or Diet data', async () => {
  const publicDb = testEnvironment.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(publicDb, 'users/user-a')));
  await assertFails(setDoc(
    doc(publicDb, 'users/user-a/cycleLogs/2026-07-27'),
    validCycleLog()
  ));
  await assertFails(setDoc(
    doc(publicDb, 'users/user-a/checkIns/2026-07-27'),
    validCheckIn()
  ));
  await assertFails(setDoc(
    doc(publicDb, 'users/user-a/dietProfile/main'),
    validDietProfile()
  ));
  await assertFails(setDoc(
    doc(publicDb, 'users/user-a/mealLogs/meal-1'),
    validMealLog()
  ));
});

test('strict period, check-in and Diet schemas reject extra, oversized and invalid fields', async () => {
  const ownerDb = testEnvironment.authenticatedContext('user-a').firestore();

  await assertFails(setDoc(
    doc(ownerDb, 'users/user-a/cycleLogs/2026-07-27'),
    validCycleLog({ unexpected: true })
  ));
  await assertFails(setDoc(
    doc(ownerDb, 'users/user-a/checkIns/2026-07-27'),
    validCheckIn({ notes: 'x'.repeat(4001) })
  ));
  await assertFails(setDoc(
    doc(ownerDb, 'users/user-a/dietProfile/main'),
    validDietProfile({ allergies: Array.from({ length: 31 }, (_, index) => `item-${index}`) })
  ));
  await assertFails(setDoc(
    doc(ownerDb, 'users/user-a/mealLogs/meal-1'),
    validMealLog('meal-1', { date: 20260727 })
  ));
  await assertFails(setDoc(
    doc(ownerDb, 'users/user-a/mealLogs/meal-1'),
    validMealLog('different-id')
  ));
  await assertFails(setDoc(
    doc(ownerDb, 'users/user-a/dietObservations/diet-observation-steady'),
    validDietObservation('diet-observation-steady', { isCausal: true })
  ));
});

test('an owner can delete their own period and Diet documents', async () => {
  const ownerDb = testEnvironment.authenticatedContext('user-a').firestore();
  const references = [
    [doc(ownerDb, 'users/user-a/cycleLogs/2026-07-27'), validCycleLog()],
    [doc(ownerDb, 'users/user-a/dietProfile/main'), validDietProfile()],
    [doc(ownerDb, 'users/user-a/mealLogs/meal-1'), validMealLog()],
    [doc(ownerDb, 'users/user-a/mealReflections/meal-1'), validMealReflection()],
    [
      doc(ownerDb, 'users/user-a/dietObservations/diet-observation-steady'),
      validDietObservation(),
    ],
  ];

  for (const [reference, value] of references) {
    await assertSucceeds(setDoc(reference, value));
    await assertSucceeds(deleteDoc(reference));
  }
});

test('the public landing page can create a valid waitlist record', async () => {
  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  await assertSucceeds(
    setDoc(doc(publicDb, 'bloom_waitlist/valid-entry'), validWaitlistEntry())
  );
});

test('invalid waitlist creates are denied', async () => {
  const publicDb = testEnvironment.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(publicDb, 'bloom_waitlist/missing-consent'), {
    ...validWaitlistEntry(),
    consent: false,
  }));
  await assertFails(setDoc(doc(publicDb, 'bloom_waitlist/extra-field'), {
    ...validWaitlistEntry(),
    unexpected: true,
  }));
});

test('waitlist records cannot be read, updated, or deleted by clients', async () => {
  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  const signedInDb = testEnvironment.authenticatedContext('user-a').firestore();
  const publicReference = doc(publicDb, 'bloom_waitlist/existing-entry');
  const signedInReference = doc(signedInDb, 'bloom_waitlist/existing-entry');

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bloom_waitlist/existing-entry'), {
      ...validWaitlistEntry(),
      createdAt: new Date('2026-07-27T00:00:00.000Z'),
    });
  });

  await assertFails(getDoc(publicReference));
  await assertFails(getDoc(signedInReference));
  await assertFails(updateDoc(publicReference, { firstName: 'Changed' }));
  await assertFails(updateDoc(signedInReference, { firstName: 'Changed' }));
  await assertFails(deleteDoc(publicReference));
  await assertFails(deleteDoc(signedInReference));
});
