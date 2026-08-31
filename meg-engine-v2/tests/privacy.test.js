const test = require('node:test');
const assert = require('node:assert/strict');
const { safeMetadata, createLogger } = require('../src/utils/logger');

test('safe logger redacts raw private fields and credentials', () => {
  const safe = safeMetadata({ traceId: 't', message: 'private health text', apiKey: 'secret', provider: 'gemini' });
  assert.equal(safe.message, '[REDACTED]');
  assert.equal(safe.apiKey, '[REDACTED]');
  assert.equal(safe.provider, 'gemini');
  const lines = []; const logger = createLogger({ env: 'production', sink: { info: (line) => lines.push(line), warn() {}, error() {} } });
  logger.info({ traceId: 't', content: 'private health text' });
  assert.doesNotMatch(lines[0], /private health text/);
});
