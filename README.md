# Bloom

Bloom 1.1.0 is a private, cross-platform Expo beta for cycle, symptom, food,
movement, strength, and wellbeing tracking. It is designed for people with
PCOS, PCOD, or irregular cycles while remaining useful for anyone who wants a
gentler way to notice patterns in their body.

Bloom runs on Android, iPhone, and the web from one Expo/React Native codebase.
It is not a medical device and does not diagnose, predict a condition, or
replace advice from a qualified healthcare professional.

## What is in the beta

The main navigation has five tabs:

- **Today** - daily check-in, cycle summary, and quick access to common logs.
- **Timeline** - period history, calendar views, and estimates based on logged
  cycle starts. Period entries can be added, edited, and deleted.
- **Meg** - Bloom's supportive chat experience. Meg uses Meg Engine V2 only.
  Messages are sent through Bloom's Firebase-authenticated `/api/meg/chat`
  endpoint; provider keys are never exposed to the client.
- **Strength** - an isolated movement feature under `src/features/strength/`.
  Its web pose model, JavaScript bundle, and WASM runtime live under
  `public/strength/` and are loaded at runtime.
- **Diet** - optional preferences, meal ideas, saved ideas, meal logging,
  after-meal reflection, history, and non-causal observations.

Profile is a stack/settings screen reached from the app content. It contains
preferences, reminders, privacy controls, export, and account actions.

## Meg architecture

Meg V1 has been removed from the active backend. There is no V1 runtime fallback.

```text
Bloom Meg UI
   ↓ Firebase ID token
POST /api/meg/chat
   ↓ verified UID + allowlisted Bloom context
server/megV2Bridge.js
   ↓ in-process call
meg-engine-v2
   ↓
Gemini / Groq / OpenRouter
```

The public API contract remains stable for the app. `server/index.js` and
`server/firebaseAuth.js` remain Bloom's security boundary: Firebase verifies the
caller, the server derives the trusted user ID, CORS is enforced, and only
allowlisted Bloom context is mapped into Meg Engine V2.

The standalone Meg V2 `/v2/chat` SSE transport remains available for engine
verification and possible future service separation, but Bloom production uses
the in-process bridge.

Meg V2 provides deterministic routing, support-mode instructions, safety checks,
response guards, conversation memory, idempotency, caching, provider fallback,
bounded retries, circuit breaking, and telemetry.

## Data behaviour

- Firebase Email/Password Authentication provides the account boundary.
- Cycle starts and daily check-ins are stored in owner-scoped Firestore paths.
  Cycle estimates are calculated from logged history and remain estimates, not
  medical predictions.
- Diet remains local-first and owner-scoped. It is intentionally not part of the
  Meg V1-to-V2 cleanup.
- Failed Meg sends remain in a UID-scoped device retry queue. Delivered Meg
  conversations and V2 memory are handled by the authenticated backend.
- Meg V2 uses SQLite persistence by default. Production must point
  `MEG_V2_DATA_DIR` at storage that survives process restarts and deployment
  replacement. The provided container uses `/var/lib/bloom/meg-v2` and declares
  that path as a volume; the hosting platform must attach genuinely persistent
  storage there.
- Device data is namespaced by Firebase UID so signing into another account does
  not reuse the previous account's local preferences or queued messages.
- Strength storage and analytics must contain only the allowlisted workout
  summary. Camera frames and pose landmarks are not persisted.

## Technology

- Expo SDK 51 and React Native 0.74
- React 18 and React Navigation 6
- Firebase Authentication, Cloud Firestore, and Firebase Admin
- AsyncStorage for UID-scoped device data
- Express for Bloom's authenticated backend
- Meg Engine V2 for AI orchestration
- SQLite through `better-sqlite3` for Meg V2 persistence
- Gemini, Groq, and OpenRouter provider adapters
- MediaPipe-compatible Strength web runtime assets under `public/strength/`
- date-fns for local date and cycle calculations

## Requirements

- Node.js 22 recommended for local and production parity
- npm
- Android Studio for an Android emulator, or Xcode on macOS for an iOS simulator
- Access to Bloom's existing Firebase Web App configuration
- At least one Meg V2 provider key: Gemini, Groq, or OpenRouter

No global Expo CLI installation is needed. Use the project-local CLI through
`npx` or the npm scripts below.

## Local setup

```bash
npm ci
npm ci --prefix meg-engine-v2
```

Create an ignored `.env` from `.env.example` and fill in the six public Firebase
Web App values. These identify the Firebase client app; they are not Firebase
Admin credentials.

For Meg V2, configure at least one server-side provider key:

