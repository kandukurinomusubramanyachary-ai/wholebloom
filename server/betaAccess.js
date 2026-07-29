const { getAdminFirestore } = require('./firebaseAdmin');

const WAITLIST_COLLECTION = 'bloom_waitlist';

function normalizeBetaEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidBetaEmail(value) {
  const email = normalizeBetaEmail(value);
  if (!email || email.length > 254) return false;

  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== email.indexOf('@')) return false;

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (
    localPart.length > 64
    || domain.length > 253
    || localPart.startsWith('.')
    || localPart.endsWith('.')
    || localPart.includes('..')
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)
    || !domain.includes('.')
  ) {
    return false;
  }

  return domain.split('.').every(
    (label) =>
      label.length > 0
      && label.length <= 63
      && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

function getBetaFirestore() {
  return getAdminFirestore();
}

function createBetaEmailChecker({ getFirestoreDb = getBetaFirestore } = {}) {
  return async function checkBetaEmail(email) {
    const normalizedEmail = normalizeBetaEmail(email);
    if (!isValidBetaEmail(normalizedEmail)) {
      throw new TypeError('A valid normalized email is required.');
    }

    const snapshot = await getFirestoreDb()
      .collection(WAITLIST_COLLECTION)
      .where('email', '==', normalizedEmail)
      .limit(1)
      .select('email')
      .get();

    return !snapshot.empty;
  };
}

const checkBetaEmail = createBetaEmailChecker();

module.exports = {
  WAITLIST_COLLECTION,
  normalizeBetaEmail,
  isValidBetaEmail,
  getBetaFirestore,
  createBetaEmailChecker,
  checkBetaEmail,
};
