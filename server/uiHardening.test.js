const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function loadSourceModule(relativePath) {
  const filename = path.join(projectRoot, relativePath);
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(require, moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

test('preferred display names stay compact and do not replace account identity', () => {
  const { preferredDisplayName } = loadSourceModule('src/utils/displayName.js');

  assert.equal(preferredDisplayName({ preferredName: '  Subramanya   K  ', name: 'Legal Account Name' }), 'Subramanya K');
  assert.equal(preferredDisplayName({ name: 'Asha Reddy' }), 'Asha');
  assert.equal(preferredDisplayName({ firstName: 'Meera' }), 'Meera');
  assert.equal(preferredDisplayName({}), '');
  assert.ok(Array.from(preferredDisplayName({ preferredName: 'x'.repeat(80) })).length <= 32);
});

test('Meg UI includes cross-platform keyboard, retry, pagination and copy safeguards', () => {
  const meg = read('src/screens/MegScreen.js');

  assert.match(meg, /KeyboardAvoidingView/);
  assert.match(meg, /automaticallyAdjustKeyboardInsets/);
  assert.match(meg, /sendLockRef\.current/);
  assert.match(meg, /INITIAL_MESSAGE_COUNT = 30/);
  assert.match(meg, /Show earlier messages/);
  assert.match(meg, /maintainVisibleContentPosition/);
  assert.match(meg, /selectable style=\{styles\.messageText\}/);
  assert.match(meg, /expo-clipboard/);
  assert.match(meg, /Your message is still here/);
  assert.match(meg, /recoverableMegRequest/);
  assert.match(meg, /deliveryStatus: 'pending'/);
});

test('primary navigation remains Today, Timeline, Meg, Insights and Diet', () => {
  const tabs = read('src/navigation/MainTabNavigator.js');
  const names = [...tabs.matchAll(/\{ name: '([^']+)', component:/g)].map((match) => match[1]);

  assert.deepEqual(names, ['Today', 'Timeline', 'Meg', 'Insights', 'Diet']);
});

test('Diet UI is keyboard-safe, locally generated and free of horizontal scrolling', () => {
  const diet = read('src/screens/DietScreen.js');

  assert.match(diet, /KeyboardAvoidingView/);
  assert.match(diet, /keyboardShouldPersistTaps='handled'/);
  assert.match(diet, /buildDietSuggestions/);
  assert.match(diet, /Show 3 meal ideas/);
  assert.match(diet, /How did you feel after this meal\?/);
  assert.match(diet, /Personal observations/);
  assert.doesNotMatch(diet, /horizontal=\{?true\}?/);
  assert.doesNotMatch(diet, /position:\s*'absolute'/);
});