```dotenv
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

One key is enough. Adding more enables automatic provider fallback.

For local app development, the example backend URL is:

```dotenv
EXPO_PUBLIC_MEG_API_URL=http://127.0.0.1:3001
```

Start the Bloom backend:

```bash
npm run server
```

Start Expo in another terminal:

```bash
npx expo start
```

Useful platform commands:

```bash
npm run android
npm run ios
npm run web
```

A physical phone cannot reach a server running at its own `127.0.0.1`; use the
development computer's reachable LAN address for device testing. Preview and
production builds must use a public HTTPS Bloom backend URL.

## Configuration

Everything named `EXPO_PUBLIC_*` is embedded in the application bundle and is
readable by users. Never place Firebase Admin credentials, service-account JSON,
AI provider keys, or other secrets in an `EXPO_PUBLIC_*` value.

### Frontend variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web App API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket identifier |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID |
| `EXPO_PUBLIC_MEG_API_URL` | Bloom backend origin; public HTTPS outside local development |
| `EXPO_PUBLIC_BLOOM_STRENGTH` | Strength feature flag |

### Backend variables

| Variable | Purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Optional Firebase Admin project override |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret base64 service-account JSON; use a secret manager |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternative ADC credential path outside the repository |
| `GEMINI_API_KEY` | Gemini provider secret |
| `GROQ_API_KEY` | Groq provider secret |
| `OPENROUTER_API_KEY` | OpenRouter provider secret |
| `MEG_V2_DATA_DIR` | Durable Meg V2 SQLite data directory |
| `PRIMARY_FAST_PROVIDER` / `PRIMARY_SMART_PROVIDER` | Optional route preference overrides |
| `ENABLE_LOCAL_FALLBACK` | Optional local Ollama fallback; Bloom bridge defaults it off |
| `RATE_LIMIT_PER_MINUTE` | Meg request rate limit |
| `CORS_ALLOWED_ORIGINS` | Exact comma-separated production web origins |
| `NODE_ENV` / `PORT` / `MEG_SERVER_HOST` | Node runtime and bind configuration |
| `BUILD_VERSION` | Safe version reported by `/health` |

Optional provider model overrides are documented in `.env.example` and
`meg-engine-v2/docs/PROVIDERS.md`.

## Project map

```text
App.js                         Authentication gate and app providers
src/navigation/               Five-tab navigator and stack routes
src/screens/                  Today, Timeline, Meg, Diet, and stack screens
src/features/strength/        Isolated Strength feature and pose/rep logic
public/strength/              Strength model, browser bundle, and WASM runtime
src/context/                  Auth and account-scoped application state
src/services/meg.js           Authenticated Bloom client/context adapter for Meg V2
server/megV2Bridge.js         Bloom-to-Meg-V2 in-process bridge
server/                       Firebase auth boundary, API routes, and tests
meg-engine-v2/                Active Meg engine: routing, prompts, safety, memory, providers
firestore.rules               Owner-scoped Firestore access rules
assets/                       Bloom icon, splash, favicon, and logo assets
docs/                         Release, startup, and distribution notes
```

## Strength boundary

Strength is intentionally separate from Meg. Do not remove its runtime files
only because they are large: `PoseDetector.web.js` loads the model, JavaScript
bundle, and WASM variants from `public/strength/`.

Before enabling Strength broadly, validate camera-permission denial,
calibration/framing, one-person detection, rep counting, pause/recovery, Stop,
voice fallback, and workout-summary sync in a supported browser/device.

## Release validation

Run from a clean checkout:

```bash
npm ci
npm test
npm run typecheck
npm run build:web
npm ci --prefix meg-engine-v2
npm test --prefix meg-engine-v2
npm run benchmark --prefix meg-engine-v2
npm run test:rules
```

Then validate the production container:

```bash
docker build -t wholebloom .
docker run --rm -p 8080:8080 \
  -e GEMINI_API_KEY="$GEMINI_API_KEY" \
  -v bloom-meg-v2:/var/lib/bloom/meg-v2 \
  wholebloom
```

Check `/health`, send one Firebase-authenticated Meg request, restart the
container with the same volume, and confirm the expected V2 persistence is still
available. Also smoke-test Strength in a real supported browser.

Merge a Meg backend migration only after the GitHub verification workflow is
green, including Bloom tests, Meg V2 tests, typecheck, web build, and production
container build.

## Firebase and deployment

1. Enable Email/Password Authentication in the existing Firebase project.
2. Configure the six public Firebase values and `EXPO_PUBLIC_MEG_API_URL` in the
   matching local or EAS environment.
3. Configure Firebase Admin credentials only on the backend.
4. Configure at least one Meg V2 provider key.
5. Mount durable storage at `MEG_V2_DATA_DIR` for production Meg memory.
6. Review Firestore rules and tests before deploying them.
7. Confirm `GET /health` returns 200 and identifies Meg V2 before shipping an app
   build that points to the backend.

## Privacy and safety

- Firestore paths for cycle, check-in, Diet, and allowed Strength summaries are
  scoped to the authenticated account.
- The Meg API verifies Firebase ID tokens and derives the trusted UID server-side.
- Provider keys never enter the Expo bundle.
- Meg V2 context is mapped through an allowlist before prompt construction.
- Native and device-only preferences use UID-scoped storage.
- Cycle and symptom observations are informational only. Seek medical care for
  urgent symptoms or concerns.

## Licence

Private and confidential. All rights reserved.
