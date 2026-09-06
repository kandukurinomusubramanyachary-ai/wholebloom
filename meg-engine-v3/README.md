# Meg Engine V3 — Adaptive Intervention Layer

Meg v3 is not a replacement chatbot. It is the decision layer that sits between Bloom's longitudinal user signals and Meg's existing language-generation stack.

## Goal

Turn this flow:

```text
message -> intent -> prompt -> LLM
```

into:

```text
user signals
   -> state estimation
   -> risk / need detection
   -> intervention selection
   -> Meg language generation
   -> outcome feedback
   -> personal intervention preference profile
   -> next intervention
```

V2 remains the reliability and generation substrate during migration: provider routing, safety, persistence, memory, guards, streaming, rate limits, and telemetry stay intact until v3 equivalents are proven.

## Current implementation

### 1. State estimator

`src/state/stateEstimator.js`

Creates a structured, inspectable state from the current turn and Bloom context. Current domains:

- emotional load
- recovery / sleep strain
- physical symptom severity
- cycle uncertainty
- food / activity relevance
- risk level
- inferred needs
- confidence and evidence

The state is observational. It must never be treated as a diagnosis.

### 2. Intervention policy

`src/interventions/interventionPolicy.js`

Ranks explicit intervention families before any LLM writes the response:

- active listening
- emotional regulation
- symptom triage / clarification
- recovery support
- cycle understanding
- nutrition support
- movement support
- doctor prep
- normal conversation
- safety escalation

The selected intervention includes a goal, stance, actions, response constraints, candidate scores, and rationale so decisions can be evaluated later.

### 3. Outcome model

`src/adaptation/outcomeModel.js`

Normalizes feedback into:

- `helped`
- `partly_helped`
- `neutral`
- `ignored`
- `worse`

Repeated outcomes build a per-intervention-family preference profile. That profile adjusts future candidate scores. Safety escalation is never personalized away.

### 4. Adaptive engine

`src/engine.js`

`evaluateTurn()` composes state estimation, preference learning, intervention selection, and a compact prompt context for the downstream Meg generator.

## Migration plan

### Phase A — shadow mode

Run v3 beside the current Meg v2 request path. Do not change the user-facing response. Log only:

- v3 state
- selected intervention
- candidate scores
- v2 intent
- safety category

Use this to discover bad state rules and policy mistakes without risking production behavior.

### Phase B — prompt steering

Feed only the selected v3 intervention instructions into the existing v2 prompt builder. Keep the current v2 safety router, provider manager, guards, memory store, and response delivery.

### Phase C — outcome loop

Add explicit and implicit feedback events and persist them per user. Examples include a user saying the suggestion helped, rejecting it, abandoning the proposed action, or choosing a different support mode.

### Phase D — longitudinal state

Replace single-turn heuristics with rolling features built from Bloom check-ins, cycle history, Strength, sleep, symptoms, meals, and user-approved longitudinal memory.

## Safety invariants

- Existing deterministic Meg safety handling remains authoritative.
- V3 state is not a medical diagnosis.
- V3 cannot prescribe medication.
- Personalization cannot weaken safety escalation.
- High pain / red-flag symptom context must suppress normal exercise encouragement.
- Irregular cycles must be represented probabilistically; no deterministic period-date promises.
- User feedback should personalize intervention style and usefulness, not medical truth.

## Development

```bash
cd meg-engine-v3
npm test
npm run check
```

No external runtime dependencies are required for the initial decision layer.
