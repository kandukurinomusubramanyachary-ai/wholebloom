const { FieldValue } = require('firebase-admin/firestore');
const { getAdminFirestore } = require('./firebaseAdmin');

const USERS_COLLECTION = 'users';
const CONVERSATIONS_COLLECTION = 'megConversations';
const MESSAGES_COLLECTION = 'messages';
const MAX_DOCUMENT_ID_LENGTH = 500;

class MegPersistenceError extends Error {
  constructor(code, clientMessage, status = 503) {
    super(code);
    this.name = 'MegPersistenceError';
    this.code = code;
    this.clientMessage = clientMessage;
    this.status = status;
  }
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map(stripUndefined);
  }
  if (
    value
    && typeof value === 'object'
    && Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)])
    );
  }
  return value;
}

function cleanOptionalString(value, maxLength) {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  return clean.slice(0, maxLength);
}

function validateDocumentId(value, fieldName) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (
    !id
    || id.length > MAX_DOCUMENT_ID_LENGTH
    || id.includes('/')
    || id === '.'
    || id === '..'
    || /[\u0000-\u001f\u007f]/.test(id)
  ) {
    throw new MegPersistenceError(
      'invalid_document_id',
      `${fieldName} is invalid.`,
      400
    );
  }
  return id;
}

function createMegPersistence({ getFirestoreDb = getAdminFirestore } = {}) {
  function references(uid, conversationId, messageId) {
    const cleanUid = validateDocumentId(uid, 'Authenticated user');
    const cleanConversationId = validateDocumentId(conversationId, 'conversationId');
    const cleanMessageId = validateDocumentId(messageId, 'messageId');
    const assistantMessageId = validateDocumentId(
      `assistant-${cleanMessageId}`,
      'assistant message ID'
    );
    const conversationReference = getFirestoreDb()
      .collection(USERS_COLLECTION)
      .doc(cleanUid)
      .collection(CONVERSATIONS_COLLECTION)
      .doc(cleanConversationId);

    return {
      cleanConversationId,
      cleanMessageId,
      assistantMessageId,
      conversationReference,
      userMessageReference: conversationReference.collection(MESSAGES_COLLECTION).doc(cleanMessageId),
      assistantMessageReference: conversationReference
        .collection(MESSAGES_COLLECTION)
        .doc(assistantMessageId),
    };
  }

  async function persistUserMessage({
    uid,
    conversationId,
    messageId,
    text,
    mode,
    language,
  }) {
    const refs = references(uid, conversationId, messageId);
    const db = getFirestoreDb();
    const cleanMode = cleanOptionalString(mode, 64);
    const cleanLanguage = cleanOptionalString(language, 32);
    const cleanText = typeof text === 'string' ? text.trim() : '';

    return db.runTransaction(async (transaction) => {
      const [conversationSnapshot, userSnapshot, assistantSnapshot] =
        await transaction.getAll(
          refs.conversationReference,
          refs.userMessageReference,
          refs.assistantMessageReference
        );

      if (userSnapshot.exists && userSnapshot.data()?.text !== cleanText) {
        throw new MegPersistenceError(
          'message_id_conflict',
          'This message could not be sent safely. Please try again.',
          409
        );
      }

      if (assistantSnapshot.exists) {
        const savedText = assistantSnapshot.data()?.text;
        if (typeof savedText === 'string' && savedText.trim()) {
          return {
            completedAssistantText: savedText.trim(),
            conversationId: refs.cleanConversationId,
            assistantMessageId: refs.assistantMessageId,
            source: assistantSnapshot.data()?.source,
            safety: assistantSnapshot.data()?.safety,
            duplicate: true,
          };
        }
      }

      if (userSnapshot.exists) {
        return {
          completedAssistantText: null,
          conversationId: refs.cleanConversationId,
          assistantMessageId: refs.assistantMessageId,
          duplicate: true,
        };
      }

      const serverTime = FieldValue.serverTimestamp();
      transaction.set(
        refs.userMessageReference,
        stripUndefined({
          role: 'user',
          text: cleanText,
          createdAt: serverTime,
        })
      );

      if (conversationSnapshot.exists) {
        transaction.set(
          refs.conversationReference,
          stripUndefined({
            updatedAt: serverTime,
            lastMessageAt: serverTime,
            messageCount: FieldValue.increment(1),
            mode: cleanMode,
            language: cleanLanguage,
          }),
          { merge: true }
        );
      } else {
        transaction.set(
          refs.conversationReference,
          stripUndefined({
            createdAt: serverTime,
            updatedAt: serverTime,
            lastMessageAt: serverTime,
            messageCount: 1,
            title: cleanText.slice(0, 64) || 'Conversation with Meg',
            mode: cleanMode,
            language: cleanLanguage,
          })
        );
      }

      return {
        completedAssistantText: null,
        conversationId: refs.cleanConversationId,
        assistantMessageId: refs.assistantMessageId,
        duplicate: false,
      };
    });
  }

  async function persistAssistantMessage({
    uid,
    conversationId,
    messageId,
    text,
    source,
    safety,
  }) {
    const refs = references(uid, conversationId, messageId);
    const db = getFirestoreDb();
    const cleanText = typeof text === 'string' ? text.trim() : '';

    return db.runTransaction(async (transaction) => {
      const [conversationSnapshot, userSnapshot, assistantSnapshot] =
        await transaction.getAll(
          refs.conversationReference,
          refs.userMessageReference,
          refs.assistantMessageReference
        );

      if (assistantSnapshot.exists) {
        const savedText = assistantSnapshot.data()?.text;
        return {
          text: typeof savedText === 'string' && savedText.trim()
            ? savedText.trim()
            : cleanText,
          conversationId: refs.cleanConversationId,
          messageId: refs.assistantMessageId,
          source: assistantSnapshot.data()?.source,
          safety: assistantSnapshot.data()?.safety,
        };
      }
      if (!userSnapshot.exists) {
        throw new MegPersistenceError(
          'user_message_missing',
          'Meg could not save this conversation. Please try again.'
        );
      }

      const serverTime = FieldValue.serverTimestamp();
      transaction.set(
        refs.assistantMessageReference,
        stripUndefined({
          role: 'assistant',
          text: cleanText,
          createdAt: serverTime,
          source: cleanOptionalString(source, 64),
          safety: cleanOptionalString(safety, 64),
        })
      );
      transaction.set(
        refs.conversationReference,
        {
          updatedAt: serverTime,
          lastMessageAt: serverTime,
          messageCount: FieldValue.increment(1),
        },
        { merge: true }
      );

      return {
        text: cleanText,
        conversationId: refs.cleanConversationId,
        messageId: refs.assistantMessageId,
        source: cleanOptionalString(source, 64),
        safety: cleanOptionalString(safety, 64),
      };
    });
  }

  return {
    persistUserMessage,
    persistAssistantMessage,
  };
}

module.exports = {
  USERS_COLLECTION,
  CONVERSATIONS_COLLECTION,
  MESSAGES_COLLECTION,
  MAX_DOCUMENT_ID_LENGTH,
  MegPersistenceError,
  stripUndefined,
  cleanOptionalString,
  validateDocumentId,
  createMegPersistence,
};
