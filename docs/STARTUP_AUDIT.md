# Bloom startup audit

## Scope and verification level

This audit describes the startup path in the source baseline at Git commit
`6bf04b5` plus the current startup-hardening branch on 2026-07-30. It covers the JavaScript entry point, eager module
graph, authentication and data bootstrap, navigation readiness, native-module
touchpoints, configuration requirements, and diagnostic handling.

Verification method: static source inspection plus a parsed local import graph.
No statement in this document is evidence that a native APK starts on a
physical phone. Native startup and all physical-device behaviour remain
**NOT VERIFIED** until recorded against an approved APK.

## Startup sequence

| Phase | Source | Behaviour | Success/failure transition |
| --- | --- | --- | --- |
| Native/Expo launch | `package.json`, `index.js` | Expo loads the custom entry and guarded `expo-splash-screen` handling. | Native or entry-module failures before the bootstrap mounts cannot use the in-app diagnostic. |
| Diagnostic bootstrap | `index.js`, `src/diagnostics/startupDiagnostics.js` | Installs the global React Native error handler when available, records `native-entry` then `app-mounted`, and registers `BloomBootstrap`. | AsyncStorage stage writes and native splash API failures are best-effort and caught. |
| Previous-failure restore | `index.js` | `BloomBootstrap` reads the last persisted startup failure in an effect. | A stored failure shows `StartupDiagnosticScreen`; otherwise App loading begins. |
| Application module load | `index.js` | `require('./App')` runs inside `loadBloomApplication()` and a `try/catch`. | Module-evaluation failures are sanitised, persisted, and shown as a diagnostic. |
| React boundary | `src/components/StartupErrorBoundary.js` | Wraps the loaded App component. | Descendant render/lifecycle errors show the diagnostic screen and can be retried. |
| Authentication bootstrap | `App.js`, `src/context/AuthContext.js`, `src/services/firebase.js` | `SafeAreaProvider` and `AuthProvider` mount; the auth effect validates and initializes Firebase, then subscribes to auth state. | Missing/failed Firebase configuration becomes a startup failure. An auth listener result selects signed-out or signed-in flow. |
| Signed-out readiness | `App.js` | Once auth resolution completes with no user and no failure, Bloom marks startup ready and renders `AuthScreen`. | The persisted failure is cleared by `markStartupReady()`. |
| Signed-in data load | `App.js`, `src/context/AppContext.js` | `AppProvider` scopes local storage to the UID and loads the profile, check-ins, periods, Meg conversations, meals, movements, settings, bookmarks, and privacy settings. | Load errors set a user-facing save-state error; `finally` still clears the loading state. |
| App splash and navigation | `src/navigation/RootNavigator.js`, `src/screens/SplashScreen.js` | The signed-in flow shows the branded splash while data loads, but a four-second timeout prevents an indefinite lock. | Navigation records `navigation-ready` and `first-screen-rendered`; successful readiness clears the stored failure. |
| Post-navigation effects | `src/navigation/RootNavigator.js` | Applies screen-capture policy and app-lock lifecycle handling. | Screen-capture failures are caught and reduced to a generic warning. |

## Full eager repository import graph

`App.js` is deliberately required after the previous-failure check, but all of
its static imports are then evaluated eagerly. React Navigation does not defer
the module evaluation of registered screen components.

