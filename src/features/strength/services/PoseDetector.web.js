import { STRENGTH_DEFAULTS } from '../constants';

let visionPromise = null;

function loadLocalVisionBundle() {
  if (window.Vision) return Promise.resolve(window.Vision);
  if (visionPromise) return visionPromise;
  const pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/strength/vision_bundle.js';
    script.async = true;
    script.onload = () => {
      if (window.Vision) resolve(window.Vision);
      else {
        script.remove();
        reject(new Error('pose_runtime_missing'));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('pose_runtime_failed'));
    };
    document.head.appendChild(script);
  });
  visionPromise = pending.catch((error) => {
    visionPromise = null;
    throw error;
  });
  return visionPromise;
}

export async function createPoseDetector(options = {}) {
  const config = { ...STRENGTH_DEFAULTS, ...options };
  const { FilesetResolver, PoseLandmarker } = await loadLocalVisionBundle();
  const vision = await FilesetResolver.forVisionTasks(config.wasmAssetPath);
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: config.modelAssetPath, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numPoses: config.poseCount,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
  let closed = false;

  return {
    detect(video, timestamp) {
      if (closed) return { poses: [], latencyMs: 0, sourceWidth: 0, sourceHeight: 0 };
      const began = performance.now();
      const result = landmarker.detectForVideo(video, timestamp);
      return {
        poses: (result.landmarks || []).map((landmarks) => landmarks.map((item, id) => ({
          id, x: item.x, y: item.y, z: item.z, visibility: item.visibility, presence: item.presence,
        }))),
        latencyMs: performance.now() - began,
        sourceWidth: video.videoWidth,
        sourceHeight: video.videoHeight,
      };
    },
    close() {
      if (!closed) landmarker.close();
      closed = true;
    },
  };
}
