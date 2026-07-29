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
    answers: {
      cycleSupport: true,
    },
    consent: true,
    interestScore: 3,
    interestLevel: 'high',
    source: 'landing_page',
    createdAt: serverTimestamp(),
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

test('an owner can read and write their profile and nested documents', async () => {
  const ownerDb = testEnvironment.authenticatedContext('user-a').firestore();
  const profile = doc(ownerDb, 'users/user-a');
  const cycleLog = doc(ownerDb, 'users/user-a/cycleLogs/2026-07-27');

  await assertSucceeds(setDoc(profile, { firstName: 'Asha' }));
  await assertSucceeds(getDoc(profile));
  await assertSucceeds(setDoc(cycleLog, { date: '2026-07-27', flow: 'light' }));
  await assertSucceeds(getDoc(cycleLog));
});

test('one authenticated user cannot read or write another user’s data', async () => {
  const userADb = testEnvironment.authenticatedContext('user-a').firestore();

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/user-b'), { firstName: 'Bela' });
    await setDoc(
      doc(context.firestore(), 'users/user-b/checkIns/2026-07-27'),
      { date: '2026-07-27' }
    );
  });

  await assertFails(getDoc(doc(userADb, 'users/user-b')));
  await assertFails(setDoc(doc(userADb, 'users/user-b'), { firstName: 'Changed' }));
  await assertFails(getDoc(doc(userADb, 'users/user-b/checkIns/2026-07-27')));
  await assertFails(
    setDoc(
      doc(userADb, 'users/user-b/checkIns/2026-07-27'),
      { date: '2026-07-28' }
    )
  );
});

test('an unauthenticated client cannot read or write user data', async () => {
  const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/user-a'), { firstName: 'Asha' });
  });

  await assertFails(getDoc(doc(unauthenticatedDb, 'users/user-a')));
  await assertFails(
    setDoc(doc(unauthenticatedDb, 'users/user-a'), { firstName: 'Anonymous' })
  );
  await assertFails(
    setDoc(
      doc(unauthenticatedDb, 'users/user-a/checkIns/2026-07-27'),
      { date: '2026-07-27' }
    )
  );
});

test('the public landing page can create a valid waitlist record', async () => {
  const publicDb = testEnvironment.unauthenticatedContext().firestore();

  await assertSucceeds(
    setDoc(doc(publicDb, 'bloom_waitlist/valid-entry'), validWaitlistEntry())
  );
});

test('invalid waitlist creates are denied', async () => {
  const publicDb = testEnvironment.unauthenticatedContext().firestore();

  await assertFails(
    setDoc(doc(publicDb, 'bloom_waitlist/missing-consent'), {
      ...validWaitlistEntry(),
      consent: false,
    })
  );
  await assertFails(
    setDoc(doc(publicDb, 'bloom_waitlist/extra-field'), {
      ...validWaitlistEntry(),
      unexpected: true,
    })
  );
});

test('waitlist records cannot be read, updated, or deleted by clients', async () => {
  const publicDb = testEnvironment.unauthenticatedContext().firestore();
  const signedInDb = testEnvironment.authenticatedContext('user-a').firestore();
  const publicReference = doc(publicDb, 'bloom_waitlist/existing-entry');
  const signedInReference = doc(signedInDb, 'bloom_waitlist/existing-entry');

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), 'bloom_waitlist/existing-entry'),
      {
        ...validWaitlistEntry(),
        createdAt: new Date('2026-07-27T00:00:00.000Z'),
      }
    );
  });

  await assertFails(getDoc(publicReference));
  await assertFails(getDoc(signedInReference));
  await assertFails(updateDoc(publicReference, { firstName: 'Changed' }));
  await assertFails(updateDoc(signedInReference, { firstName: 'Changed' }));
  await assertFails(deleteDoc(publicReference));
  await assertFails(deleteDoc(signedInReference));
});
