# Meg Engine V3

Meg V3 is the next conversational engine for Bloom. It is being built side-by-side with the live Meg V2 engine so V2 remains the production fallback until V3 wins regression, safety, quality, and latency evaluations.

## V3 design rule

A turn is a sequence of explicit, observable stages rather than one large chat handler.

```text
validated turn state
      ↓
understand
  safety + intent + complexity + route
      ↓
plan response
  objective + tone + must-include + must-avoid + streaming policy
      ↓
extension stages
  context / memory / tools / knowledge
      ↓
generate
      ↓
extension stages
  factuality / quality / specialized validators
      ↓
guard response
      ↓
public Meg response
```

## What exists in alpha.1

- strict turn input/state contract
- observable staged pipeline with required/optional failure boundaries
- compatibility wrapper around V2 deterministic safety, intent, and model routing
- explicit response planner for Listen, Understand, Plan, Conversation, and Doctor modes
- deterministic urgent-safety bypass that does not call a model
- generator interface independent of provider implementation
- fail-closed output guard using the proven V2 guard during migration
- extension points before and after generation
- initial regression tests

## Why keep V2 pieces temporarily?

V2 already has useful, tested reliability and safety components. V3 wraps those pieces behind stage boundaries first, then replaces them one at a time with stronger implementations. This avoids a risky big-bang rewrite and gives every replacement a V2 baseline.

## Near-term V3 build order

1. Structured context evidence model: distinguish user-stated facts, Bloom logs, derived observations, and memories.
2. Memory V3: typed memory with source, confidence, confirmation state, expiry, correction, and retrieval scoring.
3. Provider adapter that reuses V2 ProviderManager reliability while V3 owns routing policy.
4. Prompt composer driven by the response plan instead of a monolithic static prompt.
5. Input and output safety V3 with negation/context tests and safety-sensitive buffered generation.
6. Evaluation harness comparing V2 vs V3 on identical cases.
7. Version-neutral Bloom server bridge and guarded rollout flag.

## Run tests

From the repo root:

```bash
npm test --prefix meg-engine-v3
```

Meg V3 should not replace production V2 until the comparison suite and live integration checks pass.
