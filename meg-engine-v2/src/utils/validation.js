function validateChatBody(body, { maxMessageChars = 10000, maxMessageIdChars = 160 } = {}) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { valid: false, errors: ['body must be a JSON object'] };
  for (const field of ['userId', 'conversationId', 'message']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) errors.push(`${field} is required`);
  }
  if (typeof body.userId === 'string' && body.userId.length > 240) errors.push('userId is too long');
  if (typeof body.conversationId === 'string' && body.conversationId.length > 240) errors.push('conversationId is too long');
  if (typeof body.message === 'string' && body.message.length > maxMessageChars) errors.push(`message exceeds ${maxMessageChars} characters`);
  if (body.messageId !== undefined && (typeof body.messageId !== 'string' || !body.messageId.trim() || body.messageId.length > maxMessageIdChars)) errors.push(`messageId must be a non-empty string under ${maxMessageIdChars} characters`);
  if (body.mode !== undefined && !['auto', 'fast', 'smart', 'doctor', 'local'].includes(String(body.mode).toLowerCase())) errors.push('mode must be auto, fast, smart, doctor, or local');
  if (body.context !== undefined && (!body.context || typeof body.context !== 'object' || Array.isArray(body.context))) errors.push('context must be an object');
  if (body.userContext !== undefined && (!body.userContext || typeof body.userContext !== 'object' || Array.isArray(body.userContext))) errors.push('userContext must be an object');
  return { valid: errors.length === 0, errors };
}

module.exports = { validateChatBody };