```text
package.json (main: index.js)
└─ index.js
   ├─ src/diagnostics/startupDiagnostics.js
   ├─ src/components/StartupDiagnosticScreen.js
   │  └─ src/utils/constants.js
   ├─ src/components/StartupErrorBoundary.js
   │  └─ StartupDiagnosticScreen + startupDiagnostics
   └─ require("./App") after persisted-failure restoration
      └─ App.js
         ├─ src/context/AuthContext.js
         │  ├─ src/services/firebase.js
         │  │  └─ startupDiagnostics
         │  └─ src/services/userData.js
         │     ├─ firebase
         │     └─ src/utils/dateKey.js
         ├─ src/context/AppContext.js
         │  ├─ AuthContext
         │  ├─ src/models.js
         │  ├─ src/services/storage.js
         │  ├─ src/services/userData.js
         │  ├─ src/services/megData.js
         │  │  └─ firebase + userData
         │  ├─ src/services/cyclePrediction.js
         │  │  └─ dateKey
         │  ├─ src/services/dailyPlan.js
         │  ├─ src/utils/dateKey.js
         │  └─ src/utils/helpers.js
         │     └─ constants
         ├─ src/screens/AuthScreen.js
         │  ├─ src/components/BrandMark.js
         │  ├─ src/components/Button.js
         │  ├─ src/components/Motion.js
         │  └─ AuthContext + constants
         ├─ src/screens/SplashScreen.js
         │  └─ BrandMark + Motion + constants
         ├─ src/components/StartupDiagnosticScreen.js
         └─ src/navigation/RootNavigator.js
            ├─ src/components/AppLockModal.js
            │  └─ BrandMark + Button + Motion + AppContext + constants
            ├─ src/components/Motion.js
            ├─ src/screens/SplashScreen.js
            ├─ src/screens/ArticleScreen.js
            │  └─ Motion + AppContext + src/data/content.js + constants
            ├─ src/screens/DayDetailScreen.js
            │  └─ Button + Motion + AppContext + constants + helpers
            ├─ src/screens/LogPeriodScreen.js
            │  └─ Button + Motion + AppContext + constants + dateKey
            ├─ src/screens/PrivacySettingsScreen.js
            │  └─ Button + src/components/ScreenHeader.js + AppContext + constants
            ├─ src/screens/RemindersScreen.js
            │  └─ ScreenHeader + AppContext + src/services/notifications.js + constants
            ├─ src/screens/ExportDataScreen.js
            │  └─ Button + ScreenHeader + AppContext + src/services/export.js + constants
            │     └─ src/services/doctorReport.js
            ├─ src/screens/PreferencesScreen.js
            │  └─ Button + ScreenHeader + AppContext + constants
            ├─ src/screens/DailyCheckInScreen.js
            │  └─ Button + src/components/Card.js + Motion + AppContext
            │     + constants + dateKey + helpers
            ├─ src/screens/FoodScreen.js
            │  └─ Button + Card + Motion + ScreenHeader + AppContext + constants + dateKey
            ├─ src/screens/MovementScreen.js
            │  └─ Button + Card + Motion + ScreenHeader + AppContext + constants + dateKey
            ├─ src/screens/DoctorReportScreen.js
            │  └─ Button + Card + Motion + AppContext + doctorReport + export + constants
            ├─ src/screens/ProfileScreen.js
            │  └─ Button + Card + ScreenHeader + AppContext + AuthContext + constants
            └─ src/navigation/MainTabNavigator.js
               ├─ BrandMark + Motion + constants
               ├─ src/screens/TodayScreen.js
               │  └─ BrandMark + Button + Card + Motion + AppContext
               │     + dailyPlan + constants + dateKey
               ├─ src/screens/TimelineScreen.js
               │  └─ Motion + AppContext + constants + dateKey
               ├─ src/screens/MegScreen.js
               │  └─ BrandMark + Motion + AppContext + src/services/meg.js + constants
               │     ├─ firebase
               │     └─ src/services/megUrlPolicy.js
               ├─ src/screens/InsightsScreen.js
               │  └─ src/components/ArticleCard.js + Button + Card + Motion
               │     + ScreenHeader + AppContext + content
               │     + src/services/insights.js + constants
               └─ src/screens/DietScreen.js
                  └─ constants
```

The graph contains 52 repository JavaScript modules. Dormant files not imported
by this path are outside startup evaluation.

## Import-time and startup side effects

| Location | Timing | Side effect |
| --- | --- | --- |
| `index.js` | Module evaluation | Calls `installGlobalErrorHandler()`, calls `setStartupStage('app-mounted')`, and registers `BloomBootstrap`. |
| `startupDiagnostics.js` | Called by entry/auth/app/navigation | Writes the stage and sanitised failure record to AsyncStorage. A recorded failure is also logged in sanitised form. |
| `src/services/notifications.js` | First notification operation | Configures the notification handler inside a guarded idempotent function. Importing Reminders performs no native notification call. |
| `src/context/AuthContext.js` | Provider effect | Initializes Firebase Auth and Firestore and registers `onAuthStateChanged`. |
| `src/context/AppContext.js` | Provider render/effects | Calls `storage.setUserScope(user.uid)` during render, then reads Firestore and account-scoped AsyncStorage in an effect. |
| `RootNavigator.js` | Signed-in mount/effects | Adds an `AppState` listener and calls native screen-capture allow/prevent APIs. |
| `SplashScreen.js` | Mount effect | Starts native-driver animations; navigation waits for the signed-in splash to complete. |
| `RemindersScreen.js` | Screen mount | Creates the Android notification channel. Permission is requested only from the screen’s user flow. |
| `src/services/meg.js` | First Meg send, not import | Lazily creates the default provider, resolves the Meg URL, obtains a Firebase ID token, and starts the network request. |

