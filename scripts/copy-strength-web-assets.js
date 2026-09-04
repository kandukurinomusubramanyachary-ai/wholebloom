const fs = require('node:fs');
const path = require('node:path');

const version = '0.10.21';
const source = path.join(
  __dirname,
  '..',
  'src',
  'features',
  'strength',
  'web',
  'assets',
  'mediapipe',
  version
);
const destination = path.join(__dirname, '..', 'dist', 'strength', 'mediapipe', version);

if (!fs.existsSync(source)) {
  throw new Error(`Strength MediaPipe assets are missing at ${source}`);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });

const required = [
  'vision_bundle.mjs',
  'pose_landmarker_lite.task',
  path.join('wasm', 'vision_wasm_internal.js'),
  path.join('wasm', 'vision_wasm_internal.wasm'),
  path.join('wasm', 'vision_wasm_nosimd_internal.js'),
  path.join('wasm', 'vision_wasm_nosimd_internal.wasm'),
];

for (const relative of required) {
  const target = path.join(destination, relative);
  if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
    throw new Error(`Strength web asset was not copied: ${relative}`);
  }
}

console.log(`Copied Strength MediaPipe ${version} assets to dist/strength/mediapipe/${version}`);
