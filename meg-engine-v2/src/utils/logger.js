const SENSITIVE_KEYS = /authorization|api[-_]?key|token|secret|password|cookie|content|message|prompt|context|memory/i;

function redactValue(key, value) {
  if (SENSITIVE_KEYS.test(String(key))) return '[REDACTED]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(key, item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactValue(childKey, childValue)]));
  return value;
}

function safeMetadata(metadata = {}) {
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, redactValue(key, value)]));
}

function createLogger({ env = process.env.NODE_ENV || 'development', sink = console } = {}) {
  const write = (level, metadata) => {
    const line = JSON.stringify({ time: new Date().toISOString(), level, ...safeMetadata(metadata) });
    const method = sink[level] || sink.log;
    method.call(sink, line);
  };
  return {
    info: (metadata) => write('info', metadata),
    warn: (metadata) => write('warn', metadata),
    error: (metadata) => write('error', metadata),
    debug: (metadata) => { if (env !== 'production') write('debug', metadata); },
  };
}

module.exports = { SENSITIVE_KEYS, redactValue, safeMetadata, createLogger };
