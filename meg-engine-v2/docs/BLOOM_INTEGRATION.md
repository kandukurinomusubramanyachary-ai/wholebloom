# Bloom integration — live architecture

Meg Engine V2 is now the active Meg engine used by Bloom.

Bloom keeps the current Stitch Meg UI and the existing authenticated frontend endpoint:

```http
POST /api/meg/chat
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

The Bloom server verifies the Firebase token, derives the user ID from that verified token, maps the approved Bloom context into Meg V2, and calls Meg V2 in-process. The client never supplies a trusted user ID and never calls an AI provider directly.

## Request from the Bloom client

```json
{
  "conversationId": "abc",
  "messageId": "client-generated-message-id",
  "message": "I feel terrible today",
  "mode": "listen",
  "supportMode": "listen",
  "language": "en",
  "context": {
    "cycleDay": 42,
    "todayCheckin": {
      "mood": "low",
      "sleep": 5
    }
  },
  "history": []
}
```

## Response to the Bloom client

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

Meg V2 still supports its standalone `/v2/chat` SSE transport for testing or future service separation, but Bloom production does not need a second Meg deployment or a `MEG_API_KEY`.

## Configuration

The only new Meg-specific production configuration is one or more provider keys:

```dotenv
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```

One key is enough. Adding more gives Meg automatic provider fallback. Model names, routing, retry policy, safety handling, context selection, caching, and provider order all have defaults.

Existing Bloom infrastructure configuration such as Firebase Admin credentials, CORS origins, and the already configured Bloom backend URL remains unchanged.

## Support-mode behavior

The Stitch UI modes are preserved and influence Meg V2 directly:

- `listen` → emotional presence first, automatic route selection
- `understand` → explanation-oriented prompt, SMART route
- `plan` → one or two small next steps, SMART route
- `conversation` → natural wording for a real conversation, SMART route
- `doctor` → doctor-prep behavior, DOCTOR route

The deterministic Meg V2 intent router, safety router, response guard, memory system, provider fallbacks, retries, circuit breaker, and telemetry remain active underneath these UI modes.

## Security boundary

- Firebase authentication is verified by Bloom before Meg V2 runs.
- `userId` is derived from the verified Firebase token.
- A client-supplied UID is never trusted.
- Provider API keys stay server-side.
- Bloom context is mapped through an allowlist before it reaches the prompt.
- The current React Native UI receives only the final Meg response contract.

## Legacy status

The previous Bloom Meg V1 server prompt/provider/persistence/mode implementation has been removed. `src/services/meg.js` is now only the authenticated Bloom client/context adapter for Meg V2.
