# Bloom cleanup audit

## Scope and method

Audit date: 2026-07-30.

This is a read-only classification of the tracked application, backend,
configuration, documentation, tests, and assets. It does not authorize deletion.
The audit used:

- the complete tracked-file list;
- parsed static `import`, `require`, and dynamic-import references from the
  mobile entry, Node server, scripts, and tests;
- `package.json` scripts, Expo plugins/config, Firebase config, Docker config,
  and EAS config;
- exact asset dimensions, alpha data, SHA-256 hashes, and config/generator
  references;
- a complete reading of `DESIGN.md`;
- direct and peer-dependency references for Android, iOS, web, backend, and
  repository tooling.

The mobile entry reaches 52 repository JavaScript modules. Eight `src` modules
are outside that graph. The live Node entry reaches seven backend modules.
Every tracked test is called either by `npm test` or a dedicated package script.

No files were deleted. A concurrent, uncommitted asset rename was present during
the audit and is called out explicitly below.

## Classification summary

| Category | Result |
| --- | --- |
| 1. Required runtime source | Mobile entry graph and required application assets identified |
| 2. Required backend source | Seven-module live Meg/API graph identified |
| 3. Required configuration | Build, deployment, rules, package, and asset tooling retained |
| 4. Required documentation | Product, design, operations, and release docs retained |
| 5. Required tests | All nine tracked test entry/suite files retained |
| 6. Generated file safe to delete | Local ignored outputs identified; no tracked generated file is safe to delete |
| 7. Duplicate asset safe to delete | One exact duplicate found during an in-flight rename, with a required ordering condition |
| 8. Uncertain and retained | Five dormant UI components and one dormant design-required screen |
| 9. Deprecated code retained temporarily | Disconnected Beta eligibility/launch-email flow |
| 10. Unused dependency candidate | `react-native-calendars` only |

## 1. Required runtime source

These files are reached from `package.json` → `index.js` after the guarded App
load, or are required application assets:

- Root: `index.js`, `App.js`.
- Context/state: `src/context/AppContext.js`,
  `src/context/AuthContext.js`, `src/models.js`.
- Startup: `src/diagnostics/startupDiagnostics.js`,
  `src/components/StartupDiagnosticScreen.js`,
  `src/components/StartupErrorBoundary.js`.
- Navigation: `src/navigation/RootNavigator.js`,
  `src/navigation/MainTabNavigator.js`.
- Active components: `src/components/AppLockModal.js`,
  `src/components/ArticleCard.js`, `src/components/BrandMark.js`,
  `src/components/Button.js`, `src/components/Card.js`,
  `src/components/Motion.js`, `src/components/ScreenHeader.js`.
- Active screens: `src/screens/ArticleScreen.js`,
  `src/screens/AuthScreen.js`, `src/screens/DailyCheckInScreen.js`,
  `src/screens/DayDetailScreen.js`, `src/screens/DietScreen.js`,
  `src/screens/DoctorReportScreen.js`, `src/screens/ExportDataScreen.js`,
  `src/screens/FoodScreen.js`, `src/screens/InsightsScreen.js`,
  `src/screens/LogPeriodScreen.js`, `src/screens/MegScreen.js`,
  `src/screens/MovementScreen.js`, `src/screens/PreferencesScreen.js`,
  `src/screens/PrivacySettingsScreen.js`, `src/screens/ProfileScreen.js`,
  `src/screens/RemindersScreen.js`, `src/screens/SplashScreen.js`,
  `src/screens/TimelineScreen.js`, `src/screens/TodayScreen.js`.
- Active services: `src/services/cyclePrediction.js`,
  `src/services/dailyPlan.js`, `src/services/doctorReport.js`,
  `src/services/export.js`, `src/services/firebase.js`,
  `src/services/insights.js`, `src/services/meg.js`,
  `src/services/megData.js`, `src/services/megUrlPolicy.js`,
  `src/services/notifications.js`, `src/services/storage.js`,
  `src/services/userData.js`.
- Data/utilities: `src/data/content.js`, `src/utils/constants.js`,
  `src/utils/dateKey.js`, `src/utils/helpers.js`.
- Required derived assets: `assets/icon.png`,
  `assets/adaptive-icon.png`, `assets/splash.png`, `assets/favicon.png`.
