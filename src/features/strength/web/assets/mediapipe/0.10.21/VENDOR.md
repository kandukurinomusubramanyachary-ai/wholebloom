# Vendored MediaPipe Pose runtime (LOCAL ONLY — no CDN)

Place the version-pinned assets here so PoseRuntime never fetches a
third-party CDN. See `../../../web/poseRuntime.web.js`.

Runtime: @mediapipe/tasks-vision @ 0.10.21
  wasm/vision_wasm_internal.js   -> wasm/vision_wasm_internal.js
  wasm/vision_wasm_internal.wasm -> wasm/vision_wasm_internal.wasm
Model : pose_landmarker_lite.task (local copy)

Acquire from the pinned npm package / official model release, vendor the
files into this folder, and keep `POSE_RUNTIME_VERSION` in sync. `assertLocalAsset`
rejects any remote URL.
