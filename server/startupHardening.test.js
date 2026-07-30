const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
  });
}

test('Expo public environment access is statically inlineable in frontend source', () => {
  const frontend = sourceFiles(path.join(projectRoot, 'src'))
    .map((filename) => fs.readFileSync(filename, 'utf8'))
    .join('\n');

  assert.doesNotMatch(frontend, /process\.env\?\./);
  assert.doesNotMatch(frontend, /process\.env\s*\[/);
  assert.doesNotMatch(frontend, /\{[^}]*EXPO_PUBLIC_[^}]*\}\s*=\s*process\.env/);
  assert.match(frontend, /process\.env\.EXPO_PUBLIC_FIREBASE_API_KEY/);
  assert.match(frontend, /process\.env\.EXPO_PUBLIC_MEG_API_URL/);
});

test('optional native services do not perform eager notification or Meg setup', () => {
  const notifications = read('src/services/notifications.js');
  const configureIndex = notifications.indexOf('export function configureNotificationHandler');
  const handlerIndex = notifications.indexOf('Notifications.setNotificationHandler');
  const meg = read('src/services/meg.js');

  assert.ok(configureIndex >= 0);
  assert.ok(handlerIndex > configureIndex);
  assert.match(meg, /let defaultMegService = null/);
  assert.match(meg, /if \(!defaultMegService\) defaultMegService = createMegService\(\)/);
});

test('startup has guarded native splash handling, timeout, and sanitised stages', () => {
  const entry = read('index.js');
  const splash = read('src/screens/SplashScreen.js');
  const diagnostics = read('src/diagnostics/startupDiagnostics.js');
  const appConfig = JSON.parse(read('app.json'));
  const expectedStages = [
    'native-entry',
    'app-mounted',
    'splash-visible',
    'configuration-check',
    'firebase-app',
    'firebase-auth',
    'firestore',
    'auth-restoration',
    'profile-load',
    'app-state-load',
    'navigation-ready',
    'first-screen-rendered',
    'splash-hidden',
  ];

  assert.match(entry, /preventAutoHideAsync\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(entry, /setTimeout\(hideNativeSplash, 4000\)/);
  assert.match(splash, /const SPLASH_TIMEOUT = 4000/);
  assert.ok(appConfig.expo.plugins.includes('expo-splash-screen'));
  expectedStages.forEach((stage) => assert.match(diagnostics, new RegExp(`'${stage}'`)));
});
