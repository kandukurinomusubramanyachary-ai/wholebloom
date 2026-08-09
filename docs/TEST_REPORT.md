# Bloom 1.1.0 Beta test report

Report date: 2026-07-30

This matrix records the evidence available before the final Android preview
artifact was ready. EAS build `91d23bd9-a1e6-4797-a77f-329d9103f3a4` was still
`IN_QUEUE` when this report was written. It has not been installed, launched,
or accepted on a physical device, and this report does not treat a JavaScript
export as an APK test.

## Status definitions

- `PASSED`: the stated logic or configuration scope was exercised by an
  automated test, static release check, or platform export with a real
  successful result. The evidence column names that scope.
- `FAILED`: the test ran and did not meet its expected result.
- `BLOCKED`: the test could not be completed because a required artifact or
  test facility was unavailable.
- `REQUIRES PHYSICAL`: the remaining acceptance criterion is an interaction or
  rendering check on real Android or iPhone hardware. Partial automated
  evidence is noted but does not replace the device test.

## Evidence snapshot

- `npm test`: 95 tests completed successfully, 0 failures.
- `npm run typecheck`: completed successfully.
- `npx expo-doctor`: 17 of 17 checks completed successfully.
- Android, iOS, and web Expo exports completed successfully.
- The configured local/preview-file public HTTPS Meg endpoint returned HTTP 200
  from `GET /health`; no token or message was sent.
- Firestore rules emulator tests could not run because Java was absent
  (`spawn java ENOENT`). No Firestore emulator result is claimed.
- Android Debug Bridge was unavailable, so no connected-device test ran.
- In-app browser automation could not start because its runtime metadata was
  missing `sandboxPolicy`; no responsive-browser interaction is claimed.
- Final Android EAS preview build
  `91d23bd9-a1e6-4797-a77f-329d9103f3a4` was `IN_QUEUE`; no APK result is
  claimed.

## Required 50-case matrix

