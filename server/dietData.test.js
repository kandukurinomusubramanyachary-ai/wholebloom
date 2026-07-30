const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function loadDietDataModule() {
  const filename = path.resolve(__dirname, '../src/services/dietData.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const firestore = new Proxy({}, { get: () => () => ({}) });
  const localRequire = (request) => {
    if (request === 'firebase/firestore') return firestore;
    if (request === './firebase') {
      return { auth: { currentUser: { uid: 'user-a' } }, db: {}, firebaseConfigurationError: null };
    }
    if (request === './userData') {
      return { stripUndefined: (value) => value };
    }
    return require(request);
  };
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

const dietData = loadDietDataModule();

test('Diet record merge keeps the newest version without crossing record IDs', () => {
  const merged = dietData.mergeDietRecords(
    [
      { id: 'local-newer', updatedAt: '2026-07-30T12:00:00.000Z', source: 'local' },
      { id: 'remote-newer', updatedAt: '2026-07-30T10:00:00.000Z', source: 'local' },
    ],
    [
      { id: 'local-newer', updatedAt: '2026-07-30T11:00:00.000Z', source: 'remote' },
      { id: 'remote-newer', updatedAt: '2026-07-30T13:00:00.000Z', source: 'remote' },
    ]
  );

  assert.equal(merged.find((item) => item.id === 'local-newer').source, 'local');
  assert.equal(merged.find((item) => item.id === 'remote-newer').source, 'remote');
  assert.equal(merged.length, 2);
});

test('Diet reflection hydration updates only the matching meal', () => {
  const meals = [{ id: 'meal-a' }, { id: 'meal-b', reflection: { outcome: 'sleepy' } }];
  const hydrated = dietData.applyDietReflections(meals, [{
    mealLogId: 'meal-a',
    outcome: 'steady_energy',
    recordedAt: '2026-07-30T12:00:00.000Z',
  }]);

  assert.equal(hydrated[0].reflection.outcome, 'steady_energy');
  assert.equal(hydrated[1].reflection.outcome, 'sleepy');
});

test('an untimestamped local Diet profile is not silently replaced during hydration', () => {
  const local = { eatingPreference: 'vegan' };
  const remote = {
    eatingPreference: 'non_vegetarian',
    updatedAt: '2026-07-30T12:00:00.000Z',
  };

  assert.deepEqual(dietData.mergeDietProfile(local, remote), local);
});
