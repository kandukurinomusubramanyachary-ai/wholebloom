const { verifyFirebaseIdToken } = require('./firebaseAdmin');
const { MEG_QA_FAILURE_CATEGORY } = require('./megQaTiming');
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
    const timing = request.megQaTiming;
    const authStartedAt = timing?.mark();
    const token = bearerTokenFromHeader(request.get('authorization'));
    if (!token) {
      timing?.recordDuration('server_auth_ms', authStartedAt);
      timing?.setFailure(MEG_QA_FAILURE_CATEGORY.AUTH);
      return response.status(401).json(AUTHENTICATION_ERROR);
    }

    try {
      const decodedToken = await verifyIdToken(token);
      const uid = typeof decodedToken?.uid === 'string' ? decodedToken.uid.trim() : '';
      if (!uid) throw new Error('verified token did not contain a UID');
      request.auth = { uid };
      timing?.recordDuration('server_auth_ms', authStartedAt);
      return next();
    } catch (error) {
      timing?.recordDuration('server_auth_ms', authStartedAt);
      timing?.setFailure(MEG_QA_FAILURE_CATEGORY.AUTH);
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
