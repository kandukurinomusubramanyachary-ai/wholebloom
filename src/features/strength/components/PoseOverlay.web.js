import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { createCoverTransform, mapNormalizedPoint } from '../engine/poseTransform';

const BODY_CONNECTIONS = Object.freeze([
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
]);

const JOINTS = Object.freeze([11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]);

function pointConfidence(point) {
  if (!point) return 0;
  return Math.min(Number(point.visibility ?? 1), Number(point.presence ?? 1));
}

function resizeCanvas(canvas) {
  const width = Math.max(1, canvas.clientWidth || 1);
  const height = Math.max(1, canvas.clientHeight || 1);
  const density = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const pixelWidth = Math.round(width * density);
  const pixelHeight = Math.round(height * density);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  return { width, height, density };
}

export function clearPoseOverlay(canvas) {
  const context = canvas?.getContext?.('2d');
  if (!context) return;
  const { width, height, density } = resizeCanvas(canvas);
  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
}

export function drawPoseOverlay(canvas, frame) {
  const context = canvas?.getContext?.('2d');
  if (!context) return;
  const { width, height, density } = resizeCanvas(canvas);
  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!frame?.landmarks?.length || !frame.sourceWidth || !frame.sourceHeight) return;

  const transform = createCoverTransform({
    sourceWidth: frame.sourceWidth,
    sourceHeight: frame.sourceHeight,
    viewWidth: width,
    viewHeight: height,
    mirrored: frame.mirrored,
  });
  const points = frame.landmarks.map((point) => mapNormalizedPoint(point, transform));

  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = 3;
  for (const [from, to] of BODY_CONNECTIONS) {
    const a = points[from];
    const b = points[to];
    const confidence = Math.min(pointConfidence(a), pointConfidence(b));
    const grace = Boolean(a?.stale || b?.stale);
    if (!a || !b || (!grace && confidence < 0.5)) continue;
    context.globalAlpha = grace ? 0.38 : Math.max(0.62, confidence);
    context.strokeStyle = '#F7F4F5';
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }

  for (const id of JOINTS) {
    const joint = points[id];
    const confidence = pointConfidence(joint);
    if (!joint || (!joint.stale && confidence < 0.5)) continue;
    context.globalAlpha = joint.stale ? 0.42 : Math.max(0.7, confidence);
    context.fillStyle = '#EE718B';
    context.strokeStyle = '#F7F4F5';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(joint.x, joint.y, id >= 23 ? 4.5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.globalAlpha = 1;
}

const PoseOverlay = forwardRef(function PoseOverlay(_props, ref) {
  const canvasRef = useRef(null);
  useImperativeHandle(ref, () => ({
    clear: () => clearPoseOverlay(canvasRef.current),
    draw: (frame) => drawPoseOverlay(canvasRef.current, frame),
  }), []);
  return <canvas ref={canvasRef} aria-hidden='true' style={styles.canvas} />;
});

const styles = {
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
};

export default PoseOverlay;
