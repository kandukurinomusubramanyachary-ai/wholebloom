const {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const ADMIN_APP_NAME = 'bloom-server';

let firestoreConfigured = false;

function cleanEnvironmentValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeServiceAccount(encodedValue) {
  const encoded = cleanEnvironmentValue(encodedValue);
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(decoded);
    if (
      !serviceAccount
      || typeof serviceAccount !== 'object'
      || !cleanEnvironmentValue(serviceAccount.project_id)
      || !cleanEnvironmentValue(serviceAccount.client_email)
      || !cleanEnvironmentValue(serviceAccount.private_key)
    ) {
      throw new Error('missing required service-account fields');
    }
    return serviceAccount;
  } catch (_error) {
    const configurationError = new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON must be a base64-encoded Firebase service-account JSON object.'
    );
    configurationError.code = 'invalid_firebase_service_account';
    throw configurationError;
  }
}

function buildAdminOptions(environment = process.env) {
  const serviceAccount = decodeServiceAccount(environment.FIREBASE_SERVICE_ACCOUNT_JSON);
  const configuredProjectId = cleanEnvironmentValue(environment.FIREBASE_PROJECT_ID);
  const projectId = configuredProjectId || serviceAccount?.project_id || undefined;

  return {
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(projectId ? { projectId } : {}),
  };
}

function getFirebaseAdminApp({ environment = process.env } = {}) {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  return initializeApp(buildAdminOptions(environment), ADMIN_APP_NAME);
}

function getAdminFirestore() {
  const firestore = getFirestore(getFirebaseAdminApp());
  if (!firestoreConfigured) {
    firestore.settings({ ignoreUndefinedProperties: true });
    firestoreConfigured = true;
  }
  return firestore;
}

function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

async function verifyFirebaseIdToken(idToken) {
  return getAdminAuth().verifyIdToken(idToken);
}

module.exports = {
  ADMIN_APP_NAME,
  buildAdminOptions,
  decodeServiceAccount,
  getFirebaseAdminApp,
  getAdminFirestore,
  getAdminAuth,
  verifyFirebaseIdToken,
};