- Canonical asset source in the current worktree:
  `assets/bloom-logo-approved.png`. It is required by the modified generator
  but was untracked at audit time; it must be added atomically with the rename.

Removing an active screen merely because React Navigation has not mounted it
yet would be incorrect: stack and tab registration import those modules eagerly.

## 2. Required backend source

The live `npm run server` entry is:

- `server/index.js`;
- `server/firebaseAdmin.js`;
- `server/firebaseAuth.js`;
- `server/megPersistence.js`;
- `server/megPrompt.js`;
- `server/megProvider.js`;
- `server/safeLogger.js`.

This graph implements health, CORS, Firebase token verification, Meg chat,
provider selection, persistence, and safe logging. The Beta waitlist and launch
email modules are not in the live server graph.

## 3. Required configuration

Retain:

- `.dockerignore`, `.gitignore`, `.env.example`;
- `app.json`, `eas.json`, `babel.config.js`, `tsconfig.json`;
- `package.json`, `package-lock.json`;
- `Dockerfile`;
- `firebase.json`, `firestore.rules`;
- `scripts/generate-logo-assets.js`.

`package-lock.json` and the four derived PNGs are generated, but they are not
safe cleanup targets: the lockfile supplies reproducible installs and the PNGs
are referenced directly by Expo configuration. The asset generator is required
to reproduce and validate those PNGs.

Ignored `.env` and `.env.preview` files are not generated clutter. They may
contain local configuration and must never be deleted, copied, or committed by
an automated cleanup.

## 4. Required documentation

Retain:

- `README.md`;
- `PRODUCT.md`;
- `DESIGN.md`;
- `assets/README.txt`;
- `docs/BETA_INSTALLATION.md`;
- `docs/DEPRECATED_BUILDS.md`;
- `docs/STARTUP_AUDIT.md`;
- `docs/CLEANUP_AUDIT.md`.

`README.md` needs a future documentation-only correction: it describes
`App.js` as the entry point, documents the old tab set, lists dormant
components as if active, and its design-system section conflicts with
`DESIGN.md`. Those defects do not make the file disposable.

## 5. Required tests

Retain:

- `server/all.test.js`;
- `server/megBackend.test.js`;
- `server/megUrlPolicy.test.js`;
- `server/mobileStorage.test.js`;
- `server/startupHardening.test.js`;
- `server/firestore.rules.test.js`;
- `server/smokeTest.js`;
- `server/betaAccess.test.js`;
- `server/betaLaunchEmail.test.js`.

`server/all.test.js` loads the first five unit suites plus both Beta suites.
The rules and live Meg smoke tests have dedicated package scripts. The two Beta
tests remain necessary while category 9 is retained; retire their scripts and
test aggregation only in the same change that removes the deprecated flow.

## 6. Generated file safe to delete

No tracked generated file is confirmed safe to delete.

The following ignored local outputs are reproducible or historical and may be
removed manually after confirming no investigation still needs them:

- `.expo/`;
- `dist/`;
- `node_modules/` (recreated with `npm install`/`npm ci`);
- `.expo-web*.log`;
- `eas-build*.log`, `eas-build*.log.gz`, and
  `eas-build-details.json`;
- `Bloom-preview-*.apk` and `Bloom-diagnostic-preview-*.apk`.

The historical APKs are already classified as non-distributable in
`docs/DEPRECATED_BUILDS.md`. This audit did not delete any output.

## 7. Duplicate asset safe to delete

At audit time:

- tracked `assets/bloom-logo-final.png`; and
- untracked `assets/bloom-logo-approved.png`

were byte-for-byte identical: 167,783 bytes and SHA-256
`DA9D34D38A5139F1E5FA456856A4D8C6846AA80EF9EA11E29FE71EE0928E9A28`.
The concurrently modified generator and asset README point to
`bloom-logo-approved.png`.

The old `bloom-logo-final.png` path is safe to delete **only after** the new
`bloom-logo-approved.png` is tracked and generator/document references are
verified in the same atomic change. If the rename is abandoned, delete the
untracked new copy instead. Committing the generator change without the new
asset would break clean-clone asset generation.

No derived PNG is a duplicate cleanup candidate. `icon.png` and
`adaptive-icon.png` share source artwork but differ in required background and
alpha behavior; splash and favicon have separate dimensions and config roles.

