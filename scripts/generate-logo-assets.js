const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'assets', 'bloom-logo-final.png');
const SOURCE_SHA256 = 'DA9D34D38A5139F1E5FA456856A4D8C6846AA80EF9EA11E29FE71EE0928E9A28';
const BACKGROUND = [255, 253, 254, 255];
const TRANSPARENT = [0, 0, 0, 0];
const LOTUS_CROP = { x: 260, y: 30, width: 406, height: 324 };
const ADAPTIVE_SAFE_RADIUS = 1024 * 33 / 108;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function createCanvas(width, height, color) {
  const png = new PNG({ width, height, colorType: 6 });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = color[0];
    png.data[offset + 1] = color[1];
    png.data[offset + 2] = color[2];
    png.data[offset + 3] = color[3];
  }
  return png;
}

function boundsFor(png, predicate, rect = { x: 0, y: 0, width: png.width, height: png.height }) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      if (!predicate(png.data, offset)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert(maxX >= minX && maxY >= minY, 'Expected visible artwork but found none');
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    maxX,
    maxY,
  };
}

function sourcePixel(source, x, y, rect) {
  if (x < rect.x || y < rect.y || x >= rect.x + rect.width || y >= rect.y + rect.height) {
    return [0, 0, 0, 0];
  }
  const offset = (y * source.width + x) * 4;
  return [
    source.data[offset],
    source.data[offset + 1],
    source.data[offset + 2],
    source.data[offset + 3],
  ];
}

function samplePremultiplied(source, sourceX, sourceY, rect) {
  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const tx = sourceX - x0;
  const ty = sourceY - y0;
  const samples = [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x0 + 1, y0, tx * (1 - ty)],
    [x0, y0 + 1, (1 - tx) * ty],
    [x0 + 1, y0 + 1, tx * ty],
  ];

  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const [x, y, weight] of samples) {
    const pixel = sourcePixel(source, x, y, rect);
    const normalizedAlpha = pixel[3] / 255;
    alpha += normalizedAlpha * weight;
    red += pixel[0] * normalizedAlpha * weight;
    green += pixel[1] * normalizedAlpha * weight;
    blue += pixel[2] * normalizedAlpha * weight;
  }

  if (alpha === 0) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function compositePixel(target, offset, sourcePixelValue) {
  const sourceAlpha = sourcePixelValue[3] / 255;
  if (sourceAlpha === 0) return;

  const targetAlpha = target.data[offset + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  const red = sourcePixelValue[0] * sourceAlpha
    + target.data[offset] * targetAlpha * (1 - sourceAlpha);
  const green = sourcePixelValue[1] * sourceAlpha
    + target.data[offset + 1] * targetAlpha * (1 - sourceAlpha);
  const blue = sourcePixelValue[2] * sourceAlpha
    + target.data[offset + 2] * targetAlpha * (1 - sourceAlpha);

  target.data[offset] = Math.round(red / outputAlpha);
  target.data[offset + 1] = Math.round(green / outputAlpha);
  target.data[offset + 2] = Math.round(blue / outputAlpha);
  target.data[offset + 3] = Math.round(outputAlpha * 255);
}

function drawScaled(target, source, sourceRect, destinationRect) {
  const startX = Math.max(0, Math.floor(destinationRect.x));
  const startY = Math.max(0, Math.floor(destinationRect.y));
  const endX = Math.min(target.width, Math.ceil(destinationRect.x + destinationRect.width));
  const endY = Math.min(target.height, Math.ceil(destinationRect.y + destinationRect.height));

  for (let y = startY; y < endY; y += 1) {
    const sourceY = sourceRect.y
      + ((y + 0.5 - destinationRect.y) / destinationRect.height) * sourceRect.height
      - 0.5;
    for (let x = startX; x < endX; x += 1) {
      const sourceX = sourceRect.x
        + ((x + 0.5 - destinationRect.x) / destinationRect.width) * sourceRect.width
        - 0.5;
      const pixel = samplePremultiplied(source, sourceX, sourceY, sourceRect);
      compositePixel(target, (y * target.width + x) * 4, pixel);
    }
  }
}

function drawCenteredLotus(target, source, visibleWidth) {
  const alphaBounds = boundsFor(source, (data, offset) => data[offset + 3] > 0, LOTUS_CROP);
  const scale = visibleWidth / alphaBounds.width;
  const sourceCenterX = alphaBounds.x + (alphaBounds.width - 1) / 2;
  const sourceCenterY = alphaBounds.y + (alphaBounds.height - 1) / 2;
  const destinationX = (target.width - 1) / 2 - (sourceCenterX - LOTUS_CROP.x) * scale;
  const destinationY = (target.height - 1) / 2 - (sourceCenterY - LOTUS_CROP.y) * scale;

  drawScaled(target, source, LOTUS_CROP, {
    x: destinationX,
    y: destinationY,
    width: LOTUS_CROP.width * scale,
    height: LOTUS_CROP.height * scale,
  });
}

function drawCenteredLockup(target, source, width) {
  const scale = width / source.width;
  drawScaled(target, source, { x: 0, y: 0, width: source.width, height: source.height }, {
    x: (target.width - width) / 2,
    y: (target.height - source.height * scale) / 2,
    width,
    height: source.height * scale,
  });
}

function isBackground(data, offset) {
  return data[offset] === BACKGROUND[0]
    && data[offset + 1] === BACKGROUND[1]
    && data[offset + 2] === BACKGROUND[2]
    && data[offset + 3] === BACKGROUND[3];
}

function assertDimensions(png, width, height, label) {
  assert(png.width === width && png.height === height, label + ' has incorrect dimensions');
}

function assertOpaque(png, label) {
  for (let offset = 3; offset < png.data.length; offset += 4) {
    assert(png.data[offset] === 255, label + ' must be fully opaque');
  }
}

function assertCentered(bounds, png, label, tolerance = 2) {
  const centerX = bounds.x + (bounds.width - 1) / 2;
  const centerY = bounds.y + (bounds.height - 1) / 2;
  assert(Math.abs(centerX - (png.width - 1) / 2) <= tolerance, label + ' is not horizontally centered');
  assert(Math.abs(centerY - (png.height - 1) / 2) <= tolerance, label + ' is not vertically centered');
}

function assertAdaptiveSafe(png) {
  const center = (png.width - 1) / 2;
  let maximumRadius = 0;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha === 0) continue;
      maximumRadius = Math.max(maximumRadius, Math.hypot(x - center, y - center));
    }
  }

  assert(maximumRadius <= ADAPTIVE_SAFE_RADIUS, 'Adaptive artwork leaves Android safe zone');
  return maximumRadius;
}

