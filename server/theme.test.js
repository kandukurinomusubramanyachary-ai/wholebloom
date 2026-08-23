const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

function loadThemeModule() {
  const filename = path.resolve(__dirname, '../src/utils/constants.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (request) => {
    if (request === 'react-native') {
      return { StyleSheet: { create: (definitions) => definitions } };
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

test('Bloom theme preference accepts only light and dark', () => {
  const theme = loadThemeModule();
  assert.equal(theme.cleanThemePreference('light'), 'light');
  assert.equal(theme.cleanThemePreference('dark'), 'dark');
  assert.equal(theme.cleanThemePreference('system'), 'light');
  assert.equal(theme.cleanThemePreference(null), 'light');
});

test('Bloom colors and existing themed styles switch together at runtime', () => {
  const theme = loadThemeModule();
  const styles = theme.createThemedStyles({
    root: { backgroundColor: theme.COLORS.canvas },
    title: { color: theme.COLORS.ink },
    error: { backgroundColor: '#FFF7F6' },
  });

  assert.equal(styles.root.backgroundColor, theme.LIGHT_COLORS.canvas);
  assert.equal(styles.title.color, theme.LIGHT_COLORS.ink);
  theme.setActiveTheme('dark');
  assert.equal(theme.getActiveTheme(), 'dark');
  assert.equal(theme.COLORS.canvas, theme.DARK_COLORS.canvas);
  assert.equal(styles.root.backgroundColor, theme.DARK_COLORS.canvas);
  assert.equal(styles.title.color, theme.DARK_COLORS.ink);
  assert.equal(styles.error.backgroundColor, '#2A1A1D');
  theme.setActiveTheme('light');
  assert.equal(styles.root.backgroundColor, theme.LIGHT_COLORS.canvas);
});

test('themed styles created while dark still retain a valid light counterpart', () => {
  const theme = loadThemeModule();
  theme.setActiveTheme('dark');
  const styles = theme.createThemedStyles({
    root: { backgroundColor: theme.COLORS.canvas, color: theme.COLORS.body },
  });
  assert.equal(styles.root.backgroundColor, theme.DARK_COLORS.canvas);
  theme.setActiveTheme('light');
  assert.equal(styles.root.backgroundColor, theme.LIGHT_COLORS.canvas);
  assert.equal(styles.root.color, theme.LIGHT_COLORS.body);
});

test('Personalisation saves a bounded theme preference with the other settings', () => {
  const preferences = fs.readFileSync(
    path.resolve(__dirname, '../src/screens/PreferencesScreen.js'),
    'utf8'
  );
  const models = fs.readFileSync(path.resolve(__dirname, '../src/models.js'), 'utf8');
  assert.match(preferences, /const THEME_OPTIONS = \[/);
  assert.match(preferences, /title='Appearance'/);
  assert.match(preferences, /theme === item\.id/);
  assert.match(preferences, /await saveSettings\(\{[\s\S]*?\btheme,/);
  assert.match(models, /theme: 'light'/);
});
