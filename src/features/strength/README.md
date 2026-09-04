# Bloom Strength — deterministic engine

The private, calm, camera-guided first strength set for PCOS beginners.
This package implements the P0 closed-beta slice from the Bloom Strength PRD
(v2.0, repo baseline `wholebloom/main@cf758ee`).

## What lives here

The engine is **pure JavaScript with zero runtime dependencies** so every
counted rep and spoken cue can be reproduced in tests without React, camera,
network or any LLM.

```
src/features/strength/
  engine/
    geometry.js         — angle/distance helpers over MediaPipe landmarks
    smoothing.js        — EMA smoothing + one-frame jump rejection
    confidence.js       — landmark visibility, view detection, framing gate,
                          multi-person count (the ONLY gating layer)
    exercises.js        — the three VERSIONED exercise assets (squat v1,
                          wall push-up v1, side-leg-raise v1): thresholds,
                          measurements, state-machine config, cue conditions
    repMachine.js       — deterministic rep state machine (explicit states,
                          min frames, peak hold, hysteresis, min cycle)
    positioningCoach.js — one-instruction calibration, 2s stable hold,
                          tracking cues, auto-pause + re-entry; view locked
                          at calibration
    cueScheduler.js     — priority arbitration, 3s gap, 4 cues/min cap,
                          per-cue cooldowns, stale-speech cancellation
    session.js          — one set's lifecycle: calibration → countdown →
                          active → summary; camera-free manual counter;
                          slow-inference fallback signal; hidden-tab pause
    reviewGate.js       — professional-review sign-off gate (all three
                          ship `pending-pro`; no public exposure until
                          approved on-device)
  services/
    strengthPrivacy.js  — strict summary serializer (only the approved
                          schema leaves the device), deep forbidden-key
                          scan, analytics event allowlist
    strengthStorage.js  — local-first storage + UID-scoped outbox, retry,
                          deletion; never cross-UID reads
    voiceCoach.js       — browser speech-synthesis wrapper; every utterance
                          mirrored as visible text; works muted/text-only
  strengthCopy.js       — all user-facing copy + banned-word guardrail list
server/
  strengthEngine.test.js — 48 deterministic tests (run `npm test`)
  test-harness/
    poseFactory.js      — synthetic MediaPipe landmarks with kinematically
                          exact angles for scripted, camera-free validation
```

## Boundary rules (enforced by design and tests)

- **No LLM** participates in camera interpretation, counting, cue selection
  or safety. Rep counts come from a state machine over explicit angles.
- **No frames, video, audio, landmarks, coordinates or angle timelines**
  leave the device: `strengthPrivacy.serializeSessionSummary` whitelists the
  14-field summary schema and `assertNoForbiddenData` deep-scans payloads;
  unknown input fields are rejected, not silently dropped.
- **No microphone permission is ever requested** (voice is local
  synthesis only).
- **Engine must not import React, Firebase or any network API.** Screen and
  service layers are the only places allowed to touch those.
- **Strength never reads or writes Meg** state, prompts or conversations.

## Determinism and tests

All time is injected (`now()` clock) and poses are fed frame-by-frame, so a
session is a pure function of (inputs, timestamps). Run:

```sh
npm test
```

The suite covers: smoothing/jump rejection, visibility and framing, complete
cycles for all three exercises, partial/jitter rejection, minimum cycle
time, frozen state on lost confidence, calibration hold, wrong-view cue,
tracking→auto-pause→re-entry, cue priority/cap/cooldown/encouragement
once-per-set, multi-person immediate pause, low-confidence non-counting,
camera-free manual counter, stopped/completed summaries, hidden-tab pause,
slow-inference fallback, privacy serializer rejections, analytics
allowlist, UID outbox isolation/deletion/logout, the review gate, and the
banned-copy scan.

## Versioned exercise assets

