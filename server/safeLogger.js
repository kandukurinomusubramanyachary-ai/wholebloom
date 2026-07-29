const SAFE_METADATA_KEYS = new Set([
  'build',
  'code',
  'method',
  'path',
  'provider',
  'status',
]);

function sanitizeMetadata(metadata) {
  const safe = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (
      SAFE_METADATA_KEYS.has(key)
      && ['string', 'number', 'boolean'].includes(typeof value)
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

function write(level, event, metadata) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeMetadata(metadata),
  };
  const output = JSON.stringify(entry);
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(output);
}

const safeLogger = {
  info(event, metadata) {
    write('info', event, metadata);
  },
  warn(event, metadata) {
    write('warn', event, metadata);
  },
  error(event, metadata) {
    write('error', event, metadata);
  },
};

module.exports = {
  SAFE_METADATA_KEYS,
  sanitizeMetadata,
  safeLogger,
};
