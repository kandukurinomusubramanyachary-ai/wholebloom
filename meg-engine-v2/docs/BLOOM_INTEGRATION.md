# Bloom integration

Meg Engine V2 remains standalone. Do not delete the current Bloom Meg backend.

## HTTP contract

```http
POST /v2/chat
Authorization: Bearer <MEG_API_KEY>   # when MEG_API_KEY is configured
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "userId": "user123",
  "conversationId": "abc",
  "messageId": "client-generated-message-id",
  "message": "I feel terrible today",
  "mode": "auto",
  "language": "en",
  "context": {
    "cycleDay": 42,
    "symptoms": ["cramps"],
    "sleepHours": 5
  }
}
```

SSE events are:

- `start`: conversation/message ID, intent, and logical route
- `metadata`: engine version, cache and safety flags
- `token`: `{ "text": "..." }`; append it immediately
- `replace`: deterministic repair of an already-streamed invalid answer; clients should replace the current buffer
- `done`: message ID and trace ID, plus development-only metrics
- `error`: a stable error code and no provider details

## Adapter steps

1. Deploy Meg Engine V2 on an internal/private network.
2. Set `MEG_API_KEY`, a nonzero `RATE_LIMIT_PER_MINUTE`, and keep provider keys only in the Meg service environment.
3. Add a Bloom server-side client in `src/services/meg.js`; do not call providers from the browser.
4. Pass Bloom's authenticated user ID, conversation ID, a client-generated `messageId`, language, and only approved context fields.
5. Parse SSE `token` events and handle `replace`, `done`, and `error`.
6. Preserve the existing Bloom UI and feature-flag the client: `MEG_ENGINE=v1|v2`.
7. Shadow or canary requests in 5%, 20%, 50%, then 100% stages. Do not send shadow responses to users or double-write user messages.
8. Compare safety incidents, fallback rate, TTFT, completion latency, and memory relevance before promotion.

Bloom should own end-user authorization and verify that the requested user/conversation belongs to the authenticated account. The simple memory-control endpoints in this repo are service primitives, not a replacement for Bloom authorization.