Each exercise ships as one asset: camera view, required landmarks,
measurements, thresholds (in `classify`), state machine config and cue
conditions. **Any threshold change increments `exerciseVersion`** and
invalidates the professional sign-off in `reviewGate.js`. v1 status for all
three is `pending-pro` — engineering starting values, NOT clinically
signed off. No public availability until a qualified physiotherapist/strength
professional reviews movement, angles, cues and safety wording ON-DEVICE
(PRD §9).

## Integration points for the Expo web screen (CameStage.web / PoseDetector.web)

1. Open `getUserMedia({ video: { facingMode: 'user' }, audio: false })`.
2. Run the version-pinned local MediaPipe Pose Landmarker Lite; pass
   `[{ landmarks }]` (up to two poses) to `session.feedPoses()` per inference.
3. Use `result.cues[].id` → `strengthCopy.CUE_COPY` for visible text, and
   `VoiceCoach.speakCue()` for local speech (cancelled when the session
   returns a new cue or `silence`).
4. Map `result.instruction` / `tracking` / `paused` / `calibrationReady`
   to the calibration overlay, auto-pause sheet and progress UI.
5. On end, persist `session.buildSummary()` through
   `serializeSessionSummary()` → `StrengthOutbox.saveSession()`. The
   `display` object is for rendering only and is stripped by the serializer.
6. `session.checkSlowInference()` drives the offer of camera-free mode.
7. Call `session.onHidden()` on visibilitychange/blur; stop all media tracks
   on completion, Stop, route exit, background, logout or fatal error.

The native screen resolves to the camera-free build (manual +1 counter),
which uses the same session in `mode: 'camera-free'`.

## Hardening pass (production-readiness)

New boundaries and modules — all injected/clock-driven and testable without a
camera/DOM:

```
web/
  cameraStage.web.js      — REAL getUserMedia boundary: explicit user-action
                            start only, video-only (audio:false), front-facing,
                            mirrored preview, deterministic track cleanup on
                            stop/completion/unmount/hidden/logout/fatal.
  poseRuntime.web.js      — version-pinned LOCAL MediaPipe Tasks-Vision wrapper
                            (0.10.21, vendored under web/assets/, no CDN),
                            up to two poses, transient landmarks only, bounded
                            load retry + camera-free fallback, dispose().
  strengthController.web.js
                          — framework-agnostic orchestrator composing camera +
                            pose runtime + session + inference monitor + outbox;
                            one call surface for the web screen.
validation/
  deviceValidation.js     — real-device harness: the three exercises only,
                            ground-truth vs engine counts, FPS/latency/disagree,
                            privacy-safe aggregates, no silent tuning.
engine/
  inferenceMonitor.js     — effective FPS/latency; <8fps for 5s latches the
                            camera-free recommendation.
  exerciseFingerprint.js  — stable hash of machine gates/classify/form-cue
                            source; a threshold move changes the fingerprint
                            and must bump exerciseVersion + re-run review.
index.js                  — public integration surface (single import for Bloom).
```

Key contracts now enforced:
- `buildSummary()` → `StrengthOutbox.saveSession()` round-trips; the
  `display` block is display-only and is stripped (never persisted); unknown
  fields still fail closed.
- `flush()` permanently removes synced records; failures stay queued (no stale
  re-add).
- Two people block calibration, active evaluation and re-entry; only person-0
  is geometrically evaluated.
- Calibration/paused/re-entry tracking cues and persistent system cues pass
  through the scheduler (gap/cooldown/cap), not per-frame.
- Sustained pose relocation reseeds the smoother and freezes rep evaluation
  until confidence recovers.
- Re-entry hold time never counts as active movement; the set stays paused
  until `resumeReady`.
- Rep counting verified deterministic at 8/10/12/15 fps and under
  irregular/dropped frames.
- `platform` is explicit (`web`|`native`); session ids use an injected factory
  for idempotent persistence.

Run everything with `npm test` (deterministic, zero dependencies).
