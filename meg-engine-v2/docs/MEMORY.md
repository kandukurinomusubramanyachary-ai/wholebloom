# Memory

## Layers

- **Working memory**: the latest configurable conversation turns, default eight.
- **Profile memory**: durable preferences, goals, and response-style preferences.
- **Episodic memory**: time-bound observations such as poor sleep, cravings, or a late cycle.
- **Derived pattern memory**: Bloom-provided observations with explicit provenance and “not a diagnosis” wording.

## Retrieval

`memoryRetriever.js` uses a replaceable local ranking function:

```text
relevance = keyword overlap + category match + recency + importance - redundancy
```

No hosted vector database is required. The interface can later be replaced with embeddings while keeping the handler and prompt composer unchanged. The default result is limited to five items, and unrelated memories are excluded rather than padded.

## Writes

`memoryExtractor.js` stores small deterministic facts only. It does not store every sentence. Exact content is deduplicated in the store. Context-derived patterns retain their source wording and are not turned into medical conclusions.

Memory extraction is post-answer work. If it fails, the streamed answer is unaffected.

## User controls

The store supports clearing all or one layer of a user's memories, exporting user messages/memories, and deleting a conversation plus conversation-scoped memories. The HTTP primitives are available under `/v2/memory` and `/v2/conversations/:conversationId`; Bloom should put its own authorization/ownership layer in front of them before exposing them to end users.

## Limitations

The current scorer is lexical, not semantic. It cannot reliably resolve synonyms or pronouns. It also stores only facts surfaced by deterministic patterns; a later version should add reviewed extraction rules or an optional cheap/local extractor with explicit consent and deletion semantics.
