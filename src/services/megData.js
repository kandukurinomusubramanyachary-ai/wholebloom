import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, firebaseConfigurationError } from './firebase';
import { stripUndefined } from './userData';

const BATCH_LIMIT = 450;

function requireFirebaseUser() {
  if (firebaseConfigurationError || !auth || !db) {
    throw new Error('Bloom account storage is not available on this build.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in before using Meg.');
  return user;
}

function requireDocumentId(value, label) {
  const id = String(value || '').trim();
  if (!id || id.length > 256 || id.includes('/')) {
    throw new Error(`A valid ${label} is required.`);
  }
  return id;
}

function timestampToIso(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return value || null;
}

function dateValue(value) {
  const parsed = Date.parse(timestampToIso(value) || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function messageFromSnapshot(snapshot) {
  const value = snapshot.data() || {};
  return stripUndefined({
    id: snapshot.id,
    role: value.role === 'assistant' ? 'assistant' : 'user',
    text: String(value.text ?? value.content ?? ''),
    createdAt: timestampToIso(value.createdAt),
    feedback: value.feedback ?? null,
    safety: value.safety ?? null,
    source: value.source ?? null,
  });
}

async function conversationFromSnapshot(snapshot) {
  const value = snapshot.data() || {};
  const messagesSnapshot = await getDocs(collection(snapshot.ref, 'messages'));
  const messages = messagesSnapshot.docs
    .map(messageFromSnapshot)
    .sort((left, right) => (
      dateValue(left.createdAt) - dateValue(right.createdAt)
      || left.id.localeCompare(right.id)
    ));

  return stripUndefined({
    id: snapshot.id,
    title: value.title || messages.find((message) => message.role === 'user')?.text?.slice(0, 64)
      || 'Conversation with Meg',
    mode: value.mode ?? value.supportMode ?? null,
    supportMode: value.supportMode ?? value.mode ?? null,
    language: value.language ?? null,
    createdAt: timestampToIso(value.createdAt) || messages[0]?.createdAt || null,
    updatedAt: timestampToIso(value.updatedAt)
      || messages[messages.length - 1]?.createdAt
      || null,
    messageCount: Number.isFinite(value.messageCount) ? value.messageCount : messages.length,
    messages,
  });
}

function conversationsCollection(uid) {
  return collection(db, 'users', uid, 'megConversations');
}

export async function loadCurrentUserMegConversations() {
  const { uid } = requireFirebaseUser();
  const snapshot = await getDocs(conversationsCollection(uid));
  const conversations = await Promise.all(snapshot.docs.map(conversationFromSnapshot));
  return conversations.sort((left, right) => (
    dateValue(left.updatedAt) - dateValue(right.updatedAt)
    || left.id.localeCompare(right.id)
  ));
}

export async function updateCurrentUserMegFeedback(conversationId, messageId, feedback) {
  const { uid } = requireFirebaseUser();
  const safeConversationId = requireDocumentId(conversationId, 'conversation ID');
  const safeMessageId = requireDocumentId(messageId, 'message ID');
  const reference = doc(
    db,
    'users',
    uid,
    'megConversations',
    safeConversationId,
    'messages',
    safeMessageId
  );
  await updateDoc(reference, { feedback: feedback ?? null });
}

async function deleteReferences(references) {
  for (let index = 0; index < references.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    references.slice(index, index + BATCH_LIMIT).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

async function deleteConversationSnapshot(snapshot) {
  const messages = await getDocs(collection(snapshot.ref, 'messages'));
  await deleteReferences(messages.docs.map((message) => message.ref));
  await deleteDoc(snapshot.ref);
}

export async function deleteCurrentUserMegConversation(conversationId) {
  const { uid } = requireFirebaseUser();
  const safeConversationId = requireDocumentId(conversationId, 'conversation ID');
  const reference = doc(db, 'users', uid, 'megConversations', safeConversationId);
  const messages = await getDocs(collection(reference, 'messages'));
  await deleteReferences(messages.docs.map((message) => message.ref));
  await deleteDoc(reference);
}

export async function deleteAllCurrentUserMegData() {
  const { uid } = requireFirebaseUser();
  const conversations = await getDocs(conversationsCollection(uid));
  for (const snapshot of conversations.docs) {
    await deleteConversationSnapshot(snapshot);
  }
}
