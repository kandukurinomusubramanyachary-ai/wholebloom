# Bloom 1.1.0 overnight release record

Report date: 2026-07-30  
Branch: `overnight-cross-platform-hardening`

This is an evidence-based record of the overnight hardening pass. It separates source, automated, export, cloud-build, and physical-device evidence. The final Android preview build was still queued when this record was written, so Bloom 1.1.0 is not yet approved for tester distribution.

## 1 Executive summary

Bloom was prepared as a 1.1.0 cross-platform Beta candidate without an Expo SDK, React Native, Firebase-project, authentication, Meg-personality, or backend-behaviour migration. The pass hardened startup failure handling, aligned approved branding across configured native/web surfaces, consolidated existing design tokens, strengthened period tracking, completed a local-first Diet feature, improved Meg delivery recovery, and polished the existing home/profile flows.

The final automated suite passed 95 of 95 tests, TypeScript completed successfully, Expo Doctor passed 17 of 17 checks, and Android, iOS, and web exports completed. Those results validate source and bundles, not a native installation. Android build `91d23bd9-a1e6-4797-a77f-329d9103f3a4` remains `IN_QUEUE`; Firestore emulator tests are blocked by missing Java; no final APK, iOS cloud build, public web deployment, or physical-device acceptance result exists.

## 2 Likely reason other testers received a crashing Android build

The strongest verified explanation is artifact confusion: three obsolete APKs remained locally and historical EAS links are immutable. Those artifacts were versions 1.0.0/code 1, 1.0.1/code 2, and diagnostic 1.0.2/code 3, all predating the current 1.1.0 startup hardening; one historical build also lacked the current Meg preview endpoint. A tester using an old QR code or link would continue receiving that old binary even after newer source changes.

The baseline also had a broad eager import/startup surface, native operations that could fail before the first usable screen, configuration failures that were not consistently contained, and older persistence/error paths. These were credible crash or blank-screen risks, but no physical-device Logcat from the affected tester was available, so no single native crash cause is claimed as confirmed.

## 3 Confirmed startup issues

- Application evaluation depended on a broad eager screen/module graph.
- Firebase configuration and authentication bootstrap failures needed a contained, user-visible failure path.
- Native splash and notification operations needed guards so an optional/native failure could not indefinitely block the first usable screen.
- Persisted data needed safe handling for malformed JSON, wrong-shaped collections, legacy keys, and UID changes.
- Release Meg configuration could not safely fall back to localhost or a private-network endpoint.
- Failures before the JavaScript diagnostic bootstrap remain outside JavaScript containment and still require native logs.

## 4 Startup fixes

- Added staged, sanitised startup diagnostics and a recoverable diagnostic screen.
- Added a startup error boundary and persisted failure record with Retry clearing.
- Guarded native splash calls and added a 4,000 ms fallback timeout.
- Deferred notification-handler registration until notification functionality is used.
- Changed Firebase startup to a caught, lazy singleton/bootstrap path.
- Ensured signed-out readiness and navigation readiness clear stale startup failures.
- Added safe storage migration, normalisation, malformed-record removal, and UID-scoped keys.
- Kept account-data or Meg remote failures from permanently blocking locally available app state.

The diagnostic cannot display failures that occur during the native process, manifest/plugin loading, JavaScript engine startup, or the earliest imports before Bloom's diagnostic code can execute.

## 5 Environment-variable fixes

Bloom continues to use the existing Firebase Web App public configuration and the existing Meg production endpoint variable. The release checks now distinguish local development from release URL policy:

- Development may use its explicitly configured environment.
- Preview/production Meg configuration must be public HTTPS.
- Missing, non-HTTPS, localhost, loopback, link-local, and private-LAN release endpoints are rejected.
- No Firebase Admin credential, model-provider secret, or other server secret was moved into `app.json`, `eas.json`, or an `EXPO_PUBLIC_*` variable.

