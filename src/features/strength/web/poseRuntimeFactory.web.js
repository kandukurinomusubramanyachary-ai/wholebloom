/**
 * Bloom Strength — production web pose-runtime factory.
 *
 * Bloom integration code calls `createWebPoseRuntime()` and gets a ready
 * PoseRuntime without understanding MediaPipe internals. The factory:
 *   - imports the version-pinned VENDORED tasks-vision package (no CDN),
 *   - resolves the WASM directory and the model file as LOCAL asset URLs
 *     relative to this module (`new URL(..., import.meta.url)`), which web
 *     bundlers (Vite/webpack/Metro-web) inline and serve same-origin,
 *   - configures the GPU→CPU delegate fallback inside PoseRuntime.
 *
 * Binary assets are vendored under ./assets/mediapipe/<version>/. The release
 * check in ./checkAssets.mjs FAILS the build if any required file is missing,
 * so a missing runtime is obvious before integration.
 */

import {
  PoseRuntime,
  POSE_RUNTIME_VERSION,
  POSE_ASSET_MANIFEST,
} from './poseRuntime.web.js';

const ASSET_DIR = `./assets/mediapipe/${POSE_RUNTIME_VERSION}`;
const ESM_REL = `${ASSET_DIR}/vision_bundle.mjs`;
const WASM_DIR_REL = `${ASSET_DIR}/wasm/`;
const MODEL_REL = `${ASSET_DIR}/pose_landmarker_lite.task`;

/**
 * Default loader: dynamically import the VENDORED, version-pinned tasks-vision
 * ESM (copied under ./assets/mediapipe/<version>/), NOT the npm package and NOT
 * a CDN. The URL is resolved relative to this module so bundlers inline it
 * same-origin. Injectable so Node tests can supply a fake.
 */
async function defaultLoadVisionTasks() {
  const url = new URL(ESM_REL, import.meta.url).href;
  return await import(/* webpackIgnore: true */ url);
}

/** Resolve the local WASM directory URL (trailing slash required). */
function defaultResolveWasmUrl() {
  return new URL(WASM_DIR_REL, import.meta.url).href;
}

/** Resolve the local model file URL. */
function defaultResolveModelUrl() {
  return new URL(MODEL_REL, import.meta.url).href;
}

/**
 * Create a production PoseRuntime. All hooks are injectable for tests.
 */
export function createWebPoseRuntime({
  now,
  sleep,
  loadVisionTasks = defaultLoadVisionTasks,
  resolveWasmUrl = defaultResolveWasmUrl,
  resolveModelUrl = defaultResolveModelUrl,
  gpuAttempts,
  cpuAttempts,
  maxPoses,
} = {}) {
  const wasmPath = resolveWasmUrl();
  const modelPath = resolveModelUrl();
  return new PoseRuntime({
    loadVisionTasks,
    paths: { wasmPath, modelPath },
    now,
    sleep,
    gpuAttempts,
    cpuAttempts,
    maxPoses,
  });
}

export { POSE_ASSET_MANIFEST, POSE_RUNTIME_VERSION };
