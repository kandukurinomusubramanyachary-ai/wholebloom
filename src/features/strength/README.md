# Bloom Strength

Strength replaces the former Insights tab when `EXPO_PUBLIC_BLOOM_STRENGTH=1` on web. When disabled, the primary navigation contains four tabs. Native builds use the camera-free guided counter.

## Privacy boundary

The browser requests camera access only after the user reads the explanation and presses **Enable camera**. MediaPipe Pose Landmarker Lite, its WASM runtime, and model are served from Bloom's local `/public/strength` assets. Frames are read into memory for synchronous inference, never recorded, never uploaded, and discarded after each call.

Only the strict summary allowlist in `engine/strengthPrivacy.js` can enter the UID-scoped device outbox, Firestore, or Strength analytics validation. The Firestore rules independently enforce the same document shape. Bloom currently has no analytics transport, so Strength analytics is a validated no-op.

## Deterministic engine

Each exercise owns versioned states, thresholds, deadbands, required joints, and form cue conditions. The shared rep machine applies confidence gating, minimum transition frames and hold time, minimum cycle time, pause/re-entry behavior, and deterministic accepted-rep events. It does not import Meg or any language model.

Run focused tests with:

```bash
node server/strengthEngine.test.js
```

Exercise thresholds are marked `pending-pro` until professional review. They are product tuning values, not medical claims.

## Native pose runtime decision

Bloom will evaluate `react-native-mediapipe-posedetection@0.4.0` before any custom
Swift or Kotlin pose module is written. It is the maintained candidate that most
closely matches the current requirements: React Native 0.74+, iOS and Android,
VisionCamera live frames, MediaPipe's 33 landmarks, presence and visibility
confidence, mirror controls, GPU delegates, an Expo config plugin, and bounded
15 FPS delivery.

This is a compatibility candidate, not an assumed dependency. It requires React
Native's New Architecture while Bloom is still on Expo SDK 51. Native adoption is
therefore gated by all of the following in a disposable development-build spike:

1. Expo prebuild completes with the package config plugin and local Lite model.
2. Android and iOS development builds compile without manual native-project edits.
3. Front-camera landmarks remain aligned in portrait with cover cropping.
4. A ten-minute session stays within the latency and memory budgets.
5. Camera denial, backgrounding, rotation, and detector failure return to Bloom's
   camera-free guidance without losing the session.

If the candidate fails one of those requirements, the failure and attempted
version will be recorded here before considering a local Expo native module.
Expo Go continues to use the honest camera-free flow.