Creating styles, contexts, navigator objects, constant sets, and static option
arrays also occurs during evaluation but does not perform storage, network,
permission, or user-data work.

Eager evaluation also imports the native-facing packages used by screen
capture, notifications, local authentication, file export, sharing, safe-area
handling, SVG, and vector icons. Their user-facing operations are deferred as
listed above; all optional native operations are deferred.

## Configuration dependencies

| Dependency | When checked or used | Failure behaviour |
| --- | --- | --- |
| Six `EXPO_PUBLIC_FIREBASE_*` Web App values | Firebase module evaluation and AuthProvider initialization | Missing values produce the generic `configuration-check` diagnostic. Values are public client configuration, never Admin credentials. |
| `EXPO_PUBLIC_MEG_API_URL` | Default Meg provider creation on the first message | Local development may fall back to loopback HTTP. A non-development build rejects missing, non-HTTPS, localhost, loopback, private-LAN, link-local, and other non-public addresses. |
| EAS `preview` environment | At EAS build time | A local ignored `.env.preview` file is not evidence that the remote EAS environment is complete. Verify EAS environment variables before each build. |
| `app.json` | Native build/config resolution | Current Android package is `com.bloomhealth.app`, version is `1.0.2`, version code is `3`, keyboard mode is `resize`, and notification/local-authentication plugins are enabled. |
| Deployed Node backend | First Meg request, not application startup | Must be public HTTPS for preview/production, healthy, configured for Firebase Admin/token verification, and reachable under its production CORS policy. |

Backend secrets such as Firebase Admin credentials and the model-provider API
key must remain server-side. They are not application startup inputs and must
never use an `EXPO_PUBLIC_*` name.

## Crash and stall points

| Point | Current containment | Remaining limitation |
| --- | --- | --- |
| Native process, Android manifest/plugin, Java/Kotlin, or JS-engine load | None in JavaScript | Can close or remain blank before Bloom can render a diagnostic. Requires Logcat/native build evidence. |
| `index.js` imports of React, React Native, Expo’s registration helper, AsyncStorage-backed diagnostics, or diagnostic UI | These occur before `loadBloomApplication()` | A failure here precedes the App import `try/catch`. The Expo helper is imported through the internal `expo/build/launch/registerRootComponent` subpath and is version-sensitive. |
| Persisted startup-failure restore | `loadLastStartupFailure()` catches storage/JSON failures | A valid stored failure intentionally blocks normal loading until Retry clears it. A stale record can therefore look like a repeated startup failure. |
| App static import graph | `loadBloomApplication()` catches evaluation errors | The graph is broad because all stack/tab screens are imported eagerly; any unsupported module can prevent App from loading. |
| React render/lifecycle | `StartupErrorBoundary` records and displays a sanitised failure | React boundaries do not catch every event-handler or arbitrary asynchronous error; the global native handler is the fallback when available. |
| Firebase config/init | Explicit key check and caught initialization | Native persistence requires `getReactNativePersistence` in the installed Firebase build. Failure is recoverable only after configuration/code is corrected and Retry is used. |
| Firebase auth listener error | Listener error callback ends initialization and clears the user | It does not create a startup diagnostic; the user may see Auth instead of the underlying listener cause. |
| Signed-in account-data reads | `loadInitialData()` catches and always clears `isLoading` | Navigation can open with an error save state and partial/default data. This is recoverable UI, not a fatal-startup diagnostic. |
| Splash completion | Data load has a `finally`; native and React splash layers have guarded four-second fallbacks | A low-end device still needs real timing verification. Auth bootstrap and the signed-in navigation splash are separate mounts, so cold signed-in startup can feel longer. |
| Notification handler registration | Deferred until a notification operation | Unsupported notification behavior cannot block the first usable screen merely because Reminders is registered. |
| Screen-capture policy | Native call is caught | Failure leaves preview protection unavailable and emits only a generic warning. |
| Meg URL/provider/backend | Deferred until first send and surfaced as a Meg request error | App startup can pass even when Meg’s build-time URL or deployed backend is unusable. Meg needs an independent release gate. |

## Platform behaviour

