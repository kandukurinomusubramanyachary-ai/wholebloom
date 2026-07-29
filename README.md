# Bloom — PCOS-First Daily Body Companion

A private, compassionate mobile application for Indian women with PCOS and irregular menstrual cycles.

## Features

- **Daily Check-in**: 30-second logging of mood, energy, sleep, pain, flow, and symptoms
- **Cycle Tracking**: Visual calendar with gentle rose tones (no aggressive red)
- **Secure Opening**: Persistent Firebase sign-in followed by Bloom's existing branded opening
- **Pattern Insights**: Data-driven correlations with gentle, observational language
- **Learning Library**: 8+ curated articles reviewed by Indian healthcare providers
- **Daily Affirmations**: Compassionate messages to support emotional wellbeing
- **Privacy-First**: Owner-scoped Firestore records, secure sign-in, and biometric/PIN app lock
- **Indian Context**: 6 languages, traditional remedies, culturally relevant content

## Tech Stack

- React Native 0.74.5
- Expo SDK 51
- React Navigation 6.x
- Firebase Authentication and Cloud Firestore (account data)
- AsyncStorage (UID-scoped device preferences and app-lock settings)
- date-fns (date manipulation)
- expo-local-authentication (biometric lock)
- expo-notifications (reminders)
- expo-file-system + expo-sharing (data export)

## Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio or Xcode (for simulators)
- Access to Bloom's existing Firebase project configuration

### Installation

```bash
# Clone or extract the project
cd bloom

# Install dependencies
npm install

# Copy .env.example to .env, then fill the public Firebase Web App values

# Start the development server
npx expo start
```

Start the Meg API in a second terminal with `npm run server`. The default local
provider is Ollama at `http://127.0.0.1:11434`; Expo Web calls the API URL from
`EXPO_PUBLIC_MEG_API_URL`.

### Running on Device

```bash
# Android
npx expo start --android

# iOS
npx expo start --ios
```

## Project Structure

```
bloom/
├── App.js                          # Entry point
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── src/
│   ├── components/                 # Reusable UI components
│   │   ├── AppLockModal.js
│   │   ├── ArticleCard.js
│   │   ├── Button.js
│   │   ├── Card.js
│   │   ├── FlowSelector.js
│   │   ├── InsightCard.js
│   │   ├── MoodSelector.js
│   │   ├── ProgressRing.js
│   │   └── SymptomPicker.js
│   ├── context/
│   │   └── AppContext.js           # Global state management
│   ├── data/
│   │   └── content.js              # Articles, affirmations, tips
│   ├── navigation/
│   │   ├── MainTabNavigator.js     # Bottom tabs (Today, Timeline, Insights, Learn, Profile)
│   │   └── RootNavigator.js        # Root stack + opening splash + app lock
│   ├── screens/
│   │   ├── SplashScreen.js         # Logo opening screen and progress line
│   │   ├── TodayScreen.js          # Daily check-in + affirmations
│   │   ├── TimelineScreen.js       # Calendar view
│   │   ├── InsightsScreen.js       # Pattern recognition dashboard
│   │   ├── LearnScreen.js          # Article library
│   │   ├── ProfileScreen.js        # Settings menu + stats
│   │   ├── ArticleScreen.js        # Article reader
│   │   ├── DayDetailScreen.js      # Single day view
│   │   ├── LogPeriodScreen.js      # Period logging form
│   │   ├── PrivacySettingsScreen.js
│   │   ├── RemindersScreen.js
│   │   ├── ExportDataScreen.js
│   │   └── PreferencesScreen.js
│   ├── services/
│   │   ├── storage.js              # AsyncStorage wrapper
│   │   ├── notifications.js        # Expo notifications
│   │   └── export.js               # Data export (JSON/CSV/PDF)
│   └── utils/
│       ├── constants.js            # Colors, fonts, enums
│       └── helpers.js              # Date/cycle calculations
└── assets/                         # Icons, splash, images
```

## Core Features Implemented

### MVP (Phase 1)
- [x] Branded opening screen with direct entry into the app
- [x] Daily check-in (mood, energy, sleep, pain, flow, symptoms, notes)
- [x] Cycle tracking calendar with predictions
- [x] Pattern insights & correlations
- [x] Learning library with 8 articles
- [x] Daily affirmations
- [x] Privacy settings (biometric lock, PIN, hide preview)
- [x] Data export (JSON, CSV, PDF)
- [x] Reminders (check-in, affirmation, weekly)
- [x] Profile & preferences
- [x] Multi-language structure (6 Indian languages)

## Design System