The local environment and EAS preview environment each have all seven required public variables. The EAS production environment has none of the seven and is not ready for a store build.

## 6 Firebase/Auth persistence findings

Firebase project configuration, Firebase Authentication semantics, and Meg Firebase ID-token verification were preserved. Web uses browser local persistence; React Native uses AsyncStorage-backed native Firebase persistence through the installed SDK path. Initialization and listener failures are caught so the app can reach a controlled state instead of remaining indefinitely on startup.

Device records use versioned UID-scoped keys. In-memory app state resets when the active UID changes, legacy scoped keys migrate on read, malformed JSON is discarded, and remote hydration verifies the active UID before applying data. Automated tests cover storage isolation, but authenticated cold restart and two-account switching still require a real-device pass.

## 7 Android compatibility work

- Preserved Android application ID `com.bloomhealth.app` and EAS project identity.
- Set Bloom 1.1.0 with Android `versionCode` 4.
- Kept portrait orientation and configured `softwareKeyboardLayoutMode` as `resize`.
- Configured light status/navigation bars and the existing `#FFFDFE` background.
- Retained safe-area handling at the application root.
- Configured a centred adaptive foreground with mask-safe measured margin.
- Kept the preview profile as an installable APK and production as an AAB.
- Android Expo export passed with 1,572 modules bundled.

No final 1.1.0 APK was available for installation, ADB was unavailable, and no hardware keyboard, navigation, background/resume, low-width, or launcher-mask result is claimed.

## 8 iOS compatibility work

- Preserved bundle identifier `com.bloom.app`.
- Set Bloom 1.1.0 with iOS `buildNumber` 2.
- Kept portrait orientation and iPhone-only Beta support (`supportsTablet: false`).
- Preserved safe-area, authentication, local storage, app-lock, and notification platform branches.
- Configured the approved general icon and native splash through Expo.
- iOS Expo export passed with 1,570 modules bundled.

No simulator/device run, signed archive, provisioning check, or iOS cloud build was performed.

## 9 iPhone distribution status

Not ready. No iOS EAS build was started because Apple Developer/App Store Connect credentials and signing prerequisites were not verified and the EAS production environment is missing all seven required public variables. There is no TestFlight build or install link.

## 10 Web/PWA fallback status

The web export passed with 1,093 modules. A local development server returned HTTP 200 for the root and Metro bundle, confirming that the development web bundle could be served. Automated in-app browser interaction was blocked because the browser runtime metadata was missing `sandboxPolicy`.

No hosting target was connected, no public deployment was made, no public web URL exists, and no offline/PWA install claim is made.

## 11 Files removed

Exactly 13 conclusively generated or retired local files were removed:

1. `Bloom-preview-44a0c081.apk`
2. `Bloom-preview-87a97dbe.apk`
3. `Bloom-diagnostic-preview-93a6a190.apk`
4. `eas-build.log`
5. `eas-build.log.gz`
6. `eas-build-decoded.log`
7. `eas-build-readable.log`
8. `eas-build-details.json`
9. `.expo-web-run.stderr.log`
10. `.expo-web-run.stdout.log`
11. `.expo-web.stderr.log`
12. `.expo-web.stdout.log`
13. `firebase-debug.log`

The three removed APKs remain documented by immutable build ID, size, and hash in `docs/DEPRECATED_BUILDS.md`.

## 12 Files retained because deletion was uncertain

`.expo/` was retained because it contained the current Expo session/screenshots needed during validation. `dist/` was retained temporarily as the generated platform-export evidence. `node_modules/` was retained because the final checks and queued EAS workflow still depended on the installed tree.

Six dormant source files were retained because product intent was uncertain: `FlowSelector.js`, `MoodSelector.js`, `SymptomPicker.js`, `InsightCard.js`, `ProgressRing.js`, and `LearnScreen.js`. The disconnected Beta eligibility/launch-email subsystem and its documentation/tests were also retained as one coherent historical feature; piecemeal deletion could break an operator workflow. Existing `.env` and `.env.preview` files remained ignored and were not copied into tracked source.

