const SAFE_METADATA_KEYS = new Set([
  'build',
  'code',
  'method',
  'path',
  'provider',
  'status',
]);

const MEG_QA_DURATION_KEYS = new Set([
  'client_token_acquisition_ms',
  'client_http_total_ms',
  'tap_to_visible_reply_ms',
  'client_local_persist_ms',
  'server_auth_ms',
  'user_msg_persist_ms',
  'provider_headers_ms',
  'provider_body_ms',
  'provider_total_ms',
  'revision_provider_total_ms',
  'assistant_msg_persist_ms',
  'server_total_ms',
]);

const MEG_QA_FIELD_ORDER = [
  ...MEG_QA_DURATION_KEYS,
  'revision_triggered',
  'status',
  'failure_category',
];

const TRACE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function sanitizeMegQaTiming(payload) {
  const safe = {};
  if (typeof payload?.trace_id !== 'string' || !TRACE_ID_PATTERN.test(payload.trace_id)) {
    return safe;
  }
  safe.trace_id = payload.trace_id;

  for (const key of MEG_QA_FIELD_ORDER) {
    const value = payload?.[key];
    if (!Number.isFinite(value)) continue;
    if (MEG_QA_DURATION_KEYS.has(key)) {
      safe[key] = Math.max(1, Math.round(value));
    } else if (key === 'revision_triggered') {
      safe[key] = value === 1 ? 1 : 0;
    } else if (key === 'status') {
      safe[key] = Math.max(0, Math.round(value));
    } else if (key === 'failure_category' && Number.isInteger(value) && value >= 0 && value <= 8) {
      safe[key] = value;
    }
  }

  return safe;
}

function writeMegQaTiming(payload) {
  const safe = sanitizeMegQaTiming(payload);
  if (!safe.trace_id) return false;
  console.log(`[meg-qa] ${JSON.stringify(safe)}`);
  return true;
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
  MEG_QA_DURATION_KEYS,
  MEG_QA_FIELD_ORDER,
  SAFE_METADATA_KEYS,
  sanitizeMegQaTiming,
  sanitizeMetadata,
  safeLogger,
  writeMegQaTiming,
};