function writeAsset(relativePath, png) {
  const output = PNG.sync.write(png);
  const absolutePath = path.join(ROOT, relativePath);
  fs.writeFileSync(absolutePath, output);
  return { output, absolutePath };
}

const sourceBuffer = fs.readFileSync(SOURCE_PATH);
assert(sha256(sourceBuffer) === SOURCE_SHA256, 'The supplied Bloom logo changed; verify the new master before generating assets');

const source = PNG.sync.read(sourceBuffer);
assertDimensions(source, 926, 558, 'Supplied Bloom logo');

const lotusBounds = boundsFor(source, (data, offset) => data[offset + 3] > 0, LOTUS_CROP);
assert(lotusBounds.x === 269 && lotusBounds.y === 40, 'Unexpected lotus position in supplied logo');
assert(lotusBounds.width === 388 && lotusBounds.height === 304, 'Unexpected lotus dimensions in supplied logo');

for (let y = LOTUS_CROP.y; y < LOTUS_CROP.y + LOTUS_CROP.height; y += 1) {
  for (let x = LOTUS_CROP.x; x < LOTUS_CROP.x + LOTUS_CROP.width; x += 1) {
    const offset = (y * source.width + x) * 4;
    if (source.data[offset + 3] === 0) continue;
    const isDarkInk = source.data[offset] < 100 && source.data[offset + 1] < 100 && source.data[offset + 2] < 100;
    assert(!isDarkInk, 'The launcher crop unexpectedly contains wordmark pixels');
  }
}

const icon = createCanvas(1024, 1024, BACKGROUND);
drawCenteredLotus(icon, source, 600);
assertDimensions(icon, 1024, 1024, 'General icon');
assertOpaque(icon, 'General icon');
const iconBounds = boundsFor(icon, (data, offset) => !isBackground(data, offset));
assertCentered(iconBounds, icon, 'General icon');

const adaptive = createCanvas(1024, 1024, TRANSPARENT);
drawCenteredLotus(adaptive, source, 600);
assertDimensions(adaptive, 1024, 1024, 'Adaptive icon');
const adaptiveBounds = boundsFor(adaptive, (data, offset) => data[offset + 3] > 0);
assertCentered(adaptiveBounds, adaptive, 'Adaptive icon');
const adaptiveRadius = assertAdaptiveSafe(adaptive);

const favicon = createCanvas(64, 64, BACKGROUND);
drawCenteredLotus(favicon, source, 48);
assertDimensions(favicon, 64, 64, 'Favicon');
assertOpaque(favicon, 'Favicon');
assertCentered(boundsFor(favicon, (data, offset) => !isBackground(data, offset)), favicon, 'Favicon');

const splash = createCanvas(1242, 2436, BACKGROUND);
drawCenteredLockup(splash, source, 720);
assertDimensions(splash, 1242, 2436, 'Splash');
assertOpaque(splash, 'Splash');
const splashBounds = boundsFor(splash, (data, offset) => !isBackground(data, offset));
assertCentered(splashBounds, splash, 'Splash');

const generated = [
  ['assets/icon.png', icon],
  ['assets/adaptive-icon.png', adaptive],
  ['assets/favicon.png', favicon],
  ['assets/splash.png', splash],
];

for (const [relativePath, png] of generated) {
  const result = writeAsset(relativePath, png);
  console.log(relativePath + ' ' + png.width + 'x' + png.height + ' SHA-256 ' + sha256(result.output));
}

console.log(
  'Adaptive visible bounds '
  + adaptiveBounds.x + ',' + adaptiveBounds.y + ' '
  + adaptiveBounds.width + 'x' + adaptiveBounds.height
  + '; maximum radius ' + adaptiveRadius.toFixed(2) + 'px / '
  + ADAPTIVE_SAFE_RADIUS.toFixed(2) + 'px safe radius'
);
console.log(
  'Splash visible bounds '
  + splashBounds.x + ',' + splashBounds.y + ' '
  + splashBounds.width + 'x' + splashBounds.height
);