## 13 Dependencies removed or changed

- Added Expo SDK 51-compatible `expo-splash-screen ~0.27.7`.
- Added Expo SDK 51-compatible `expo-clipboard ~6.0.3`.
- Removed confirmed-unused `react-native-calendars`.
- Updated the lockfile through `npm install`.
- Did not upgrade Expo SDK 51, React Native 0.74.5, React 18.2.0, or any major dependency.

The final install reported the dependency tree up to date and zero vulnerabilities, with peer warnings noted but no install failure.

## 14 Approved logo source used

The canonical source is `assets/bloom-logo-approved.png`, byte-identical to the user-supplied source:

- Dimensions: 926 × 558
- Size: 167,783 bytes
- SHA-256: `DA9D34D38A5139F1E5FA456856A4D8C6846AA80EF9EA11E29FE71EE0928E9A28`

The hash-pinned generator creates the launcher icon, adaptive foreground, favicon, splash, lotus crop, and lockup deterministically. No logo was generated, traced, recoloured, or invented.

## 15 Old logo references removed

The transitional duplicate master `bloom-logo-final.png`, stale nonexistent `bloom-mark.svg` documentation, hand-drawn runtime lotus/wordmark rendering, and generic Profile flower branding were removed from active branding use. Active Expo/runtime references resolve to derivatives of the approved hash-pinned source. The final active branding/build-reference scan found zero stale active references.

Historical names remain only where an audit needs to explain provenance; that is not an active runtime/config reference.

## 16 Splash changes

The native splash uses the approved Bloom lockup on `#FFFDFE`, `contain` resize, and a centred 1242 × 2436 opaque asset. The React splash now uses deterministic approved artwork, and both native and React splash completion paths are guarded by a four-second fallback.

Native-to-React continuity and timing on a low-end phone remain unverified.

## 17 Android icon changes

`app.json` uses `assets/icon.png` for the general icon and `assets/adaptive-icon.png` as a transparent adaptive foreground on `#FFFDFE`. The 1024 × 1024 lotus is centred; the adaptive artwork's measured maximum visible radius stays inside the generator's safe-radius limit. Circular and rounded-square OEM launcher masks still require physical-device verification.

## 18 iOS icon changes

The Expo general icon now resolves to the 1024 × 1024 opaque approved Bloom derivative. The configured display name is exactly `Bloom`. The iOS export resolved the asset successfully, but App Store processing and installed iPhone appearance are not verified.

## 19 Design-system changes

Existing Bloom colours, typography, spacing character, and navigation patterns were preserved. Shared constants were consolidated into the current design-token source, including missing semantic colours, spacing/typography roles, focus state, motion distance, and elevation. Existing Button, Card, and branding components were aligned to those tokens. Reduced-motion handling prevents decorative press/focus scaling where the platform asks for reduced motion.

No new component library, colour palette, typography family, or navigation model was introduced.

## 20 Period-tracking changes

- Added explicit validation for start/end order, duplicate starts, overlapping ranges, malformed dates, edits, and deletes.
- Preserved immutable identity while editing and deleting the intended entry.
- Derived predictions from valid logged intervals with newer intervals weighted more heavily rather than forcing a fixed 28-day cycle.
- Used device-local calendar date keys to avoid UTC-midnight date shifts.
- Added confidence and data-point metadata and ignored conflicting/invalid logs.
- Kept predictions unavailable until at least two usable period starts exist.
- Added automated coverage for month/year transitions, leap day, near-midnight timezone keys, irregular cycles, malformed input, duplicates, overlaps, edits, and deletes.

Predictions remain estimates, and complete entry/edit/delete persistence still needs device verification.

## 21 Diet feature implemented

