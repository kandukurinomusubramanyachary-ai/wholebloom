/**
 * Bloom Strength — vendored MediaPipe asset release check.
 *
 * Fails loudly (exit code 1) if the version-pinned LOCAL pose-runtime assets
 * are missing, so an integration build never silently falls back to a CDN.
 * Run directly:
 *
 *   node src/features/strength/web/checkAssets.mjs
 *
 * The pure checker `checkVendoredAssets()` is exported and unit-tested with an
 * injected fake fs so the gate itself is deterministic.
 */

import { fileURLToPath } from 'node:url';
import nodeFs from 'node:fs';
import path from 'node:path';
import { POSE_ASSET_MANIFEST, POSE_RUNTIME_VERSION } from './poseRuntime.web.js';

export const ASSET_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'assets',
  'mediapipe',
  POSE_RUNTIME_VERSION,
);

/**
 * Verify every required vendored asset exists.
 * @param {object} [opts]
 * @param {{existsSync:function}} [opts.fs] inject fs (defaults to node fs)
 * @param {string} [opts.baseDir] asset root (defaults to the ASSET_DIR)
 * @returns {{ ok: boolean, missing: string[], present: string[], baseDir: string }}
 */
export function checkVendoredAssets({ fs = nodeFs, baseDir = ASSET_DIR } = {}) {
  const present = [];
  const missing = [];
  for (const rel of POSE_ASSET_MANIFEST.requiredFiles) {
    // Required files are relative web paths like ./assets/mediapipe/<v>/wasm/x
    const cleaned = rel.replace(/^\.\//, '');
    const absolute = path.join(
      baseDir,
      cleaned.replace(`assets/mediapipe/${POSE_RUNTIME_VERSION}/`, ''),
    );
    if (fs.existsSync(absolute)) present.push(rel);
    else missing.push(rel);
  }
  return { ok: missing.length === 0, missing, present, baseDir };
}

// CLI entry (only runs when executed directly, not when imported).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = checkVendoredAssets();
  if (result.ok) {
    console.log(`[strength] vendored pose assets present (v${POSE_RUNTIME_VERSION}).`);
    process.exit(0);
  }
  console.error('[strength] MISSING VENDORED POSE-RUNTIME ASSETS — CDN fallback is not allowed.');
  console.error(`  expected under: ${result.baseDir}`);
  for (const m of result.missing) console.error(`  - ${m}`);
  console.error('  Vendor @mediapipe/tasks-vision WASM build + pose_landmarker_lite.task.');
  process.exit(1);
}