## 8. Uncertain and retained

These files have no runtime importer, package-script entry, or config reference,
but their intended product status is not sufficiently clear for deletion:

- `src/components/FlowSelector.js`;
- `src/components/MoodSelector.js`;
- `src/components/SymptomPicker.js`;
- `src/components/InsightCard.js`;
- `src/components/ProgressRing.js`;
- `src/screens/LearnScreen.js`.

The selector components may be reusable extraction candidates for the active
inline check-in UI. The insight components may be reusable in the active
Insights implementation. `LearnScreen.js` is especially uncertain because
`DESIGN.md` and `README.md` require a Learn destination even though the current
tab navigator does not mount it. Retain all six until product/navigation intent
is explicitly reconciled.

Within required `src/utils/constants.js`, `FONTS`, `SIZES`, and
`LEGACY_MOODS` currently have no consumer. They are symbol-level cleanup
candidates, not grounds to remove the central constants module.

## 9. Deprecated code retained temporarily

The repository itself labels the launch-email admin flow as disconnected prior
waitlist work. The client eligibility screen/service are also absent from the
navigation and mobile import graph, and the server waitlist module is absent
from the live API entry.

Retain temporarily as one coherent historical subsystem:

- `BETA_LAUNCH_EMAIL.md`;
- `scripts/send-beta-launch-emails.js`;
- `server/betaAccess.js`;
- `server/betaLaunchEmail/firestore.js`;
- `server/betaLaunchEmail/provider.js`;
- `server/betaLaunchEmail/service.js`;
- `server/betaLaunchEmail/template.js`;
- `src/screens/BetaAccessScreen.js`;
- `src/services/betaAccess.js`.

Package scripts, `.env.example` guidance, `server/all.test.js`,
`server/betaAccess.test.js`, and `server/betaLaunchEmail.test.js` still refer to
this subsystem. Any removal must update all of them together and must first
confirm that no launch operator depends on the CLI. It is not safe to delete
piecemeal.

## 10. Unused dependency candidate

`react-native-calendars` is the only confirmed candidate:

- no tracked runtime, backend, script, config, or test imports it;
- no Expo plugin references it;
- the active Timeline implementation is custom;
- it is not a peer required by the installed navigation packages.

Do not remove it in this documentation pass. A later isolated dependency change
should remove it from the manifest/lockfile, reinstall, and run typecheck,
tests, Expo Doctor, web export, Android export, and Timeline verification.

The following apparently indirect packages are retained intentionally:

- `react-native-gesture-handler` and `react-native-screens` are peers of the
  stack navigator;
- `expo-font` is a peer of vector icons and a dependency of Expo;
- `react-dom`, `react-native-web`, and `@expo/metro-runtime` support web;
- `expo-system-ui` supports Expo system-UI configuration;
- `typescript` and `@types/react` support `npm run typecheck`;
- `firebase-tools` powers the Firestore-rules script;
- `@babel/core` is used by Babel config/testing;
- `pngjs` powers approved asset generation.

`@types/react` and `typescript` are tooling packages currently placed under
`dependencies`, but they are used; moving them to `devDependencies` is a
separate packaging tidy-up, not an unused-dependency finding.

## Central theme verdict

`src/utils/constants.js` already functions as Bloom’s central theme and data
token module. Do not create a second theme file. Active UI modules consistently
consume its colors, layout, motion, elevation, focus, mood, flow, symptom, and
preference definitions. Core `DESIGN.md` values for canvas, soft/warm surfaces,
ink/body/muted text, hairline, logo colors, Brand/Brand soft, cycle, sage,
error, 20-point gutter, 720-point cap, 16/12-point radii, 48-point touch target,
and the main easing curve match.

It is central but not exclusive or complete: 53 hard-coded color/rgba literals
remain outside the module, and typography is still hard-coded in components.

## Exact `DESIGN.md` mismatches