Diet is an optional, local-first practical meal companion using the existing Bloom aesthetic:

- Optional dietary preference, allergy/intolerance, dislike, religious/cultural exclusion, cooking setup, time, budget, and goal settings.
- Searchable ingredients, free text, recent/favourite ingredients, and clear-all.
- Exactly three deterministic local suggestions, including Indian foods and common combinations.
- Preference/allergy filtering, including compound terms such as `chicken biryani` and `peanut butter`.
- Safe fallback to three local suggestions when an optional server result is unavailable or invalid.
- Saved ideas, “I ate this,” meal history/delete, after-meal reflection, and descriptive observations.
- Observations require sufficient reflected meals and explicitly avoid causal claims.
- UID-scoped local persistence, background Firestore hydration, timestamp merge, hydration revision guards, and deletion tombstones to prevent offline-deleted meals from returning.
- Meal save/delete success is independent of a derived daily-plan refresh failure.

No medical diagnosis or causal food-health claim was added. Native narrow-width and keyboard behaviour remain physical-device checks.

## 22 Meg changes

- Preserved the existing Meg system prompt, personality, backend protocol, Firebase ID-token verification, and server source of truth.
- Added symptom, cycle, mood, food, and pattern conversation starters.
- Added message timestamps, selectable text, and copy using `expo-clipboard`.
- Added 30-message pagination with position preservation.
- Added send locking and duplicate prevention.
- Persisted pending/failed delivery state in UID-scoped storage.
- Retained the user's text on failure and rebuilt idempotent retries with the same message ID.
- Preserved loading, typing, offline, feedback, memory, and clear-history behaviours.

The configured local/preview-file public HTTPS backend returned HTTP 200 from `GET /health` without a token or message. A real Firebase-authenticated message to the production Meg provider from the final APK has not been tested.

## 23 Home/profile changes

Today and Profile now derive a safe preferred display name, use the first usable token, and enforce bounded lengths. Editing the preference changes only `preferredName`; it does not overwrite Firebase identity or the account name.

The existing bottom navigation is exactly Today, Timeline, Meg, Insights, and Diet. Profile remains in the stack rather than replacing a tab. The approved lotus is used consistently, and reduced-motion settings avoid press/focus scale effects. Long-name and final physical layout checks remain outstanding.

## 24 Firestore structures

Signed-in app data remains under the active user's `/users/{uid}` boundary:

| Data | Path |
| --- | --- |
| Profile | `/users/{uid}` |
| Cycle logs | `/users/{uid}/cycleLogs/{startDate}` |
| Check-ins | `/users/{uid}/checkIns/{date}` |
| Diet profile | `/users/{uid}/dietProfile/main` |
| Meal logs | `/users/{uid}/mealLogs/{mealId}` |
| Meal reflections | `/users/{uid}/mealReflections/{mealId}` |
| Diet observations | `/users/{uid}/dietObservations/{observationId}` |
| Meg conversations | `/users/{uid}/megConversations/{conversationId}` |
| Meg messages | `/users/{uid}/megConversations/{conversationId}/messages/{messageId}` |

The separate `/bloom_waitlist/{document}` collection was not migrated, linked to user accounts, changed, or exposed to clients.

## 25 Firestore rules changes

Local `firestore.rules` now has explicit authenticated-owner checks and schema/size/type bounds for cycle logs, check-ins, Diet profile, meals, reflections, and non-causal observations. Document IDs are tied to record identity where applicable. Root profile and Meg paths retain owner-only access but are not yet field-allowlisted.

The waitlist rules are unchanged. The modified rules were not deployed. The emulator suite did not run because Java is absent (`spawn java ENOENT`), so no rules-pass claim is made.

## 26 Privacy and security checks

