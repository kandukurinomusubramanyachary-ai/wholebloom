const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateRequest } = require('../src/utils/auth');

test('optional API key auth uses bearer and rejects invalid credentials', () => {
  assert.equal(authenticateRequest({ headers: { authorization: 'Bearer good' } }, { apiKey: 'good' }).ok, true);
  assert.equal(authenticateRequest({ headers: { authorization: 'Bearer bad' } }, { apiKey: 'good' }).ok, false);
  assert.equal(authenticateRequest({ headers: {} }, { apiKey: '' }).ok, true);
});
