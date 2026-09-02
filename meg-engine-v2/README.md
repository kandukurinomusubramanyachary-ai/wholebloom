# Meg Engine V2

Meg Engine V2 is Bloom's active conversational engine. It owns Meg's routing, prompt assembly, safety checks, memory, reliability, provider fallback, caching, and telemetry while Bloom keeps the existing Meg UI and authenticated `/api/meg/chat` endpoint.

## Live Bloom architecture

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

Bloom does not expose provider keys to the client and does not trust a client-supplied UID. The server derives the user ID from the verified Firebase token.

The standalone `/v2/chat` SSE route remains available for engine tests and possible future service separation, but Bloom production uses the in-process bridge.

## What is included

- deterministic intent and route selection
- FAST, SMART, DOCTOR, SAFETY, and LOCAL logical routes
- support-mode instructions for Listen, Understand, Plan, Conversation, and Doctor
- Gemini, Groq, OpenRouter, and optional Ollama adapters
- provider fallback, bounded retries, jittered backoff, timeouts, and circuit breaking
- safety pre-checks for urgent medical and self-harm language
- response guards for prompt/provider leakage and unsafe output
- bounded context selection and prompt token budgeting
- recent conversation history and relevant memory retrieval
- SQLite persistence with an in-memory test backend
- client-generated `messageId` idempotency and duplicate-request coordination
- versioned cache and privacy-preserving telemetry
- deterministic benchmark fixtures and load tooling

## Installation

From the repository root:

```bash
npm ci --prefix meg-engine-v2
npm test --prefix meg-engine-v2
npm run benchmark --prefix meg-engine-v2
```

Or from this directory:

```bash
npm ci
npm test
npm run benchmark
```

At least one cloud provider key is required for model-backed Bloom replies.

## Provider configuration

Configure one or more of:

```dotenv
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

One provider is sufficient. More than one enables automatic fallback.

Optional model overrides:

```dotenv
GEMINI_MODEL=gemini-2.5-flash
GROQ_MODEL=llama-3.1-8b-instant
OPENROUTER_MODEL=meta-llama/llama-3.3-8b-instruct:free
```

Bloom disables local Ollama fallback by default in the in-process bridge unless `ENABLE_LOCAL_FALLBACK` is explicitly enabled.

Default route preference is:

- FAST: Gemini → Groq → OpenRouter
- SMART: OpenRouter → Gemini → Groq
- DOCTOR: OpenRouter → Gemini → Groq
- SAFETY: OpenRouter → Gemini → Groq

See `docs/PROVIDERS.md` for the complete provider configuration.

## Bloom request contract

Bloom's client sends to the existing authenticated endpoint:

```http
POST /api/meg/chat
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

Example request:

```json
{
  "conversationId": "abc",
  "messageId": "client-generated-message-id",
  "message": "I feel overwhelmed today",
  "mode": "listen",
  "supportMode": "listen",
  "language": "en",
  "context": {
    "cycleDay": 42,
    "todayCheckin": {
      "mood": "overwhelmed",
      "sleep": 5
    }
  },
  "history": []
}
```

The Bloom server maps this to Meg V2 and injects the verified Firebase UID. Unrelated client fields are not trusted as identity.

Example response:

```json
{
  "message": "...",
  "conversationId": "abc",
  "messageId": "...",
  "source": "meg-v2",
  "safety": null,
  "urgent": false,
  "engineVersion": "0.2.0-bloom-live",
  "traceId": "..."
}
```

## Support modes

- `listen` → emotional presence first, automatic route selection
- `understand` → explanation-oriented SMART route
- `plan` → small actionable next steps through SMART
- `conversation` → natural wording for a real-world conversation through SMART
- `doctor` → doctor-prep behavior through DOCTOR

The safety router and response guard still run underneath every support mode.

## Persistence

Meg V2 stores conversation and memory data in SQLite through `MemoryStore`.

For Bloom production, set `MEG_V2_DATA_DIR` to storage that survives process restarts and deployment replacement. Do not rely on a temporary filesystem for production memory.

Example:

```dotenv
MEG_V2_DATA_DIR=/var/lib/bloom/meg-v2
```

The production container declares `/var/lib/bloom/meg-v2` as its data volume. Your hosting platform must mount genuinely persistent storage there, or provide another durable adapter before scaling to multiple replicas.

## Standalone SSE route

For engine-level testing:

```http
POST /v2/chat
Content-Type: application/json
Accept: text/event-stream
```

Optional `MEG_API_KEY` authentication applies only to the standalone V2 transport. Bloom's public `/api/meg/chat` endpoint continues to use Firebase authentication instead.

SSE events can include `start`, `metadata`, `token`, `replace`, `done`, and `error`.

## Verification

```bash
npm test
npm run benchmark
npm run load:test
```

From the repository root, release validation should also include:

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

The deterministic benchmark is an engineering regression tool, not a clinical-quality claim. Live provider quality, medical-safety review, latency, and factual evaluation still require controlled testing.

## V1 status

Meg V1 is removed from the live backend. There is no `MEG_ENGINE=v1|v2` runtime fallback and no V1 prompt/provider/persistence stack to silently reactivate. Bloom's active path is Meg V2 only.