- Firebase Admin credentials and provider secrets remain server-side.
- No token, Meg message content, symptom data, credential, or other secret was added to logging.
- Existing Firebase ID-token verification was not weakened.
- UID-scoped local storage and active-UID hydration checks prevent local cross-account reuse.
- Firestore application paths require authenticated ownership in the local rules.
- Waitlist clients still cannot read, update, or delete the collection.
- The tracked-file secret scan found zero real credentials and one documented placeholder.
- The local Meg URL passed the public-HTTPS policy; active application source contained no loopback release endpoint.

These are source/configuration findings. Firestore enforcement remains unverified until emulator tests pass and reviewed rules are deployed, and the final APK still needs a binary URL/secret inspection.

## 27 Tests added

The pass added or substantially expanded:

- `server/startupHardening.test.js`
- `server/mobileStorage.test.js`
- `server/periodTracking.test.js`
- `server/dietFeature.test.js`
- `server/dietData.test.js`
- `server/megLocalQueue.test.js`
- `server/uiHardening.test.js`
- `server/firestore.rules.test.js`
- Integration in `server/all.test.js`

The 50-case release matrix is recorded separately in `docs/TEST_REPORT.md`: 14 passed, 0 failed, 5 blocked, and 31 require a physical device.

## 28 Every validation command and actual result

| Command or check | Actual result |
| --- | --- |
| `npm install` | **PASS** — dependency tree up to date; zero vulnerabilities; peer warnings only. |
| `npx expo install --check` | **PASS** — dependencies up to date. Initial sandbox network attempt failed; the authorised network rerun passed. |
| `npx expo-doctor` | **PASS** — 17/17 checks. Initial cache/network attempt failed; the authorised network rerun passed. |
| `npm run typecheck` | **PASS** — TypeScript completed without errors. |
| `npm test` | **PASS** — 95/95 tests, 0 failures. |
| `node server/uiHardening.test.js` | **PASS** — 6/6 tests. |
| `npm audit --audit-level=high` | **PASS** — 0 vulnerabilities. |
| `npm run lint --if-present` | **NOT CONFIGURED** — the repository has no lint script. |
| `npx expo config --type public` | **PASS** — Bloom 1.1.0; Android `com.bloomhealth.app`/code 4; iOS `com.bloom.app`/build 2; EAS project ID unchanged. |
| `npx expo export --platform android --output-dir dist/android --clear` | **PASS** — Android bundle exported, 1,572 modules. |
| `npx expo export --platform ios --output-dir dist/ios --clear` | **PASS** — iOS bundle exported, 1,570 modules. |
| `npx expo export --platform web --output-dir dist/web --clear` | **PASS** — web bundle exported, 1,093 modules. |
| Local Expo web root and Metro bundle HTTP requests | **PASS** — HTTP 200 and successful Metro bundle. |
| Configured Meg `GET /health` request | **PASS** — public HTTPS endpoint returned HTTP 200 without sending a token or message; this is not an authenticated chat test. |
| In-app browser responsive/visual run | **BLOCKED** — browser runtime metadata was missing `sandboxPolicy`; no visual browser pass claimed. |
| `npm run test:rules` | **BLOCKED** — Firestore emulator could not start because Java is not installed (`spawn java ENOENT`). |
| `java -version` | **BLOCKED** — command not found. |
| `adb devices` | **BLOCKED** — command not found; no connected-device run. |
| `git diff --check` | **PASS** — no whitespace errors; line-ending warnings only. |
| Tracked-file secret scan | **PASS** — 0 real credentials; one documented placeholder. |
| Active branding/build-reference scan | **PASS** — 0 stale active references. |
| Release endpoint scan | **PASS (SOURCE/CONFIG SCOPE)** — local Meg URL classified `PUBLIC_HTTPS`; active app source contained no loopback endpoint. |
| EAS/local environment-name audit | **PASS AS AUDIT** — preview 7/7 present, production 0/7 present, local 7/7 present; no values printed. |
| `npx eas-cli@latest build --platform android --profile preview --clear-cache --non-interactive` | **STARTED, NOT COMPLETE** — build `91d23bd9-a1e6-4797-a77f-329d9103f3a4` accepted and currently `IN_QUEUE`. |

