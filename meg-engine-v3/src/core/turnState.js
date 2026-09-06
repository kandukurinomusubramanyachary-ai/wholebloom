class TurnInputError extends Error {
  constructor(code, details = null) {
    super(code);
    this.name = 'TurnInputError';
    this.code = code;
    this.details = details;
  }
}

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function createTurnState(input = {}) {
  const message = cleanString(input.message, 8000);
  const userId = cleanString(input.userId, 256);
  const conversationId = cleanString(input.conversationId, 256);
  const messageId = cleanString(input.messageId, 256) || null;

  if (!userId) throw new TurnInputError('user_id_required');
  if (!conversationId) throw new TurnInputError('conversation_id_required');
  if (!message) throw new TurnInputError('message_required');

  return {
    version: 'meg-v3',
    request: {
      userId,
      conversationId,
      messageId,
      message,
      mode: cleanString(input.mode, 40) || 'auto',
      supportMode: cleanString(input.supportMode, 40) || null,
      language: cleanString(input.language, 20) || 'en',
    },
    context: input.context && typeof input.context === 'object' && !Array.isArray(input.context)
      ? input.context
      : {},
    history: Array.isArray(input.history) ? input.history.slice(-12) : [],
    understanding: {
      safety: null,
      intent: null,
      complexity: null,
      confidence: null,
      route: null,
      reasons: [],
    },
    evidence: [],
    memories: [],
    plan: null,
    response: {
      text: '',
      provider: null,
      guarded: false,
    },
    trace: {
      startedAt: Date.now(),
      stages: [],
      warnings: [],
    },
  };
}

module.exports = { createTurnState, TurnInputError, cleanString };
