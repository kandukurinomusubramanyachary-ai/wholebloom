const { distance, midpoint, point } = require('./jointAngles');

function visibilityOf(item) {
  return Number(item?.visibility ?? item?.presence ?? 0);
}

function bodyBounds(landmarks) {
  const visible = (landmarks || []).filter((item) => visibilityOf(item) >= 0.35);
  if (!visible.length) return null;
  const xs = visible.map((item) => Number(item.x));
  const ys = visible.map((item) => Number(item.y));
  return {
    left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
  };
}

function checkBodyFraming(landmarks, cameraView, thresholds = {}) {
  const bounds = bodyBounds(landmarks);
  if (!bounds) return { ok: false, reason: 'no_pose', instruction: 'Looking for you…' };
  const bodyHeight = bounds.bottom - bounds.top;
  const centreX = (bounds.left + bounds.right) / 2;
  const minimumHeight = thresholds.minimumHeight ?? 0.55;
  const maximumHeight = thresholds.maximumHeight ?? 0.9;
  if (bodyHeight < minimumHeight) return { ok: false, reason: 'too_far', instruction: 'Come a little closer.' };
  if (bodyHeight > maximumHeight) return { ok: false, reason: 'too_close', instruction: 'Step back a little.' };
  const displayCentreX = thresholds.mirrored ? 1 - centreX : centreX;
  if (displayCentreX < 0.2) return { ok: false, reason: 'off_centre', instruction: 'Move slightly to your right.' };
  if (displayCentreX > 0.8) return { ok: false, reason: 'off_centre', instruction: 'Move slightly to your left.' };

  const ankles = [point(landmarks, 27), point(landmarks, 28)];
  const feet = [point(landmarks, 31), point(landmarks, 32)];
  if ([...ankles, ...feet].some((item) => !item || visibilityOf(item) < 0.5 || item.y > 0.99)) {
    return { ok: false, reason: 'feet_out', instruction: 'Step back so I can see both feet.' };
  }

  const shoulderMid = midpoint(point(landmarks, 11), point(landmarks, 12));
  const hipMid = midpoint(point(landmarks, 23), point(landmarks, 24));
  const torso = distance(shoulderMid, hipMid) || 0.001;
  const shoulderWidth = Math.abs((point(landmarks, 11)?.x || 0) - (point(landmarks, 12)?.x || 0));
  const hipWidth = Math.abs((point(landmarks, 23)?.x || 0) - (point(landmarks, 24)?.x || 0));
  if (cameraView === 'side-view') {
    const aligned = Math.abs((hipMid?.x || 0) - (shoulderMid?.x || 0)) < 0.1;
    if (shoulderWidth >= 0.3 * torso || !aligned) {
      return { ok: false, reason: 'wrong_angle', instruction: 'Turn slightly to your side.' };
    }
  } else if (shoulderWidth < 0.6 * torso || hipWidth < 0.4 * torso) {
    return { ok: false, reason: 'wrong_angle', instruction: 'Face the camera more directly.' };
  }
  return { ok: true, reason: null, instruction: 'Good — I can see your full body.', bodyHeight, centreX };
}

function requiredLandmarksVisible(landmarks, ids, threshold = 0.5) {
  const missing = (ids || []).filter((id) => visibilityOf(point(landmarks, id)) < threshold);
  return { ok: missing.length === 0, missing };
}

module.exports = { bodyBounds, checkBodyFraming, requiredLandmarksVisible, visibilityOf };
