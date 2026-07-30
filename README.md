# Bloom

Bloom 1.1.0 is a private, cross-platform Expo beta for cycle, symptom, food,
movement, and wellbeing tracking. It is designed for people with PCOS, PCOD,
or irregular cycles, while remaining useful for anyone who wants a gentler way
to notice patterns in their body.

Bloom runs on Android, iPhone, and the web from one Expo/React Native codebase.
It is not a medical device and does not diagnose, predict a condition, or
replace advice from a qualified healthcare professional.

## What is in the beta

The main navigation has exactly five tabs:

- **Today** - daily check-in, cycle summary, and quick access to common logs.
- **Timeline** - period history, calendar views, and estimates based on the
  cycle starts the user has logged. Period entries can be added, edited, and
  deleted.
- **Meg** - Bloom's supportive chat experience. Sending a message requires a
  signed-in Firebase user and a deployed Meg API that verifies the Firebase ID
  token.
- **Insights** - careful observations from the user's own entries. The
  educational **Learn** library is a section inside Insights, not a separate
  bottom tab.
- **Diet** - optional preferences, ingredient search and free-text ingredients,
  three practical meal ideas, saved ideas, meal logging, after-meal reflection,
  history, and non-causal observations.

Profile is a stack/settings screen reached from the app content. It is not a
sixth bottom tab. It contains preferences, reminders, privacy controls, export,
and account actions.

Other beta capabilities include daily symptom and mood check-ins, movement and
food logs, cycle estimates that tolerate irregular history, educational
articles, data export, optional biometric or PIN app lock, reminder settings,
and startup diagnostics for recoverable configuration failures.

## Data behaviour

- Firebase Email/Password Authentication provides the account boundary.
- Cycle starts and daily check-ins are stored in owner-scoped Firestore paths.
  Cycle estimates are calculated in the app from the user's logged history;
  they are estimates, not medical predictions.
- Diet is local-first. Meals, reflections, preferences, saved ideas, and
  deletion markers are written to UID-scoped device storage first, so the core
  Diet workflow remains usable when the Diet cloud sync or Meg service is
  unavailable. Bloom then performs best-effort owner-scoped Firestore sync.
- Failed Meg sends are retained in a UID-scoped device queue for explicit retry.
  The Meg backend remains the source of truth for delivered conversations and
  accepts only authenticated requests with a valid Firebase ID token.
- Device data is namespaced by Firebase UID so signing into another account
  does not reuse the previous account's local preferences or queued messages.
- Educational content and generated observations use supportive,
  non-diagnostic language. The repository does not claim clinical or medical
  review of that content.

## Technology

- Expo SDK 51 and React Native 0.74
- React 18 and React Navigation 6
- Firebase Authentication, Cloud Firestore, and Firebase Admin on the backend
- AsyncStorage for UID-scoped device data
- Express for the Meg API
- date-fns for local date and cycle calculations
- Expo modules for notifications, local authentication, screen capture, file
  export, sharing, clipboard, and splash handling

## Requirements

- Node.js 20 or newer
- npm
- Android Studio for an Android emulator, or Xcode on macOS for an iOS simulator
- Access to Bloom's existing Firebase Web App configuration
- For Meg: either the local Ollama provider or the configured production
  provider and backend credentials

No global Expo CLI installation is needed. Use the project-local CLI through
`npx` or the npm scripts below.

## Local setup

```bash
cd bloom
npm install
```

Create an ignored `.env` file from `.env.example`:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Fill in the six public Firebase Web App values. These identify the Firebase
client app; they are not Firebase Admin credentials. For local Meg development,
the example uses `http://127.0.0.1:3001`.

Start Expo:

```bash
npx expo start
```

Useful platform commands:

```bash
npm run android
npm run ios
npm run web
```

The iOS command requires macOS and Xcode. A physical phone cannot reach a
server running at its own `127.0.0.1`; for local device testing, set
`EXPO_PUBLIC_MEG_API_URL` to the development computer's reachable LAN address.
Preview and production builds must use a public HTTPS Meg API URL.

## Local Meg backend

The default development provider is Ollama at `http://127.0.0.1:11434`, using
the model configured by `OLLAMA_MODEL` in `.env`.

With Ollama running, start the Bloom API in a second terminal:

```bash
npm run server
```

Check the unauthenticated health endpoint:

```bash
curl http://127.0.0.1:3001/health
```

Meg message routes still require a valid Firebase ID token. The backend does
not accept a UID supplied by the client as proof of identity.

## Configuration

Everything named `EXPO_PUBLIC_*` is embedded in the application bundle and is
readable by users. Never place Firebase Admin credentials, service-account JSON,
AI provider keys, or other secrets in an `EXPO_PUBLIC_*` value, `app.json`,
`app.config.js`, or `eas.json`.