Sandbox/cache/network failures listed above were execution-environment failures followed by successful authorised reruns; they are not represented as product passes until the rerun actually completed.

## 29 Local Git commits

Validated local commits created in chronological order:

1. `6bf04b5` — `chore: snapshot Bloom before cross-platform hardening`
2. `16c7c83` — `fix: harden Bloom startup across platforms`
3. `41a46ea` — `fix: align Bloom platform branding and design system`
4. `35f5138` — `feat: strengthen Bloom period tracking`
5. `80805c0` — `feat: launch Bloom practical Diet companion`
6. `39b9487` — `feat: refine Meg cross-platform experience`
7. `041917b` — `fix: polish Bloom home and profile`
8. `45ef738` — `fix: keep Diet mutations independent of plan refresh`
9. `d102265` — `release: prepare Bloom 1.1.0 beta metadata`

The final report/test/data documentation was still uncommitted at the instant this record was authored and must be included in the final validated local commit.

## 30 Final version

`1.1.0`

The version is aligned in `app.json`, `package.json`, and the lockfile. It identifies the source candidate and does not imply device approval.

## 31 Android versionCode

`4`

This increments the previous diagnostic build's code 3.

## 32 iOS buildNumber

`2`

No archive using build number 2 has been created or uploaded.

## 33 EAS environment PRESENT/MISSING table

Only variable names and presence are recorded; values were neither copied nor printed.

| Variable | Local `.env` | EAS `preview` | EAS `production` |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | PRESENT | PRESENT | MISSING |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | PRESENT | PRESENT | MISSING |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | PRESENT | PRESENT | MISSING |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | PRESENT | PRESENT | MISSING |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | PRESENT | PRESENT | MISSING |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | PRESENT | PRESENT | MISSING |
| `EXPO_PUBLIC_MEG_API_URL` | PRESENT | PRESENT | MISSING |

Summary: local 7/7 PRESENT; preview 7/7 PRESENT; production 0/7 PRESENT.

## 34 Final Android build ID

`91d23bd9-a1e6-4797-a77f-329d9103f3a4` — `IN_QUEUE`.

This is the only final Android preview build started by this pass. It is not yet an approved artifact.

## 35 Android Expo installation link

**PENDING** — the final EAS build is still `IN_QUEUE`; no installation URL is recorded or inferred.

## 36 Android direct APK link

**PENDING** — no APK artifact exists yet, so no direct download URL is available.

## 37 Local Android APK path

**PENDING** — the queued build has not produced an APK to download.

## 38 Android APK SHA-256

**PENDING** — no final APK bytes exist locally to hash.

## 39 iOS EAS build ID, when created

Not created. No iOS EAS build was started.

## 40 TestFlight/App Store Connect status

Not started. No signed iOS archive was created, submitted, processed, or installed through TestFlight. App Store Connect access and app-record status were not verified.

## 41 Web beta URL or deployment status

No deployment. There is no public Bloom web Beta URL. Only a successful local Expo web export and local HTTP 200 smoke result are recorded.

## 42 Deprecated build IDs

| Build ID | Version/code | Status |
| --- | --- | --- |
| `44a0c081-0281-46ed-a3ec-06967f6268af` | 1.0.0 / 1 | **DO NOT DISTRIBUTE** — superseded and predates startup hardening. |
| `87a97dbe-76e0-4f84-8bc8-1f4bafd2b39b` | 1.0.1 / 2 | **DO NOT DISTRIBUTE** — lacks the current configured Meg preview endpoint. |
| `93a6a190-445f-4cec-9263-f492e58fc046` | 1.0.2 / 3 | **DO NOT DISTRIBUTE** — diagnostic artifact, not 1.1.0. |
| `bd638598-2d1b-44d9-9622-c9b6ee02bd64` | No artifact | **DO NOT DISTRIBUTE** — build ended `ERRORED`. |

