const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function createMemoryStorage(initialEntries = []) {
  const values = new Map(initialEntries);
  return {
    values,
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

function loadStorageModule(storageBackend) {
  const filename = path.resolve(__dirname, '../src/services/storage.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => (
    request === '@react-native-async-storage/async-storage'
      ? storageBackend
      : require(request)
  );
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(localRequire, moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

test('storage JSON and AsyncStorage safety helpers return controlled fallbacks', async () => {
  const backend = createMemoryStorage();
  const helpers = loadStorageModule(backend);
  const fallback = { fallback: true };
  const cyclic = {};
  cyclic.self = cyclic;

  assert.deepEqual(helpers.safeParseJson(JSON.stringify({ valid: true }), fallback), { valid: true });
  assert.equal(helpers.safeParseJson('{invalid', fallback), fallback);
  assert.equal(helpers.safeStringifyJson(cyclic, fallback), fallback);
  assert.equal(await helpers.safeGetItem('key', { getItem: async () => { throw new Error(); } }), null);
  assert.equal(await helpers.safeSetItem('key', 'value', { setItem: async () => { throw new Error(); } }), false);
  assert.equal(await helpers.safeRemoveItem('key', { removeItem: async () => { throw new Error(); } }), false);
});

test('storage uses versioned UID keys and migrates the prior UID-scoped key', async () => {
  const legacyKey = '@bloom_user:user%2Fone:bloom_settings';
  const backend = createMemoryStorage([[legacyKey, JSON.stringify({ language: 'en' })]]);
  const { storage } = loadStorageModule(backend);
  storage.setUserScope(' user/one ');

  assert.deepEqual(await storage.getSettings(), { language: 'en' });
  assert.equal(backend.values.has(legacyKey), false);
  assert.equal(backend.values.has('@bloom_user:v1:user%2Fone:bloom_settings'), true);
});

test('storage removes malformed JSON and tolerates structurally invalid collections', async () => {
  const corruptKey = '@bloom_user:v1:user-one:bloom_settings';
  const mealsKey = '@bloom_user:v1:user-one:bloom_meals';
  const backend = createMemoryStorage([
    [corruptKey, '{invalid'],
    [mealsKey, JSON.stringify({ not: 'an-array' })],
  ]);
  const { storage } = loadStorageModule(backend);
  storage.setUserScope('user-one');

  assert.equal(await storage.getSettings(), null);
  assert.equal(backend.values.has(corruptKey), false);
  assert.deepEqual(await storage.saveMeal({ id: 'meal-one' }), [{ id: 'meal-one' }]);
});

test('meal logs and reflections remain isolated when the signed-in account changes', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);

  storage.setUserScope('user-a');
  await storage.saveMeal({
    id: 'meal-a',
    name: 'A meal',
    reflection: { outcome: 'steady_energy' },
  });

  storage.setUserScope('user-b');
  assert.equal(await storage.getMeals(), null);
  await storage.saveMeal({ id: 'meal-b', name: 'B meal' });

  storage.setUserScope('user-a');
  assert.deepEqual((await storage.getMeals()).map((meal) => meal.id), ['meal-a']);
  assert.equal((await storage.getMeals())[0].reflection.outcome, 'steady_energy');
  await storage.deleteMeal('meal-a');
  assert.deepEqual(await storage.getMeals(), []);

  storage.setUserScope('user-b');
  assert.deepEqual((await storage.getMeals()).map((meal) => meal.id), ['meal-b']);
});

test('Meg retry state remains UID-scoped in device storage', async () => {
  const backend = createMemoryStorage();
  const { storage } = loadStorageModule(backend);

  storage.setUserScope('user-a');
  await storage.setMegConversations([{ id: 'chat-a', messages: [{ deliveryStatus: 'failed' }] }]);
  storage.setUserScope('user-b');
  assert.equal(await storage.getMegConversations(), null);
  await storage.setMegConversations([{ id: 'chat-b', messages: [] }]);

  storage.setUserScope('user-a');
  assert.equal((await storage.getMegConversations())[0].id, 'chat-a');
  assert.equal((await storage.getMegConversations())[0].messages[0].deliveryStatus, 'failed');
});
