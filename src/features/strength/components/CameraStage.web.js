import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createThemedStyles } from '../../../utils/constants';
import { STRENGTH_COPY, STRENGTH_DEFAULTS } from '../constants';
import { createLandmarkSmoother, estimateBodyHeight } from '../engine/landmarkSmoothing';
import { createPoseDetector } from '../services/PoseDetector.web';
import PoseOverlay from './PoseOverlay.web';

export default function CameraStage({ active, inferenceActive, showSkeleton = true, onFrame, onReady, onError }) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const callbackRef = useRef({ onFrame, onReady, onError });
  const settingsRef = useRef({ inferenceActive, showSkeleton });
  const [loading, setLoading] = useState(false);
  callbackRef.current = { onFrame, onReady, onError };
  settingsRef.current = { inferenceActive, showSkeleton };

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let animationFrame = null;
    let lastSampleAt = -Infinity;
    const smoother = createLandmarkSmoother();
    setLoading(true);

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } } });
        streamRef.current = stream;
        const detector = await createPoseDetector();
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); detector.close(); return; }
        detectorRef.current = detector;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setLoading(false);
        callbackRef.current.onReady?.();

        const sample = (now) => {
          if (cancelled) return;
          animationFrame = window.requestAnimationFrame(sample);
          const interval = 1000 / STRENGTH_DEFAULTS.sampleRate;
          if (now - lastSampleAt < interval) return;
          lastSampleAt = now;
          if (settingsRef.current.inferenceActive && video.readyState >= 2 && video.videoWidth > 0) {
            try {
              const result = detector.detect(video, now);
              const raw = result.poses[0] || [];
              const landmarks = smoother.smooth(raw, now, estimateBodyHeight(raw));
              if (settingsRef.current.showSkeleton) {
                overlayRef.current?.draw({
                  landmarks,
                  sourceWidth: result.sourceWidth,
                  sourceHeight: result.sourceHeight,
                  mirrored: true,
                });
              } else overlayRef.current?.clear();
              callbackRef.current.onFrame?.({
                ts: now,
                poseCount: result.poses.length,
                poses: result.poses,
                landmarks,
                latencyMs: result.latencyMs,
                sourceWidth: result.sourceWidth,
                sourceHeight: result.sourceHeight,
              });
            } catch (error) {
              callbackRef.current.onError?.(error);
            }
          } else overlayRef.current?.clear();
        };
        animationFrame = window.requestAnimationFrame(sample);
      } catch (error) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setLoading(false);
        callbackRef.current.onError?.(error);
      }
    }
    start();
    return () => {
      cancelled = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      detectorRef.current?.close(); detectorRef.current = null;
      smoother.reset();
      streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active]);

  useEffect(() => {
    if (!showSkeleton) overlayRef.current?.clear();
  }, [showSkeleton]);

  return (
    <View style={styles.stage} accessibilityLabel='Private camera preview'>
      <video ref={videoRef} muted playsInline style={webStyles.video} />
      <PoseOverlay ref={overlayRef} />
      {loading ? <View style={styles.loading}><ActivityIndicator color='#F7F4F5' /><Text style={styles.loadingText}>Preparing private camera guidance…</Text></View> : null}
      <View style={styles.indicator}><View style={styles.dot} /><Text style={styles.indicatorText}>{STRENGTH_COPY.activeCamera}</Text></View>
    </View>
  );
}

const webStyles = {
  video: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
};

const styles = createThemedStyles({
  stage: { position: 'relative', width: '100%', aspectRatio: 3 / 4, maxHeight: 620, overflow: 'hidden', borderRadius: 16, backgroundColor: '#121113' },
  loading: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(18,17,19,0.82)' },
  loadingText: { color: '#F7F4F5', fontSize: 14, lineHeight: 20 },
  indicator: { position: 'absolute', top: 12, left: 12, right: 12, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderRadius: 12, backgroundColor: 'rgba(18,17,19,0.78)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9DB296' },
  indicatorText: { flex: 1, color: '#F7F4F5', fontSize: 11, lineHeight: 15, fontWeight: '600' },
});