Old EAS URLs and QR codes remain immutable and must not be reused.

## 43 Exact physical-device tests still required

- Install the final APK cleanly on a real low-cost Android phone, then install it over an existing Bloom build with retained test data; verify package/signing continuity and launcher refresh.
- Cold launch signed out; sign up; log in; force-close; authenticated cold restart; log out; log in as a second account; verify local and Firestore account isolation.
- Airplane-mode cold launch; Firebase-unavailable handling; Meg-unavailable handling; restore connectivity and confirm recovery without lost/duplicated data.
- Open Today, Timeline, Meg, Insights, Diet, and stack Profile/settings destinations.
- Add, edit, and delete periods across normal/month/year boundaries; restart and verify persistence.
- Complete a daily check-in; verify natural scrolling, keyboard access, bottom actions, final-question visibility, and persistence.
- Generate local Diet suggestions; save/delete meals; save reflections; inspect history/observations; restart and verify offline/local-first behaviour.
- Open Meg; send an authenticated live message; observe typing/reply; force a recoverable failure; restart; retry once; verify no duplicate and retained text.
- Exercise Android widths 320, 360, 390, and 412 px, including a cheap 360 px phone, gesture and three-button navigation, display cutouts, large font, keyboard, hardware Back, rapid taps, background/resume, and rotation lock.
- Verify approved launcher masks, native-to-React splash continuity, status/navigation bar contrast, and absence of any old logo on the installed Android build.
- On physical iPhones, repeat signed-out/authenticated startup and core flows at iPhone SE, standard, and large widths; verify large text, keyboard, safe areas, swipe-back, background/resume, splash, and icon.

No row above is treated as passed by an export or source-level test.

## 44 Known limitations

- Final Android build is queued; artifact, install URL, package/version inspection, checksum, and device smoke results are pending.
- Firestore rule changes are neither emulator-verified nor deployed because Java is absent.
- No ADB, Android device, iPhone, iOS simulator, or browser-controller visual pass was available.
- Production EAS environment is empty, blocking production Android and iOS builds.
- No lint configuration/script exists.
- Root profile and Meg Firestore documents have owner checks but no field allowlist.
- Early native/pre-diagnostic failures still require Logcat or iOS device logs.
- Final APK could still reveal native-only, OEM launcher, keyboard, safe-area, signing, environment, or low-memory issues not visible in exports.
- No public web host or web Beta URL exists.
- Deprecated Beta eligibility/launch-email code remains disconnected but retained pending an explicit product decision.

## 45 Remaining Apple Developer prerequisites

- Verify an active Apple Developer Program team and authorised account access.
- Verify or create the App Store Connect app record for `com.bloom.app`.
- Establish certificates, App Store distribution provisioning, and EAS signing access without storing credentials in the repository.
- Populate the required EAS production public variables.
- Confirm privacy disclosures, export-compliance answers, app metadata, screenshots, support/privacy URLs, and Beta review information.
- Run iPhone simulator and physical-device acceptance before creating/submitting the first App Store build.

## 46 Recommended next three beta actions

1. Wait for Android build `91d23bd9-a1e6-4797-a77f-329d9103f3a4` to reach a terminal state; if successful, download that exact APK, verify package/version/environment/branding, calculate SHA-256, and update the pending release records without reusing any old link.
2. Install that APK on a cheap 360 px Android phone and complete the full physical smoke matrix, including fresh/upgrade startup, auth/restart, period/check-in scrolling, Diet, Meg retry, keyboard, back navigation, offline recovery, and second-account isolation. Do not distribute if any P0/P1 result fails.
3. Install Java and run the Firestore emulator suite, review/deploy the intended rules to the correct Firebase project, then separately complete production environment and Apple signing prerequisites before considering Android store, iOS/TestFlight, or web distribution.
