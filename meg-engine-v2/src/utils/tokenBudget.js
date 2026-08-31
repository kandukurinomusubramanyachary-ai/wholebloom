function estimateTokens(text = '') { return Math.ceil(String(text).length / 4); }
function trimToTokens(text, maxTokens, { keepEnd = false } = {}) {
  const value = String(text || '');
  const maxChars = Math.max(0, Math.floor(maxTokens * 4));
  if (value.length <= maxChars) return value;
  if (maxChars <= 1) return maxChars === 1 ? '…' : '';
  if (keepEnd) return `…${value.slice(-(maxChars - 1))}`;
  const boundary = value.slice(0, maxChars).lastIndexOf(' ');
  return `${value.slice(0, boundary > maxChars * 0.5 ? boundary : maxChars).trim()}…`;
}

function fitSections(sections, budget) {
  const result = {};
  let remaining = Math.max(1, budget);
  for (const section of sections) {
    const requested = Math.min(section.maxTokens || remaining, remaining);
    const text = trimToTokens(section.text, requested, { keepEnd: section.keepEnd });
    result[section.name] = text;
    remaining = Math.max(0, remaining - estimateTokens(text));
  }
  return { sections: result, remaining };
}

function compactRecentMessages(messages = [], { maxMessages = 8, olderBudget = 300 } = {}) {
  const list = messages.slice(-maxMessages);
  if (list.length <= 4) return list.map(formatMessage).join('\n');
  const older = list.slice(0, -4).map((item) => `${item.role === 'assistant' ? 'Meg' : 'User'}: ${String(item.content).replace(/\s+/g, ' ').trim()}`).join(' | ');
  const recent = list.slice(-4).map(formatMessage).join('\n');
  return `Earlier turns, compact summary: ${trimToTokens(older, olderBudget)}\n${recent}`;
}

function formatMessage(item) { return `${item.role === 'assistant' ? 'Meg' : 'User'}: ${String(item.content || '').trim()}`; }

module.exports = { estimateTokens, trimToTokens, fitSections, compactRecentMessages, formatMessage };