**Colors**
- App canvas: White (#FFFFFF)
- Opening background: Soft blush white (#FFFDFE)
- Logo rose: Bloom Rose (#ED3F5B)
- Primary action: Deep Rose (#B52F50)
- Positive indicators: Sage (#9BAF93)
- Text: Charcoal (#2E2A27)
- Flow indicators: Gentle rose tones (no aggressive red)

**Typography**
- Display: Playfair Display (serif, editorial)
- Body: DM Sans (clean, modern)

## Privacy & Security

- Firebase Email/Password Authentication with persistent native and web sessions
- Cycle logs, check-ins, and Meg messages stored below `users/{uid}`
- Firestore rules restrict each account to its own root document and descendants
- Meg verifies a fresh Firebase ID token and derives the UID only from that token
- Optional biometric/PIN app lock and hidden app-switcher preview
- Legacy anonymous AsyncStorage keys are not read or migrated into signed-in accounts
- Device-only preferences are namespaced by UID to prevent account switching bleed
- Full data export and account-scoped data deletion controls

## Production authentication and Meg configuration

All `EXPO_PUBLIC_*` values are public build-time configuration. Never put an Admin
credential or AI provider key in an `EXPO_PUBLIC_*` variable.

### Frontend variables

| Variable | Classification | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Public | Firebase Web App API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | Firebase Auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Public | Existing Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | Firebase storage-bucket identifier |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public | Firebase sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Public | Firebase Web App ID |
| `EXPO_PUBLIC_MEG_API_URL` | Public | HTTPS Meg API origin in production, or localhost in development |

### Backend variables

| Variable | Classification | Purpose |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Server config | Firebase Admin project override |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret | Base64 service-account JSON; use a secret manager |
| `GOOGLE_APPLICATION_CREDENTIALS` | Secret path | Alternative ADC credential file outside the repository |
| `MEG_PROVIDER` | Server config | `ollama` or `openai-compatible` |
| `OLLAMA_URL` | Server config | Ollama base URL or `/api/chat` URL |
| `OLLAMA_MODEL` | Server config | Local Ollama model name |
| `MEG_API_BASE_URL` | Server config | OpenAI-compatible API base URL; HTTPS is required in production |
| `MEG_API_KEY` | Secret | OpenAI-compatible provider key |
| `MEG_MODEL` | Server config | Hosted provider model name |
| `MEG_REQUEST_TIMEOUT_MS` | Server config | Provider timeout; `OLLAMA_TIMEOUT_MS` remains a legacy alias |
| `CORS_ALLOWED_ORIGINS` | Server config | Comma-separated browser origins, with no paths |
| `NODE_ENV` | Server config | Set to `production` on the deployed service |
| `PORT` | Server config | HTTP port supplied by the host; `MEG_SERVER_PORT` is an optional alias |
| `MEG_SERVER_HOST` | Server config | Bind host; production defaults to `0.0.0.0` |
| `BUILD_VERSION` | Server config | Safe version string returned by `/health`; `GIT_COMMIT` is a fallback |
| `MEG_API_URL` | Test config | API origin used by the live Meg smoke test |
| `MEG_TEST_ID_TOKEN` | Short-lived secret | Firebase ID token used only by the authenticated smoke test |

### Local verification

```bash
npm run typecheck
npm test
npm run test:rules
npm run build:web
npm run server
```

The rules test starts the Firestore emulator and requires Java 21 or another
Firebase-supported Java runtime. The live `npm run test:meg` additionally needs a
running provider and a short-lived `MEG_TEST_ID_TOKEN`.

### Firebase and deployment

1. Enable Email/Password Authentication in the existing Firebase project.
2. Add the Firebase Web App values to the frontend build environment.
3. Deploy the reviewed rules explicitly:
   `npx firebase deploy --only firestore:rules --project bloom-5da0f`.
4. Build web with `npm run build:web`, then publish `dist/` on the frontend host.
5. For Android/iOS, supply the same public build variables and run the normal Expo/EAS build.
6. Deploy the repository to a Node 20 service with start command `npm run server`.
7. Configure Firebase Admin through workload identity/ADC or one server-side secret,
   select the Meg provider, and set the exact frontend origins in `CORS_ALLOWED_ORIGINS`.
8. Confirm `GET /health` returns `200`, then set `EXPO_PUBLIC_MEG_API_URL` to that API origin
   and rebuild the frontend.

## Roadmap

**Phase 2 (Months 4-6)**
- iOS launch
- Cloud backup/restore
- PDF report generation for doctors
- Home screen widget
- Premium tier

**Phase 3 (Months 7-12)**
- Anonymous community forum
- Healthcare provider partnerships
- Southeast Asia expansion

**Year 2+**
- AI-powered personalized insights
- Wearable integration
- Telemedicine partnerships

## License

Private and confidential. All rights reserved.

## Disclaimer

Bloom is not a medical device and does not diagnose conditions. Always consult a healthcare provider for medical decisions.
