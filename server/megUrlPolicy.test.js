const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCTION_URL_ERROR,
  resolveMegApiBaseUrl,
} = require('../src/services/megUrlPolicy');

test('Meg URL policy keeps loopback available in development', () => {
  assert.equal(
    resolveMegApiBaseUrl({ isDevelopment: true }),
    'http://127.0.0.1:3001'
  );
  assert.equal(
    resolveMegApiBaseUrl({
      configuredValue: 'http://192.168.1.8:3001/',
      isDevelopment: true,
    }),
    'http://192.168.1.8:3001'
  );
});

test('Meg URL policy accepts a public HTTPS production endpoint', () => {
  assert.equal(
    resolveMegApiBaseUrl({
      configuredValue: 'https://meg-api.bloom.example/',
      isDevelopment: false,
    }),
    'https://meg-api.bloom.example'
  );
});

test('Meg URL policy requires an explicit production URL', () => {
  assert.throws(
    () => resolveMegApiBaseUrl({ isDevelopment: false }),
    /required for production builds/
  );
});

test('Meg URL policy rejects non-HTTPS production endpoints', () => {
  assert.throws(
    () => resolveMegApiBaseUrl({
      configuredValue: 'http://meg-api.bloom.example',
      isDevelopment: false,
    }),
    { message: PRODUCTION_URL_ERROR }
  );
});

for (const hostname of [
  'localhost',
  'localhost.',
  'api.localhost',
  '127.0.0.1',
  '10.0.0.4',
  '172.16.0.4',
  '192.168.1.4',
  'service.local',
  '[::1]',
  '[::ffff:127.0.0.1]',
  '[fd00::4]',
]) {
  test(`Meg URL policy rejects non-public production host ${hostname}`, () => {
    assert.throws(
      () => resolveMegApiBaseUrl({
        configuredValue: `https://${hostname}:3001`,
        isDevelopment: false,
      }),
      { message: PRODUCTION_URL_ERROR }
    );
  });
}
