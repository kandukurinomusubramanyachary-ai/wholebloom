# Bloom 1.1.0 Remaining Work

This file records only work that could not be completed or verified in the current environment. Bloom 1.1.0 must not receive final beta approval until the required physical-device checks below pass.

## Required before Android beta distribution

- [ ] Wait for the final EAS Android preview build to finish. Build `91d23bd9-a1e6-4797-a77f-329d9103f3a4` was still `IN_QUEUE` at the last verified check, so the Expo installation URL, direct APK URL, local APK path, APK SHA-256, and final APK inspection results remain pending.
- [ ] Install the final APK on at least one real low-cost Android phone. `adb` is unavailable in the current environment, so installation, launch, logcat, hardware-back, background/resume, and upgrade-path checks were not performed here.
- [ ] Run the Android physical smoke path: fresh install, existing-data upgrade, sign-up/sign-in, authenticated restart, period add/edit/delete, check-in, Diet save/reflection/history, Meg open/send/retry, logout, second-account isolation, offline launch, and recovery after connectivity returns.
- [ ] Test the UI at 320 px and 360 px widths on a real phone, including large font settings. Specifically verify safe-area insets, bottom navigation, final form fields, modal/sheet scrolling, no horizontal overflow, and that the software keyboard does not cover text inputs or actions.
- [ ] Run one authenticated live Meg provider smoke test against the intended beta backend. The local automated suite did not have a tester Firebase ID token and therefore did not verify a real provider response end to end.
- [ ] Install Java, run the Firestore emulator rules suite, and review the real result. Rules tests are currently blocked because Java is missing.
- [ ] Deploy the reviewed Firestore rules intentionally to the correct Firebase project before external testers depend on the new Diet and cycle paths. The rules were changed locally but were not deployed.

## Required before production or store builds

- [ ] Populate the EAS `production` environment. All seven required public variables are currently missing:
  - `EXPO_PUBLIC_FIREBASE_API_KEY`
  - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
  - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `EXPO_PUBLIC_FIREBASE_APP_ID`
  - `EXPO_PUBLIC_MEG_API_URL`
- [ ] Re-run release configuration and secret scans after the production variables are configured. The Meg URL must be public HTTPS and must not be localhost, loopback, or a private-LAN address.

## Required before iOS or TestFlight distribution

- [ ] Verify Bloom on an iPhone simulator and at least one physical iPhone, including iPhone SE width, a standard iPhone, a large iPhone, large text, safe areas, keyboard handling, swipe-back, background/resume, period tracking, Diet, and Meg.
- [ ] Provide or verify Apple Developer access, App Store Connect access, certificates, provisioning profiles, and the app record for bundle identifier `com.bloom.app`.
- [ ] Configure the seven required public variables in the appropriate EAS environment before an iOS distribution build.
- [ ] Create and validate the first iOS build, upload it to TestFlight, complete export-compliance/privacy metadata, and run TestFlight installation testing. No iOS cloud build was started.

## Required before a web beta

- [ ] Choose and configure a web hosting/deployment target. No web deployment target is currently connected, so there is no public Bloom web beta URL.
- [ ] Run manual browser layout and interaction checks at the supported narrow and desktop widths. The in-app browser controller was unavailable because its runtime reported missing `sandboxPolicy` metadata, so automated visual browser verification could not be completed.
- [ ] Confirm the deployed origin is included in the Meg backend production CORS allowlist and that the deployed web build uses the intended Firebase and Meg public configuration.

## Optional engineering follow-up

- [ ] Add a project lint script and lint configuration if linting is desired as a release gate. The repository currently has no lint script, so lint was not runnable.
- [ ] Add device-farm or emulator coverage for the Android width, keyboard, back-navigation, and background/resume matrix to reduce reliance on manual release checks.
- [ ] Add an automated authenticated Meg staging smoke test using a short-lived test token supplied through a secret manager; never commit or log the token.

## Current release decision

The source-level checks and automated tests do not replace the device work above. Final Android beta approval remains withheld until the final APK is available and the physical Android smoke matrix passes. iOS, store, and web distribution remain separate gated releases.
