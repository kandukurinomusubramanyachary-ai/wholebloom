function positive(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function createCoverTransform({ sourceWidth, sourceHeight, viewWidth, viewHeight, mirrored = false }) {
  const source = { width: positive(sourceWidth), height: positive(sourceHeight) };
  const view = { width: positive(viewWidth), height: positive(viewHeight) };
  const scale = Math.max(view.width / source.width, view.height / source.height);
  const renderedWidth = source.width * scale;
  const renderedHeight = source.height * scale;
  return {
    sourceWidth: source.width,
    sourceHeight: source.height,
    viewWidth: view.width,
    viewHeight: view.height,
    scale,
    offsetX: (view.width - renderedWidth) / 2,
    offsetY: (view.height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
    mirrored: Boolean(mirrored),
  };
}

function mapNormalizedPoint(point, transform) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  const sourceX = Number(point.x) * transform.sourceWidth;
  const sourceY = Number(point.y) * transform.sourceHeight;
  const unmirroredX = transform.offsetX + sourceX * transform.scale;
  return {
    ...point,
    x: transform.mirrored ? transform.viewWidth - unmirroredX : unmirroredX,
    y: transform.offsetY + sourceY * transform.scale,
  };
}

module.exports = { createCoverTransform, mapNormalizedPoint };
