# Meg Engine V2 architecture

## Scope

Meg Engine V2 is a standalone orchestration service. Bloom owns the product UI and can later call this service from `src/services/meg.js`. Meg's identity and policy are independent from any one model provider.

```text
Bloom / future src/services/meg.js
              |
              | POST /v2/chat, Accept: text/event-stream
              v
+----------------------------------------------------------+
| Express HTTP boundary                                   |
| optional API-key auth, rate limit, validation, CORS     |
+-------------------------------+--------------------------+
                                v
+----------------------------------------------------------+
| Chat handler                                          |
| trace -> safety -> deterministic intent -> model route |
| parallel context/recent-memory/user-message prep      |
| prompt budget -> provider stream -> output guard      |
| assistant write -> background memory + telemetry      |
+-------------------------------+--------------------------+
                                v
+------------------------ Provider Manager ---------------+
| order | timeout | retry/backoff | health | circuit       |
|               CLOSED -> OPEN -> HALF_OPEN              |
+-----------+----------------+---------------+-------------+
            v                v               v
        Gemini            Groq         OpenRouter       Ollama

Persistent boundary: SQLiteStore (better-sqlite3), with an explicit
JSON fallback for local environments and an in-memory backend for tests.
```

## Request lifecycle

1. Express parses JSON and optionally authenticates the request. Invalid input is rejected before any model work.
2. The handler creates a trace and runs the deterministic safety pre-check.
3. Intent and route are selected without an LLM classifier. Safety overrides all other routes.
4. Context selection, recent-turn retrieval, and the user-message write are scheduled together. The user write is awaited only to preserve conversation ordering/idempotency.
5. Relevant memories are ranked by keyword overlap, category, recency, importance, and redundancy suppression.
6. The prompt composer includes only the applicable mode rules and fits system sections into a token budget.
7. The provider manager starts the configured route order. Successful upstream chunks are sent as SSE token events immediately.
8. Disconnects abort the provider request. Timeouts, retryable errors, circuit state, and fallbacks are bounded.
9. Urgent safety categories use a deterministic response without waiting for an LLM. Non-urgent safety boundaries may use a provider with safety instructions.
10. Assistant persistence, memory extraction, and metrics are failure-isolated from already-delivered text.

## Failure isolation

A memory, cache, telemetry, or persistence error is swallowed at the boundary and does not turn a generated answer into a 500. Provider failure falls through the configured order, then to a deterministic warm outage response. Streaming failures after bytes have been sent do not splice a second provider into the answer; Meg sends a recovery continuation or a replace event.

## Replaceable boundaries

- `ProviderManager` accepts any adapter implementing `isConfigured`, `stream`, `generate`, `healthCheck`, and optionally `normalizeError`.
- `MemoryStore` hides SQLite, JSON, and in-memory implementations.
- `buildMegPrompt` receives plain context and memory values, not database objects.
- Bloom integration only needs the documented HTTP/SSE contract.
