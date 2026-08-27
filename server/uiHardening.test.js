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

test('Meg V2 uses staged acknowledgement and verified interruptible reveal', () => {
  const meg = read('src/screens/MegScreen.js');

  assert.match(meg, /I’m here\./);
  assert.match(meg, /Still with you\./);
  assert.match(meg, /Taking a little care\./);
  assert.match(meg, /setTimeout\(\(\) => setWaitingStage\(1\), 1400\)/);
  assert.match(meg, /setTimeout\(\(\) => setWaitingStage\(2\), 4200\)/);
  assert.match(meg, /createMegRevealPlan\(result\.text, providerWaitMs\)/);
  assert.match(meg, /!reduceMotion/);
  assert.match(meg, /!result\.urgent/);
  assert.match(meg, /!result\.safety/);
  assert.match(meg, /revealComplete === false/);
  assert.match(meg, /Meg is replying…/);
  assert.match(meg, /cancelReveal\(false\)/);
  assert.doesNotMatch(meg, /Meg is thinking with you/);
});

test('Meg performs only one local persistence before each provider request', () => {
  const meg = read('src/screens/MegScreen.js');
  const requestStart = meg.indexOf('async function requestReply');
  const providerStart = meg.indexOf('const result = await megService.send', requestStart);
  const sendStart = meg.indexOf('async function handleSend');
  const requestInvocation = meg.indexOf('await requestReply({', sendStart);
  const preProvider = meg.slice(requestStart, providerStart);
  const preRequestInvocation = meg.slice(sendStart, requestInvocation);

  assert.equal([...preProvider.matchAll(/await persistConversation\(/g)].length, 1);
  assert.doesNotMatch(preRequestInvocation, /persistConversation\(/);
});

test('doctor report keeps a bounded web scroll viewport', () => {
  const report = fs.readFileSync(
    path.join(__dirname, '../src/screens/DoctorReportScreen.js'),
    'utf8'
  );

  assert.match(report, /safeArea:\s*\{[\s\S]*?flex:\s*1,[\s\S]*?minHeight:\s*0,/);
  assert.match(report, /showsVerticalScrollIndicator=\{Platform\.OS === 'web'\}/);
  assert.match(report, /height:\s*'100vh',[\s\S]*?maxHeight:\s*'100vh',[\s\S]*?overflow:\s*'hidden'/);
  assert.match(report, /scroll:\s*\{[\s\S]*?flex:\s*1,[\s\S]*?minHeight:\s*0,[\s\S]*?height:\s*'100%'[\s\S]*?overflowY:\s*'auto'/);

  const navigation = fs.readFileSync(
    path.join(__dirname, '../src/navigation/RootNavigator.js'),
    'utf8'
  );
  assert.match(navigation, /name="DoctorReport"[\s\S]*?cardStyle:\s*\{[\s\S]*?minHeight:\s*0,[\s\S]*?overflow:\s*'hidden'/);
});

test('profile keeps a bounded web scroll viewport', () => {
  const profile = read('src/screens/ProfileScreen.js');
  assert.match(profile, /showsVerticalScrollIndicator=\{Platform\.OS === 'web'\}/);
  assert.match(profile, /safeArea:\s*\{[\s\S]*?flex:\s*1,[\s\S]*?minHeight:\s*0,[\s\S]*?height:\s*'100vh',[\s\S]*?overflow:\s*'hidden'/);
  assert.match(profile, /screen:\s*\{[\s\S]*?flex:\s*1,[\s\S]*?minHeight:\s*0,[\s\S]*?height:\s*'100%'[\s\S]*?overflowY:\s*'auto'/);

  const navigation = read('src/navigation/RootNavigator.js');
  assert.match(navigation, /name="Profile"[\s\S]*?cardStyle:\s*\{[\s\S]*?minHeight:\s*0,[\s\S]*?overflow:\s*'hidden'/);
});

test('primary navigation replaces Insights with feature-flagged Strength', () => {
  const tabs = read('src/navigation/MainTabNavigator.js');
  const names = [...tabs.matchAll(/\{ name: '([^']+)', component:/g)].map((match) => match[1]);

  assert.deepEqual(names, ['Today', 'Timeline', 'Meg', 'Strength', 'Diet']);
  assert.match(tabs, /isStrengthEnabled\(\)/);
  assert.doesNotMatch(tabs, /InsightsScreen/);
});

test('custom bottom navigation clears the mobile keyboard and protects narrow labels', () => {
  const tabs = read('src/navigation/MainTabNavigator.js');

  assert.match(tabs, /Keyboard\.addListener/);
  assert.match(tabs, /if \(keyboardVisible\) return null/);
  assert.match(tabs, /numberOfLines=\{1\}/);
  assert.match(tabs, /adjustsFontSizeToFit/);
  assert.match(tabs, /maxFontSizeMultiplier=\{1\.35\}/);
});

test('Strength camera startup exits reset the launch lock before another attempt', () => {
  const session = read('src/features/strength/useStrengthSession.web.js');
  const screen = read('src/features/strength/StrengthScreen.web.js');

  assert.match(session, /const leaveCamera = useCallback\(\(nextPhase = 'permission'\) => \{\s*resetRuntime\(\);\s*setPhase\(nextPhase\);/);
  assert.match(session, /beginCamera, cameraReady, cameraError, leaveCamera,/);
  assert.match(screen, /onBack=\{\(\) => session\.leaveCamera\('permission'\)\}/);
  assert.match(screen, /onPress=\{\(\) => session\.leaveCamera\('fallback'\)\}/);
  assert.match(screen, /onFallback=\{\(\) => session\.leaveCamera\('fallback'\)\}/);
});

test('Diet v3.1 is a bounded, scrollable single tab with sheet-owned depth', () => {
  const diet = read('src/screens/DietScreen.js');

  assert.match(diet, /KeyboardAvoidingView/);
  assert.match(diet, /keyboardShouldPersistTaps='handled'/);
  assert.match(diet, /I’m craving something/);
  assert.match(diet, /QuickChips/);
  assert.match(diet, /sheet === 'sos'/);
  assert.match(diet, /sheet === 'kit'/);
  assert.match(diet, /sheet === 'learn'/);
  assert.match(diet, /sheet === 'stats'/);
  assert.match(diet, /overflowY: 'auto'/);
  assert.doesNotMatch(diet, /createBottomTabNavigator/);
});

test('meal mutations cannot be reported as failed only because a derived plan refresh failed', () => {
  const context = read('src/context/AppContext.js');

  assert.match(context, /core meal\/reflection save already succeeded/);
  assert.match(context, /Do not report a completed deletion as failed/);
  assert.match(context, /try \{\s*await refreshPlan\(value\.date, \{ meals \}\);\s*\} catch/s);
});
