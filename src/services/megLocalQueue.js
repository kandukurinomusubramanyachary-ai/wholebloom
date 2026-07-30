function timeValue(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeMessages(localMessages = [], remoteMessages = []) {
  const messages = new Map();
  (Array.isArray(localMessages) ? localMessages : []).forEach((message) => {
    if (message?.id) messages.set(String(message.id), message);
  });
  (Array.isArray(remoteMessages) ? remoteMessages : []).forEach((message) => {
    if (!message?.id) return;
    const id = String(message.id);
    messages.set(id, { ...(messages.get(id) || {}), ...message });
  });
  return [...messages.values()].sort((left, right) => (
    timeValue(left.createdAt) - timeValue(right.createdAt)
    || String(left.id).localeCompare(String(right.id))
  ));
}

export function mergeMegConversations(localConversations = [], remoteConversations = []) {
  const conversations = new Map();
  (Array.isArray(localConversations) ? localConversations : []).forEach((conversation) => {
    if (conversation?.id) conversations.set(String(conversation.id), conversation);
  });
  (Array.isArray(remoteConversations) ? remoteConversations : []).forEach((remote) => {
    if (!remote?.id) return;
    const id = String(remote.id);
    const local = conversations.get(id);
    if (!local) {
      conversations.set(id, remote);
      return;
    }
    const remoteIsNewer = timeValue(remote.updatedAt) >= timeValue(local.updatedAt);
    const base = remoteIsNewer ? { ...local, ...remote } : { ...remote, ...local };
    conversations.set(id, {
      ...base,
      id,
      messages: mergeMessages(local.messages, remote.messages),
    });
  });
  return [...conversations.values()].sort((left, right) => (
    timeValue(left.updatedAt || left.createdAt) - timeValue(right.updatedAt || right.createdAt)
    || String(left.id).localeCompare(String(right.id))
  ));
}

export function setMegMessageDelivery(messages = [], messageId, deliveryStatus) {
  return (Array.isArray(messages) ? messages : []).map((message) => (
    message?.id === messageId && message.role === 'user'
      ? { ...message, deliveryStatus }
      : message
  ));
}

export function recoverableMegRequest(messages = [], conversationId, mode = null) {
  const values = Array.isArray(messages) ? messages : [];
  const index = values.length - 1;
  const message = values[index];
  if (
    index < 0
    || message?.role !== 'user'
    || message?.deliveryStatus !== 'failed'
    || !message?.id
    || !conversationId
  ) return null;
  return {
    message: String(message.text || ''),
    messageId: message.id,
    mode,
    conversationId,
    baseMessages: values,
  };
}
