const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('Expo iOS configuration includes identity and the only required protected-resource copy', () => {
  const config = JSON.parse(read('app.json')).expo;
  const localAuthPlugin = config.plugins.find((plugin) => (
    Array.isArray(plugin) && plugin[0] === 'expo-local-authentication'
  ));

  assert.equal(config.ios.bundleIdentifier, 'com.bloom.app');
  assert.equal(config.ios.supportsTablet, false);
  assert.equal(config.ios.config.usesNonExemptEncryption, false);
  assert.match(config.ios.infoPlist.NSFaceIDUsageDescription, /protect your private health records/i);
  assert.match(localAuthPlugin[1].faceIDPermission, /protect your private health records/i);
  assert.ok(config.plugins.includes('expo-notifications'));
  assert.doesNotMatch(JSON.stringify(config.ios.infoPlist), /Camera|Microphone|Location|Photo/);
});

test('Strength flag enables the native camera-free implementation without requesting camera access', () => {
  const flag = read('src/features/strength/featureFlag.js');
  const nativeScreen = read('src/features/strength/StrengthScreen.js');
  const fallback = read('src/features/strength/StrengthUnsupportedScreen.js');

  assert.doesNotMatch(flag, /Platform\.OS/);
  assert.match(nativeScreen, /StrengthUnsupportedScreen/);
  assert.match(fallback, /Start guided set/);
  assert.doesNotMatch(fallback, /requestCameraPermissions|CameraView|getUserMedia/);
});

test('notifications use cross-platform triggers and keep Android priority Android-only', () => {
  const notifications = read('src/services/notifications.js');
  const reminders = read('src/screens/RemindersScreen.js');

  assert.match(notifications, /Number\.isInteger\(weekday\)/);
  assert.match(notifications, /Platform\.OS === 'android'[\s\S]*priority/);
  assert.match(reminders, /key === 'weekly' \? Number\(reminder\.day\) \+ 1 : null/);
  assert.match(reminders, /setupAndroidChannel\(\)\.catch/);
});

test('device authentication cancellation remains recoverable on iOS', () => {
  const lock = read('src/components/AppLockModal.js');
  const firebase = read('src/services/firebase.js');

  assert.match(lock, /result\.error === 'user_cancel'/);
  assert.match(lock, /Bloom is still locked\. Try again/);
  assert.doesNotMatch(firebase, /unavailable in this Android build/);
});

test('the native app-lock PIN uses protected storage and migrates the legacy value', () => {
  const storage = read('src/services/storage.js');
  const packageJson = JSON.parse(read('package.json'));
  const config = JSON.parse(read('app.json')).expo;

  assert.ok(packageJson.dependencies['expo-secure-store']);
  assert.ok(config.plugins.includes('expo-secure-store'));
  assert.match(storage, /SecureStore\.getItemAsync/);
  assert.match(storage, /SecureStore\.setItemAsync/);
  assert.match(storage, /Migrate an existing PIN out of AsyncStorage/);
  assert.match(storage, /Never leave a migrated or previous copy of the PIN in AsyncStorage/);
});

test('in-app account deletion reauthenticates and deletes remote and local account data', () => {
  const auth = read('src/context/AuthContext.js');
  const context = read('src/context/AppContext.js');
  const profile = read('src/screens/ProfileScreen.js');
  const data = read('src/services/userData.js');

  assert.match(auth, /reauthenticateWithCredential/);
  assert.match(auth, /await beforeDelete\(\);[\s\S]*await deleteUser\(user\)/);
  assert.match(context, /deleteAllCurrentUserDietData/);
  assert.match(context, /deleteAllCurrentUserMegData/);
  assert.match(context, /deleteCurrentUserProfileDocument/);
  assert.match(data, /userCollection\(uid, 'strengthSessions'\)/);
  assert.match(profile, /Delete Bloom account/);
  assert.match(profile, /automaticallyAdjustKeyboardInsets=\{Platform\.OS === 'ios'\}/);
});