| # | Test case | Status | Evidence and remaining scope |
| ---: | --- | --- | --- |
| 1 | Fresh Android install | BLOCKED | The final EAS build was still queued, so no final APK existed to install; Android Debug Bridge was also unavailable. |
| 2 | Existing Android install/upgrade | BLOCKED | There was no completed 1.1.0 APK to install over an existing Bloom version. Upgrade data retention and launcher refresh remain untested. |
| 3 | Fresh iOS state | BLOCKED | The iOS export completed, but no signed iOS build or device installation was available. |
| 4 | Existing storage state | PASSED | `mobileStorage.test.js` exercised versioned UID-key migration, malformed JSON removal, structurally invalid collections, and controlled storage fallbacks. This is data-layer scope, not a native upgrade install. |
| 5 | Signed-out launch | REQUIRES PHYSICAL | Platform exports completed and startup guards are covered statically, but a signed-out cold launch of the final native binary has not run on hardware. |
| 6 | Sign up | REQUIRES PHYSICAL | The real Firebase sign-up flow, validation, keyboard, and navigation have not been exercised on a phone. |
| 7 | Log in | REQUIRES PHYSICAL | The real Firebase login flow and post-login navigation have not been exercised on a phone. |
| 8 | Authenticated restart | REQUIRES PHYSICAL | Auth restoration is guarded in source, but force-close and cold-restart restoration of a real signed-in installation remains untested. |
| 9 | Offline launch | REQUIRES PHYSICAL | Local storage fallbacks have automated coverage, but airplane-mode cold launch of the native app remains untested. |
| 10 | Firebase unavailable | BLOCKED | A controlled end-to-end Firebase outage was not executed. The Firestore emulator could not run without Java, and browser automation was unavailable. |
| 11 | Meg unavailable | PASSED | `megLocalQueue.test.js`, `mobileStorage.test.js`, and `uiHardening.test.js` verify failed-delivery retention, recoverable retry data, UID-scoped persistence, and non-loss UI safeguards. This is failure-state logic scope. |
| 12 | Diet backend unavailable | PASSED | `dietFeature.test.js` explicitly verifies that an unavailable optional backend falls back to three local suggestions. |
| 13 | Open every tab | REQUIRES PHYSICAL | `uiHardening.test.js` confirms the five routes are Today, Timeline, Meg, Insights, and Diet; opening and rendering each native screen remains a device test. |
| 14 | Log a period | REQUIRES PHYSICAL | Period validation and prediction logic have automated coverage, but entering and saving a period through the native UI has not run on hardware. |
| 15 | Edit a period | REQUIRES PHYSICAL | `periodTracking.test.js` verifies edit merge, field preservation, and overlap validation at model level; the native edit interaction remains untested. |
| 16 | Delete a period | REQUIRES PHYSICAL | `periodTracking.test.js` verifies deletion of the intended immutable model entry; the confirmation and persisted native UI flow remain untested. |
| 17 | Restart persistence | REQUIRES PHYSICAL | Versioned local persistence has automated coverage, but force-close/relaunch persistence for period, Diet, and Meg state has not been verified on a phone. |
| 18 | Local Diet suggestions | PASSED | `dietFeature.test.js` exercises the offline/local engine, exact three-result contract, ingredient combinations, preferences, allergy exclusions, and safe fallback behavior. |
| 19 | Save a meal | REQUIRES PHYSICAL | `mobileStorage.test.js` covers meal persistence and `uiHardening.test.js` covers mutation error isolation; the Diet screen save interaction and native restart result remain untested. |
| 20 | Add an after-meal reflection | REQUIRES PHYSICAL | `dietData.test.js` verifies reflection hydration only affects the matching meal, and storage tests retain reflections; the native reflection form remains untested. |
| 21 | Open Meg | REQUIRES PHYSICAL | Meg source and exports validate structurally, but the screen has not been opened in the final native binary. |
| 22 | Send a Meg message | REQUIRES PHYSICAL | Backend tests cover token verification and safe persistence, but a real Firebase-authenticated message has not been sent from a physical Beta installation to the configured production backend. |
| 23 | Retry a Meg message | REQUIRES PHYSICAL | `megLocalQueue.test.js` verifies an idempotent retry request can be rebuilt from the failed final message; the visible retry action and real network recovery still require hardware. |
| 24 | Log out | REQUIRES PHYSICAL | Logout, navigation reset, and signed-out state have not been exercised on hardware. |
| 25 | Log in as another account | REQUIRES PHYSICAL | The two-account authentication sequence has not been exercised on hardware. |
| 26 | Account data isolation | PASSED | `mobileStorage.test.js` verifies meal logs, reflections, and Meg retry state stay isolated across UID scope changes. Firestore enforcement still lacks emulator execution because Java is absent. |
| 27 | Long display name | REQUIRES PHYSICAL | `uiHardening.test.js` verifies preferred-name normalization and a 32-character cap; actual truncation, wrapping, and accessibility-font rendering remain device checks. |
| 28 | Android 320 px width | REQUIRES PHYSICAL | No 320 px Android hardware rendering was performed. Browser viewport automation was unavailable because of the missing `sandboxPolicy` runtime metadata. |
| 29 | Android 360 px width | REQUIRES PHYSICAL | No 360 px low-cost Android device rendering or interaction test was performed. |
| 30 | Android 390 px width | REQUIRES PHYSICAL | No 390 px Android device rendering or interaction test was performed. |
| 31 | Android 412 px width | REQUIRES PHYSICAL | No 412 px Android device rendering or interaction test was performed. |
| 32 | iPhone SE width | REQUIRES PHYSICAL | The iOS export completed, but the app was not installed or rendered on an iPhone SE-sized physical device. |
| 33 | Standard iPhone width | REQUIRES PHYSICAL | The iOS export completed, but no standard-width physical iPhone test ran. |
| 34 | Large iPhone width | REQUIRES PHYSICAL | The iOS export completed, but no large-width physical iPhone test ran. |
| 35 | Large font/accessibility text | REQUIRES PHYSICAL | Some navigation labels cap scaling defensively, but system large-text layout and touch-target behavior have not been checked on hardware. |
| 36 | Android hardware Back | REQUIRES PHYSICAL | Hardware Back behavior and route exit ordering have not been tested on an Android phone. |
| 37 | iOS swipe-back | REQUIRES PHYSICAL | Interactive swipe-back gestures have not been tested on an iPhone. |
| 38 | Mobile keyboard | REQUIRES PHYSICAL | Static checks confirm keyboard-avoidance and keyboard-aware tab behavior in Meg and Diet; real Android/iOS keyboard resize, focus, and text entry remain untested. |
| 39 | Rapid taps | REQUIRES PHYSICAL | Send locking exists in Meg source, but rapid navigation, save, submit, and retry tapping has not been stress-tested on hardware. |
| 40 | Background and resume | REQUIRES PHYSICAL | App suspension, process pressure, resume, and restored navigation/input state have not been exercised on hardware. |
| 41 | Month boundary | PASSED | `periodTracking.test.js` exercises local calendar-date prediction across month transitions without fixed 28-day assumptions. |
| 42 | Year boundary | PASSED | `periodTracking.test.js` explicitly verifies December-to-January cycle calculation and the resulting next-period date. |
| 43 | Leap year | PASSED | `periodTracking.test.js` explicitly verifies leap-day history and a March 28 prediction from a 28-day interval. |
| 44 | Timezone near midnight | PASSED | `periodTracking.test.js` verifies device-local date keys immediately before and after midnight and preserves ISO leap-day keys. |
| 45 | Splash timeout | PASSED | `startupHardening.test.js` verifies guarded native splash handling and the 4,000 ms timeout in both entry and Bloom splash code. This is source-level timeout coverage. |
| 46 | Startup diagnostic stages | PASSED | `startupHardening.test.js` verifies the complete sanitized startup-stage sequence from native entry through first screen and splash hidden. |
| 47 | Approved Bloom logo configuration | PASSED | `app.json` points Android, adaptive, splash, iOS/general icon, and web favicon configuration at the approved Bloom derivatives; all three platform exports completed. Installed launcher rendering is intentionally not claimed. |
| 48 | No old logo references in active source/config | PASSED | The branding source/config audit removed active old-logo references and platform exports resolved the current assets. Launcher caching on upgrade remains part of case 2. |
| 49 | No old build/install links in active release surfaces | PASSED | Deprecated build IDs are retained only in `docs/DEPRECATED_BUILDS.md` and audit history, with explicit do-not-distribute labels; no active installer link points testers to those builds. |
| 50 | No localhost release URL in final Android binary | BLOCKED | URL-policy tests reject loopback/private production Meg endpoints, while documented localhost values remain intentionally development-only. The queued build produced no APK to inspect, so the final binary claim cannot yet be made. |

## Summary

| Status | Count |
| --- | ---: |
| PASSED | 14 |
| FAILED | 0 |
| BLOCKED | 5 |
| REQUIRES PHYSICAL | 31 |
| **Total** | **50** |

The automated suite and platform exports establish useful logic, startup, and
configuration coverage, but they do not make Bloom 1.1.0 device-approved. The
next acceptance pass must wait for the EAS build to finish, inspect the exact
APK, and execute every `REQUIRES PHYSICAL` case on representative Android and
iPhone hardware. Firestore emulator coverage also remains blocked until a Java
runtime is available.
