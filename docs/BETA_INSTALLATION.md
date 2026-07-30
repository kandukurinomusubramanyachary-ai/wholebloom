# Bloom Android Beta installation

## Release status

The final Android Beta APK has **not been published yet**. There is intentionally
no download link in this document. Do not distribute an APK until the release
owner completes the release record below and removes the `NOT READY` status.

Current source configuration:

| Item | Current value |
| --- | --- |
| App | Bloom |
| Android application ID | `com.bloomhealth.app` |
| App version | `1.1.0` |
| Android version code | `4` |
| EAS profile | `preview` |
| Expected artifact | Installable APK |
| Approved build status | **NOT READY** |
| Approved build link | **Not added** |

These values describe the current source tree, not an approved artifact. The
version, build ID, signing identity, checksum, and download link must be checked
against the completed EAS build before distribution.

## Release-owner checklist

Complete every item against the exact commit used for the build:

- Confirm `git status` is clean and record the commit SHA.
- Confirm `npx expo config --type public` resolves to
  `com.bloomhealth.app`, the intended version, and the intended version code.
- Confirm the EAS `preview` environment contains all six public Firebase Web
  App variables and a public HTTPS `EXPO_PUBLIC_MEG_API_URL`.
- Do not put Firebase Admin credentials, provider keys, or any other secret in
  an `EXPO_PUBLIC_*` variable.
- Confirm the deployed Meg backend returns HTTP 200 from `GET /health`.
- Run the repository typecheck and tests.
- Run Expo Doctor and the Android export validation.
- Build with the `preview` profile and confirm the artifact is an APK, not an
  AAB.
- Install that exact APK on a physical Android phone and complete the smoke
  test below.
- Record the EAS build ID, download link, SHA-256, file size, package, version,
  version code, commit, date, and tester.
- Check [DEPRECATED_BUILDS.md](./DEPRECATED_BUILDS.md) and ensure the selected
  artifact is not one of the retired builds.

The build command is:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Do not start or distribute a build when the preview environment is missing its
Firebase configuration or public HTTPS Meg endpoint.

## Tester installation

Only use the approved link supplied by the Bloom release owner.

1. Uninstall every old Bloom APK listed in `DEPRECATED_BUILDS.md` before this
   clean Beta test. Uninstalling clears device-only Bloom state, so export any
   test data that must be retained first.
2. On the Android phone, open the approved APK link in the browser or managed
   file-sharing app named by the release owner.
3. Download the APK. If Android asks for permission to install unknown apps,
   grant it only to the app used for this download.
4. Open the downloaded file and choose **Install**.
5. Open Bloom from the installation confirmation or app launcher.
6. Verify that the installed app reports the exact approved Bloom version and
   version code from the release record below.
7. After installation, revoke the temporary “install unknown apps” permission
   if it is no longer needed.

Old EAS builds are immutable. A new build does not change an old artifact, and
old QR codes keep pointing to their old builds. Never reuse an old QR code,
download link, or renamed APK for Beta distribution.

## Required smoke test

Record PASS, FAIL, or NOT VERIFIED for every row on the same physical phone:

| Check | Result | Notes |
| --- | --- | --- |
| Cold launch reaches the Bloom splash and then authentication or the app | NOT VERIFIED | |
| Sign up with a permitted test account | NOT VERIFIED | |
| Log out and log back in | NOT VERIFIED | |
| Cold restart preserves authentication | NOT VERIFIED | |
| Log a period/cycle entry | NOT VERIFIED | |
| Complete and save a daily check-in | NOT VERIFIED | |
| Open Timeline and confirm the saved entry | NOT VERIFIED | |
| Send a message to Meg and receive a response | NOT VERIFIED | |
| Reopen Meg and confirm the conversation is present | NOT VERIFIED | |
| Auth form stays usable with the keyboard open | NOT VERIFIED | |
| Meg composer stays above the keyboard and gesture bar | NOT VERIFIED | |
| Bottom actions are tappable with gesture navigation | NOT VERIFIED | |
| App remains usable after a cold restart | NOT VERIFIED | |

For a Beta approval, also record the phone model, Android version, navigation
mode, display size/font scale, network type, build ID, and tester.

## Startup troubleshooting

If Bloom shows its startup diagnostic screen:

1. Record the phone manufacturer, phone model, Android or iOS version, build
   ID, whether the Bloom splash appeared, whether the app returned to the
   launcher, and the displayed startup stage.
2. Use **Copy technical details** when available and attach that text. The
   diagnostic is designed to contain only sanitised technical metadata.
3. Press **Retry** once.
4. If the same failure returns, stop testing that build and send the diagnostic
   to the release owner. Never include passwords, sign-in links, Firebase ID
   tokens, or provider credentials.

If Bloom closes before the diagnostic screen appears, capture the same device
details plus an Android crash log if available. Failures that occur before the
JavaScript diagnostic bootstrap or during native application loading cannot be
shown by Bloom’s in-app diagnostic.

If only Meg fails, keep the message in place and record the time and network
type. Confirm the backend health endpoint and preview CORS/auth configuration
before reinstalling the app.

## Optional ADB installation

For an authorised device with Android platform tools installed:

```powershell
adb devices
adb install -r "C:\path\to\Bloom-approved-preview.apk"
adb shell monkey -p com.bloomhealth.app -c android.intent.category.LAUNCHER 1
```

`adb install -r` preserves app data only when the installed app has the same
package and compatible signature. A successful install command is not a
substitute for the smoke test.

## Approved-build record

Leave this record incomplete until a new preview build has passed the physical
device smoke test.

| Field | Approved value |
| --- | --- |
| Status | **NOT READY** |
| EAS build ID | Not assigned |
| Download link | Not added |
| APK filename | Not assigned |
| SHA-256 | Not assigned |
| File size | Not assigned |
| Git commit | Not assigned |
| App version / version code | Not verified against an artifact |
| Package | Not verified against an artifact |
| Build date | Not assigned |
| Physical-device tester | Not assigned |
| Smoke-test result | NOT VERIFIED |