| Area | `DESIGN.md` | Current source | Exact mismatch |
| --- | --- | --- | --- |
| Spacing scale | `4, 8, 12, 16, 20, 24, 32, 48` | `SIZES` exposes `4, 8, 16, 24, 32, 48`; `LAYOUT.screenPadding` separately exposes `20` | Central spacing scale omits `12` and does not include `20`; `SIZES` is unused. |
| Typography tokens | Seven roles with size, weight, and line height; humanist system sans | `FONTS` contains only two `undefined` family slots and is unused; role values are repeated in styles | The central theme does not encode the documented typography system. |
| Parallax | Today cycle context moves by at most 12 points | `MOTION.distance.parallax` is `18` | Six points above the documented maximum. |
| Reveal opacity | Supporting reveal may begin at 90% opacity | `MOTION.opacity.reveal` is `0.9`, but `entrance` is `0.92` | The generic entrance token is not the documented 90% value. |
| Elevation | Offset `0,2`, blur `8`, opacity `0.08`, one restrained shadow | Web uses a border-like layer plus three shadows including `0.10`; iOS uses offset `0,3`, radius `7`, opacity `0.10`; Android uses elevation `3` | The central elevation tier is stronger and structurally different. |
| Border plus shadow | Do not combine a wide shadow and border on one decorative card | `Card` keeps its one-point border when `elevated` or hover elevation is applied | The reusable card can combine both. |
| Focus | Inputs use a Brand focus outline | `WEB_FOCUS.outlineColor` is Ink; it is reused across controls | The shared focus token is Ink rather than Brand. |
| Press scale | Standard press scales to `0.98` | `Button` uses `0.98`, but `Card` uses `0.99` and tab buttons use `0.97` | Only the primary Button matches the documented standard. |
| Reduced motion | Remove position and scale changes | Tab focus scale still changes between `0.96` and `1`; reduced motion makes the duration zero | The scale state change remains, although it becomes instantaneous. |
| Bottom navigation | Today, Timeline, Insights, Learn, Profile | Today, Timeline, Meg, Insights, Diet | Two documented destinations are replaced and order differs. This may be intentional product evolution, so no automatic change is safe. |
| Theme mode | Light | `app.json` uses `userInterfaceStyle: automatic`, while color tokens are light-only | Native system style may follow dark mode without a corresponding dark token set. |
| Token coverage | Restrained named palette | Theme includes undocumented `surfaceStrong`, interaction variants, strong/soft borders, `warning`, and legacy aliases; 53 literals also remain in UI files | Palette extensions and local literals are not reconciled with the design source of truth. |
| Legacy aliases | No alias palette specified | `ivory`, `terracotta`, `terracottaLight`, `charcoal`, `charcoalLight`, `cream`, `gray`, `lightGray`, and `success` duplicate other tokens and have no consumer | Confirmed unused token-level cleanup candidates. |
| README design summary | Should agree with `DESIGN.md` | README specifies Playfair Display/DM Sans, sage `#9BAF93`, and text `#2E2A27` | Documentation is stale; the runtime constants follow `DESIGN.md` more closely. |
| Opening destination | Opening enters Today directly | Signed-out users go to Auth; signed-in users reach the main Today tab after auth/data/splash | Authentication product behavior supersedes the older direct-entry statement. |

Confirmed matches worth preserving include the `#FFFDFE` opening background,
110-point two-pixel progress line, 2.2-second normal opening duration, 8-point
logo rise, main Brand/button dimensions, shape radii, content width, touch
target, and the standard easing curve.

## Recommended cleanup order

1. Finish the canonical-logo rename atomically and verify asset generation.
2. Decide whether Learn and the five dormant components are future product
   assets; retain until that decision.
3. Decide whether the disconnected Beta subsystem is still operationally
   needed; retire code, scripts, tests, docs, and env guidance together.
4. Remove `react-native-calendars` in an isolated, fully verified dependency
   change.
5. Reconcile README and DESIGN with the intentional current tab/product model.
6. Consolidate token drift into the existing `src/utils/constants.js`; do not
   introduce another theme.

## Release-pass resolutions after this audit

- The approved logo path is now tracked as a regular exact-hash file; all live
  references moved atomically and the byte-identical transitional master was
  removed. Git retains the recoverable baseline copy.
- `react-native-calendars` was removed in isolation after the no-import finding;
  typecheck and the full 55-test suite passed immediately afterward.
- The existing constants module was retained as the single theme. Missing
  spacing/typography roles, focus colour, motion distance, and the one elevation
  tier were aligned with `DESIGN.md` without adding another theme layer.
