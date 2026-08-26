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

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Bloom theme preference accepts only light and dark', () => {
  const theme = loadThemeModule();
  assert.equal(theme.cleanThemePreference('light'), 'light');
  assert.equal(theme.cleanThemePreference('dark'), 'dark');
  assert.equal(theme.cleanThemePreference('system'), 'light');
  assert.equal(theme.cleanThemePreference(null), 'light');
  assert.equal(theme.statusBarStyleForTheme('light'), 'dark');
  assert.equal(theme.statusBarStyleForTheme('dark'), 'light');
  assert.deepEqual(theme.navigationColorsForTheme('dark'), {
    primary: theme.DARK_COLORS.brand,
    background: theme.DARK_COLORS.canvas,
    card: theme.DARK_COLORS.white,
    text: theme.DARK_COLORS.ink,
    border: theme.DARK_COLORS.hairline,
    notification: theme.DARK_COLORS.brand,
  });
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

test('core dark text and controls meet WCAG AA contrast', () => {
  const { DARK_COLORS: colors } = loadThemeModule();
  assert.ok(contrast(colors.ink, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.body, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.muted, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.white, colors.brand) >= 4.5);
  assert.ok(contrast(colors.error, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.warning, colors.canvas) >= 4.5);
  assert.ok(contrast(colors.sage, colors.canvas) >= 4.5);
});

test('authenticated screens use the central themed stylesheet rather than fixed white roots', () => {
  const screenDirectory = path.resolve(__dirname, '../src/screens');
  const excluded = new Set(['AuthScreen.js', 'SplashScreen.js']);
  const files = fs.readdirSync(screenDirectory).filter((name) => name.endsWith('.js') && !excluded.has(name));
  for (const name of files) {
    const source = fs.readFileSync(path.join(screenDirectory, name), 'utf8');
    assert.doesNotMatch(source, /const styles = StyleSheet\.create\(/, `${name} bypasses the theme system`);
  }
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
  assert.match(preferences, /setThemePreference\(value\)/);
  assert.match(preferences, /await saveSettings\(\{[\s\S]*?\btheme,/);
  assert.match(models, /theme: 'light'/);
});