### Frontend variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web App API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Existing Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket identifier |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID |
| `EXPO_PUBLIC_MEG_API_URL` | Meg API origin; public HTTPS outside local development |

### Backend variables

| Variable | Purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Optional Firebase Admin project override |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret base64 service-account JSON; use a secret manager |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternative ADC credential path outside the repository |
| `MEG_PROVIDER` | `ollama` or `openai-compatible` |
| `OLLAMA_URL` / `OLLAMA_MODEL` | Local Ollama provider configuration |
| `MEG_API_BASE_URL` / `MEG_MODEL` | Hosted OpenAI-compatible provider configuration |
| `MEG_API_KEY` | Hosted provider secret |
| `MEG_REQUEST_TIMEOUT_MS` | Provider request timeout |
| `CORS_ALLOWED_ORIGINS` | Exact comma-separated production web origins |
| `NODE_ENV` / `PORT` / `MEG_SERVER_HOST` | Node runtime and bind configuration |
| `BUILD_VERSION` | Safe version reported by `/health` |

In development, the API accepts browser origins only from `localhost` or
`127.0.0.1` on Expo web ports 8081-8090. Production uses the exact origins in
`CORS_ALLOWED_ORIGINS`; it does not use a wildcard.

## Project map

```text
App.js                         Authentication gate and app providers
src/navigation/               Five-tab navigator and stack routes
src/screens/                  Today, Timeline, Meg, Insights, Diet, and stack screens
src/context/                  Auth and account-scoped application state
src/services/                 Firebase, Meg, Diet, prediction, storage, and export logic
src/utils/constants.js        Shared colours, typography, spacing, and layout tokens
server/                       Meg API, Firebase Admin integration, and automated tests
firestore.rules               Owner-scoped Firestore access rules
assets/                       Approved Bloom icon, splash, favicon, and logo derivatives
docs/                         Release, startup, branding, and distribution notes
```

## Design system

Bloom uses the platform system sans-serif font stack. No Playfair Display or DM
Sans font files are loaded.

Core source tokens in `src/utils/constants.js`:

| Role | Value |
| --- | --- |
| Canvas | `#FFFFFF` |
| Splash | `#FFFDFE` |
| Soft surface | `#F7F7F5` |
| Warm surface | `#FBF3EF` |
| Logo rose | `#ED3F5B` |
| Primary brand/action | `#B52F50` |
| Brand-soft surface | `#FBE5EA` |
| Sage/success | `#60745C` |
| Cycle accent | `#C0755A` |
| Primary text | `#222222` |
| Body text | `#484848` |
| Muted text | `#6A6A6A` |
| Hairline | `#E5E5E2` |

The shared layout uses a 20 px screen gutter, a 720 px maximum content width,
16 px cards, 12 px controls, and a 48 px minimum touch target. Existing screens
also respect safe areas, keyboard resize, reduced-motion preferences, and a
light interface style.

## Validation

Run the local checks before preparing a beta artifact:

```bash
npx expo install --check
npx expo-doctor
npm run typecheck
npm test
npm run test:rules
npm run build:web
npx expo export --platform android
npx expo export --platform ios
```

`npm run test:rules` starts the Firestore emulator and requires a
Firebase-supported Java runtime. `npm run test:meg` additionally requires a
running Meg backend/provider and a short-lived `MEG_TEST_ID_TOKEN`.

For an internal Android preview APK, use the repository's EAS profile after the
preview environment has been verified:

```bash
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

## Firebase and deployment

1. Enable Email/Password Authentication in the existing Firebase project.
2. Configure the six public Firebase values and `EXPO_PUBLIC_MEG_API_URL` in the
   matching local or EAS environment.
3. Review rules and tests before explicitly deploying them:

   ```bash
   npx firebase deploy --only firestore:rules --project bloom-5da0f
   ```

4. Build web with `npm run build:web` and publish `dist/` on the chosen frontend
   host.
5. Deploy the backend to a Node 20 service with `npm run server`, Firebase Admin
   configured through workload identity/ADC or a server-side secret, and exact
   production origins in `CORS_ALLOWED_ORIGINS`.
6. Confirm `GET /health` returns 200, set the public HTTPS Meg API URL, and then
   rebuild the frontend or native app so the build-time value is embedded.

## Privacy and safety

- Firestore paths for cycle, check-in, Diet, and Meg data are scoped to the
  authenticated account.
- The Meg API verifies Firebase ID tokens and does not log tokens, message
  contents, or secrets.
- Native and device-only preferences use UID-scoped storage.
- Optional app-lock and hidden-preview controls protect casual device access;
  they are not substitutes for device security.
- Cycle and symptom observations are informational only. Seek medical care for
  urgent symptoms or concerns.

## Licence

Private and confidential. All rights reserved.