| Platform | Current path |
| --- | --- |
| Android | Uses Firebase React Native persistence backed by AsyncStorage, `softwareKeyboardLayoutMode: resize`, safe-area context at the app root, Android notification-channel setup, native screen-capture controls, and local authentication. Preview/production Meg traffic must use public HTTPS; no cleartext exception is configured. |
| iOS | Uses the same React Native Firebase persistence branch and safe-area provider. Android notification-channel setup is skipped. Native screen capture and local authentication remain native-module dependencies. |
| Web | Uses Firebase browser local persistence. Screen-capture calls are skipped. Reduced-motion and clipboard access are guarded through `globalThis`; diagnostic copy is shown only when a clipboard API exists. Local loopback Meg development remains allowed. |
| Production bundle | Expo is expected to replace direct dot-notation `process.env.EXPO_PUBLIC_*` access at build time and set `__DEV__` false. Production URL validation then requires public HTTPS. The release build must verify the resolved environment rather than relying on development behaviour. |

## Current source mitigations and resolved issues

- The custom entry point defers App evaluation until persisted startup state has
  been checked and catches failures from the full App import graph.
- Startup failures are normalised to a known stage and sanitised before
  persistence, logging, display, or clipboard copy. Bearer values, Firebase-like
  keys, JWT-shaped tokens, credential assignments, emails, and URLs are
  redacted.
- Retry clears the persisted failure before attempting App or Firebase startup
  again.
- Firebase configuration is checked explicitly and Firebase initialization is
  performed in the AuthProvider effect under a caught result instead of as an
  uncontained module-level initialization.
- Firebase Auth persistence has explicit web and React Native branches.
- UID-scoped local storage uses versioned keys, safely migrates the prior scoped
  format, discards malformed JSON, and normalises wrong-shaped collections.
- Notification handler registration is lazy and guarded.
- Native and React splash hiding is caught and has a four-second fallback.
- Signed-out readiness and navigation readiness both clear the stored startup
  failure through `markStartupReady()`.
- Meg’s default provider is lazy. Importing `MegScreen` no longer requires a
  backend connection, and its production URL policy rejects loopback, private
  network, non-HTTPS, and missing endpoints before a request is sent.
- Platform globals used for reduced motion and diagnostic clipboard support are
  guarded.

These mitigations narrow the blank-screen surface; they do not replace a native
APK launch test.

## Physical-device release risks

- No final approved APK or final build link is recorded.
- The current native package/config/plugin combination has not been verified by
  this audit on a physical Android phone.
- Early native failures and pre-bootstrap `index.js` import failures still need
  Logcat; the in-app diagnostic cannot cover them.
- Remote EAS preview variables may differ from ignored local environment files.
- Firebase Auth persistence, AsyncStorage restoration, native notifications,
  local authentication, file sharing, screen capture, SVG, and vector icons all
  require validation in the built APK.
- The two-stage auth/navigation splash path needs cold-start timing on a low-end
  phone.
- A stored diagnostic survives an ordinary restart and requires Retry or a
  successful readiness transition to clear.
- Meg can fail independently after startup because its provider, backend health,
  Firebase token verification, network policy, and HTTPS reachability are
  exercised only on message send.
- Keyboard resize, gesture navigation, three-button navigation, cutouts,
  background/foreground transitions, offline launch, and large font scale are
  not established by static startup inspection.
- The historical `44a0c081-0281-46ed-a3ec-06967f6268af`,
  `87a97dbe-76e0-4f84-8bc8-1f4bafd2b39b`, and
  `93a6a190-445f-4cec-9263-f492e58fc046` artifacts are
  deprecated and must not be used as evidence for the current source baseline.

## Required verification against the next APK

1. Record the clean source commit and resolved public Expo config.
2. Verify the remote EAS preview environment without printing values.
3. Complete typecheck, tests, Expo Doctor, and Android export validation.
4. Build a fresh preview APK and record its EAS ID, package, version, version
   code, signing continuity, file size, and SHA-256.
5. Install it on a physical Android device.
6. Test cold signed-out and cold signed-in startup, offline startup, persisted
   auth, an intentionally unavailable Meg backend, background/foreground,
   notification-channel creation, and app-lock/screen-capture flows.
7. Capture Logcat for any close/blank-screen failure and the in-app diagnostic
   for any contained failure.
8. Complete the smoke-test record in
   [BETA_INSTALLATION.md](./BETA_INSTALLATION.md) before adding a build link.
