# Meg Engine V2

Standalone, provider-agnostic conversational infrastructure for Bloom's Meg assistant. The model is replaceable; Meg's identity, routing, context policy, memory, safety, reliability, and telemetry live here.

## What is included

- `POST /v2/chat` with true upstream SSE token forwarding
- `start`, `metadata`, `token`, `replace`, `done`, and `error` events
- optional API-key authentication (`MEG_API_KEY`)
- deterministic safety pre-check before routing, including urgent medical and self-harm paths
- deterministic intent/complexity/confidence/reason routing with no classifier LLM call
- FAST, SMART, DOCTOR, SAFETY, and LOCAL logical routes
- Gemini, Groq, OpenRouter, and Ollama adapters
- one provider manager for fallback, bounded retry/backoff+jitter, timeout, latency tracking, and CLOSED/OPEN/HALF_OPEN circuit breaking
- modular, budgeted Meg prompts with relevant-only Bloom context
- working, profile, episodic, and provenance-labelled derived memory
- lexical memory retrieval with recency, importance, category, and redundancy scoring; embeddings can be added behind the same boundary later
- SQLite persistence with JSON fallback and in-memory test backend
- client-generated `messageId` idempotency and same-process duplicate-request coordination
- deterministic response guard for leakage, repeated output, unsafe diagnosis, unsafe medication instructions, and the one-question rule
- versioned safe educational cache
- privacy-preserving logs and rich internal telemetry
- 200-case deterministic benchmark fixture/runner and concurrency load test

The Bloom codebase is not modified.

## Quick start

```bash
cp .env.example .env
npm install
npm test
npm run benchmark
npm start
```

The service listens at `http://localhost:8787`. At least one configured cloud provider or a reachable Ollama instance is needed for model-backed replies. A deterministic warm outage response is returned if every provider is unavailable.

## API

```http
POST /v2/chat
Authorization: Bearer <MEG_API_KEY>
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "userId": "user123",
  "conversationId": "abc",
  "messageId": "client-generated-message-id",
  "message": "Why am I craving sweets?",
  "mode": "auto",
  "language": "en",
  "context": {
    "cycleDay": 22,
    "symptoms": ["cramps"],
    "sleepHours": 5,
    "mood": "stressed",
    "recentFood": ["skipped breakfast"]
  }
}
```

Events are emitted as:

```text
event: start
data: {"conversationId":"abc","messageId":"...","intent":"diet_question","route":"FAST"}

event: metadata
data: {"engineVersion":"0.2.0","cacheHit":false,"safetyTriggered":false}

event: token
data: {"text":"..."}

event: done
data: {"messageId":"...","traceId":"..."}
```

`replace` is emitted only if a streamed answer needs deterministic replacement. Bloom should replace its current buffer when it receives that event. Production responses omit provider names and infrastructure timings; development mode can include them in `done`.

## Configuration and provider order

All model IDs, credentials, timeouts, budgets, and provider orders are environment-driven. The defaults are:

- fast: Gemini → Groq → OpenRouter → Ollama
- smart, doctor, safety: OpenRouter → Gemini → Groq → Ollama
- local: Ollama

See `.env.example` and `docs/PROVIDERS.md`. Provider API keys are never committed or sent to Bloom.

## Verification

```bash
npm test                         # unit, integration, safety, reliability tests
npm run benchmark                # 200 deterministic conversations
npm run benchmark -- --live --provider gemini
npm run load:test                # levels 1, 10, 25, 50
```

The deterministic benchmark is fixture-based and is not a clinical-quality claim. Live provider quality, latency, and factual/safety review still require credentials, controlled evaluation, and clinical review.

## Integration plan

Keep Bloom's existing Meg backend and UI unchanged during validation. When ready, point Bloom's server-side `src/services/meg.js` at this service, pass a client-generated `messageId`, parse SSE events, and gate traffic with `MEG_ENGINE=v1|v2`. Canary through 5%, 20%, 50%, and 100%; never shadow-write the same message twice. See `docs/BLOOM_INTEGRATION.md`.
