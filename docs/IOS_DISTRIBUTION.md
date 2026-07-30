# Bloom iOS distribution

Bloom's native display name remains `Bloom`. The iOS application uses:

- Bundle identifier: `com.bloom.app`
- App version: `1.0.2`
- Build number: `1`
- Supported devices: iPhone
- Orientation: portrait

`supportsTablet` is intentionally disabled for the Beta because Bloom's tablet
layouts have not been validated. Enable iPad distribution only after completing
an iPad layout and interaction test pass.

## EAS profiles

The shared `production` profile is the App Store profile:

- iOS creates a physical-device App Store archive (`simulator: false`).
- Android creates an Android App Bundle (`.aab`).
- Both platforms use the EAS `production` environment.

The `preview` profile remains an internal-distribution profile. Android preview
builds are installable APKs. An iOS preview build would require registered test
devices and the appropriate Apple provisioning profile.

## Before the first iOS build

The EAS `production` environment must contain these frontend variables:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_MEG_API_URL`

Do not place Apple credentials, Firebase Admin credentials, private keys, or
other secrets in `app.json`, `eas.json`, or an `EXPO_PUBLIC_*` variable.

Confirm the environment metadata without copying values into the repository:

```powershell
npx eas-cli@latest env:list production
```

Then validate the resolved application configuration:

```powershell
npx expo config --type public
npm run typecheck
```

## Human-run distribution commands

No build or credentials operation should be run until the production
environment is complete. The release owner can then start the App Store build:

```powershell
npx eas-cli@latest build --platform ios --profile production
```

After reviewing the finished archive, submit it to App Store Connect:

```powershell
npx eas-cli@latest submit --platform ios --latest
```

Apple credentials and signing prompts must be handled by the authorized release
owner. Before every later App Store upload, increment `expo.ios.buildNumber`;
Apple will reject a reused build number for the same app version.
