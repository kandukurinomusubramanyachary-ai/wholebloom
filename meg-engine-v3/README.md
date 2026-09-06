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
context evidence
  user statements + Bloom logs + derived observations
      ↓
memory retrieval
  typed + scored + expiry-aware memories
      ↓
plan response
  objective + tone + must-include + must-avoid + streaming policy
      ↓
extension stages
      ↓
generate
  V3 grounded prompt + ProviderManager-compatible generator
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
- typed Bloom context evidence that distinguishes logs, user statements, and derived observations
- derived observations carry lower confidence and an explicit non-diagnostic boundary
- typed memory retrieval with source, confidence, confirmation state, expiry, relevance scoring, and current-turn precedence
- evidence-grounded V3 prompt composer driven by the response plan
- ProviderManager-compatible generator adapter so V3 can reuse V2 retry/fallback/circuit reliability
- fail-closed output guard using the proven V2 guard during migration
- provider generation metadata and per-stage timing/error telemetry in the turn result
- extension points before and after generation
- regression tests for the core pipeline, safety bypass, evidence, memory, prompt grounding, and provider adapter

## Why keep V2 pieces temporarily?

V2 already has useful, tested reliability and safety components. V3 wraps those pieces behind stage boundaries first, then replaces them one at a time with stronger implementations. This avoids a risky big-bang rewrite and gives every replacement a V2 baseline.

## Next V3 build order

1. Safety V3: context/negation-aware input risk evaluation plus stronger output validation, while retaining deterministic emergency gates.
2. Evaluation harness: run V2 and V3 against identical deterministic and live-provider cases, including quality, safety, grounding, latency, and mode adherence.
3. Memory write/correction lifecycle: persist only appropriate durable memories, support correction/supersession, and keep episodic Bloom logs separate from long-term memory.
4. Version-neutral Bloom server bridge with a guarded V2/V3 rollout flag and no client API break.
5. Shadow-mode integration before any production cutover.

## Run tests

From the repo root:

```bash
npm test --prefix meg-engine-v3
```

Meg V3 should not replace production V2 until the comparison suite and live integration checks pass.
