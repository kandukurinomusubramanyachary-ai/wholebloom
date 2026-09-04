const { verifyFirebaseIdToken } = require('./firebaseAdmin');
const { safeLogger } = require('./safeLogger');

const AUTHENTICATION_ERROR = Object.freeze({
  error: 'Authentication is required.',
});

function bearerTokenFromHeader(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^Bearer[ \t]+([^\s]+)$/i);
  return match ? match[1] : null;
}

function createRequireFirebaseAuth({
  verifyIdToken = verifyFirebaseIdToken,
  logger = safeLogger,
} = {}) {
  return async function requireFirebaseAuth(request, response, next) {
    const token = bearerTokenFromHeader(request.get('authorization'));

    // Local/preview-only dev token. Production always requires Firebase auth.
    if (
      process.env.MEG_DEV_AUTH === '1'
      && process.env.NODE_ENV !== 'production'
      && token === 'dev-token'
    ) {
      request.auth = { uid: 'dev-user' };
      return next();
    }
    if (!token) return response.status(401).json(AUTHENTICATION_ERROR);

    try {
      const decodedToken = await verifyIdToken(token);
      const uid = typeof decodedToken?.uid === 'string' ? decodedToken.uid.trim() : '';
      if (!uid) throw new Error('verified token did not contain a UID');
      request.auth = { uid };
      return next();
    } catch (error) {
      logger.warn('meg_auth_rejected', {
        code: error?.code || error?.name || 'invalid_token',
        status: 401,
      });
      return response.status(401).json(AUTHENTICATION_ERROR);
    }
  };
}

module.exports = {
  AUTHENTICATION_ERROR,
  bearerTokenFromHeader,
  createRequireFirebaseAuth,
};
