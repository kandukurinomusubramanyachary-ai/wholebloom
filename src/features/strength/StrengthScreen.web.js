import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { COLORS, createThemedStyles, LAYOUT, SIZES, TYPOGRAPHY } from '../../utils/constants';
import {
  CONTROLLER_STATUS,
  DEFAULT_FRAME_INTERVAL_MS,
  StrengthController,
  VoiceCoach,
  createWebPoseRuntime,
} from './index.web.js';
import { createBloomStrengthOutbox, loadBloomStrengthSessions } from './bloomIntegration.js';

const EXERCISES = [
  { id: 'squat', name: 'Bodyweight Squat', icon: 'body-outline', view: 'Side view', setup: 'Place your phone so your full body is visible from the side.' },
  { id: 'wall-pushup', name: 'Wall Push-Up', icon: 'fitness-outline', view: 'Side view', setup: 'Place your phone to the side so shoulder, elbow, wrist, hip and ankle stay visible.' },
  { id: 'side-leg-raise', name: 'Standing Side-Leg Raise', icon: 'walk-outline', view: 'Front view', setup: 'Face the camera and keep both feet and your full body in frame.' },
];

const TARGET = 8;
const POSE_BASE = '/strength/mediapipe/0.10.21';

function runtimeImport(url) {
  // Keep MediaPipe as a same-origin runtime module instead of bundling/remote-loading it.
  // Function construction prevents Metro from rewriting the runtime URL at build time.
  const importer = new Function('u', 'return import(u)');
  return importer(url);
}

function createBloomPoseRuntime() {
  return createWebPoseRuntime({
    loadVisionTasks: () => runtimeImport(`${POSE_BASE}/vision_bundle.mjs`),
    resolveWasmUrl: () => `${POSE_BASE}/wasm/`,
    resolveModelUrl: () => `${POSE_BASE}/pose_landmarker_lite.task`,
  });
}

export default function StrengthScreen() {
  const { user } = useAuth();
  const [view, setView] = useState('home');
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [reps, setReps] = useState(0);
  const [cueText, setCueText] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [muted, setMuted] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [showCameraFree, setShowCameraFree] = useState(false);
  const [persistence, setPersistence] = useState('');
  const [summary, setSummary] = useState(null);
  const [inference, setInference] = useState(null);
  const [recentCount, setRecentCount] = useState(0);
  const videoRef = useRef(null);
  const controllerRef = useRef(null);
  const countdownTimersRef = useRef([]);
  const countdownRunningRef = useRef(false);
  const selectedRef = useRef(null);

  const selected = useMemo(
    () => EXERCISES.find((exercise) => exercise.id === selectedId) || null,
    [selectedId]
  );
  selectedRef.current = selected;

  const clearCountdown = useCallback(() => {
    countdownTimersRef.current.forEach((timer) => clearTimeout(timer));
    countdownTimersRef.current = [];
    countdownRunningRef.current = false;
    setCountdown(null);
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!user?.uid) return;
    const sessions = await loadBloomStrengthSessions(user.uid).catch(() => []);
    setRecentCount(sessions.length);
  }, [user?.uid]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const disposeController = useCallback(() => {
    clearCountdown();
    try { controllerRef.current?.dispose?.(); } catch { /* deterministic teardown is best effort in UI */ }
    controllerRef.current = null;
  }, [clearCountdown]);

  useFocusEffect(useCallback(() => () => {
    disposeController();
    setView('home');
    setSelectedId(null);
    setMode(null);
    setPhase('idle');
    setReps(0);
    setCueText('');
    setShowCameraFree(false);
    setManualPaused(false);
  }, [disposeController]));

  useEffect(() => () => disposeController(), [disposeController]);

  useEffect(() => {
    if (!user?.uid) disposeController();
  }, [disposeController, user?.uid]);

  const runCountdown = useCallback((controller) => {
    clearCountdown();
    countdownRunningRef.current = true;
    setPhase('countdown');
    [3, 2, 1].forEach((step, index) => {
      const timer = setTimeout(() => {
        if (controllerRef.current !== controller || controller.status !== CONTROLLER_STATUS.RUNNING) return;
        setCountdown(step);
        controller.speakCountdown(step);
      }, index * 800);
      countdownTimersRef.current.push(timer);
    });
    const finishTimer = setTimeout(() => {
      if (controllerRef.current !== controller) return;
      const result = controller.beginActive();
      if (result.ok) {
        setCountdown(null);
        setPhase('active');
        setCueText('Move when you are ready.');
      }
      countdownRunningRef.current = false;
    }, 2400);
    countdownTimersRef.current.push(finishTimer);
  }, [clearCountdown]);

  const handleFrame = useCallback((frame) => {
    if (!frame) return;
    if (typeof frame.acceptedReps === 'number') setReps(frame.acceptedReps);
    if (frame.phase) setPhase(frame.phase);
    if (frame.inference) setInference(frame.inference);

    const controller = controllerRef.current;
    if (
      controller
      && mode === 'camera'
      && frame.calibrationReady
      && !countdownRunningRef.current
      && controller.beginCountdownWhenReady()
    ) {
      runCountdown(controller);
    }

    if (frame.setComplete && controller?.session) {
      const nextSummary = controller.session.buildSummary();
      setSummary(nextSummary);
      setView('summary');
      clearCountdown();
    }
  }, [clearCountdown, mode, runCountdown]);

  const handleEvent = useCallback((event) => {
    if (!event) return;
    if (event.type === 'cue') {
      setCueText(event.text || event.cue?.id || 'Keep going.');
    }
    if (event.type === 'countdown') setCueText(event.text || String(event.step));
    if (event.type === 'paused') {
      setPhase('paused');
      setCueText('Paused. Your rep count is safe.');
    }
    if (event.type === 'resume-requested') setCueText('Return to your setup and hold steady.');
    if (event.type === 'resumed') {
      setPhase('active');
      setCueText('You are set. Continue when ready.');
    }
    if (event.type === 'background-paused') {
      clearCountdown();
      setPhase('background-paused');
      setCueText('Camera paused while Bloom was in the background.');
    }
    if (event.type === 'resume-attempted' && event.restart) {
      setPhase('calibration');
      setCueText('Rechecking your camera setup.');
    }
    if (event.type === 'recommend-camera-free') {
      setShowCameraFree(true);
      setCueText('Camera guidance is struggling on this device. Camera-free mode is ready.');
    }
    if (event.type === 'camera-error') {
      setShowCameraFree(true);
      setCueText(
        event.reason === 'denied'
          ? 'Camera permission was not granted. You can continue camera-free.'
          : 'Bloom could not start this camera. You can continue camera-free.'
      );
    }
    if (event.type === 'model-failed') {
      setShowCameraFree(true);
      setCueText('Private pose guidance could not load. You can continue camera-free.');
    }
    if (event.type === 'persistence') {
      setPersistence(
        event.status === 'synced'
          ? 'Saved to your Bloom account.'
          : event.status === 'sync-pending'
            ? 'Saved on this device. Bloom will sync it when your connection returns.'
            : event.status === 'save-error'
              ? 'Bloom could not save this set yet. Retry is available.'
              : 'Saved on this device.'
      );
    }
  }, [clearCountdown]);

  function makeController(exerciseId) {
    const voice = new VoiceCoach();
    voice.setMuted(muted);
    return new StrengthController({
      exerciseId,
      platform: 'web',
      now: () => Date.now(),
      poseRuntime: createBloomPoseRuntime(),
      outbox: createBloomStrengthOutbox(user.uid),
      voice,
      videoElement: videoRef.current,
      frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
      onFrame: handleFrame,
      onEvent: handleEvent,
      attachLifecycle: true,
    });
  }

  function chooseExercise(id) {
    disposeController();
    setSelectedId(id);
    setView('setup');
    setMode(null);
    setPhase('idle');
    setReps(0);
    setCueText('');
    setSummary(null);
    setPersistence('');
    setShowCameraFree(false);
    setManualPaused(false);
  }

  async function startCamera() {
    if (!selected || !user?.uid) return;
    disposeController();
    setMode('camera');
    setView('session');
    setPhase('preparing');
    setReps(0);
    setCueText('Preparing private camera guidance…');
    setSummary(null);
    setPersistence('');
    setShowCameraFree(false);
    setManualPaused(false);
    const controller = makeController(selected.id);
    controllerRef.current = controller;
    const result = await controller.startWithCamera();
    if (controllerRef.current !== controller) return;
    if (result.ok) {
      setPhase('calibration');
      setCueText('Step into frame and hold your setup steady.');
    } else {
      setShowCameraFree(true);
    }
  }

  function startCameraFree() {
    if (!selected || !user?.uid) return;
    let controller = controllerRef.current;
    if (!controller) {
      controller = makeController(selected.id);
      controllerRef.current = controller;
      controller.startCameraFree();
    } else if (
      controller.status === CONTROLLER_STATUS.RUNNING
      || controller.status === CONTROLLER_STATUS.PAUSED
      || controller.status === CONTROLLER_STATUS.BG_PAUSED
    ) {
      controller.switchToCameraFree();
    } else {
      controller.startCameraFree();
    }
    setMode('camera-free');
    setView('session');
    setPhase('active');
    setReps(0);
    setManualPaused(false);
    setShowCameraFree(false);
    setCueText('Tap +1 after each comfortable rep.');
  }

  function manualRep() {
    if (manualPaused) return;
    controllerRef.current?.manualRep();
  }

  function pauseOrResume() {
    const controller = controllerRef.current;
    if (!controller) return;
    if (mode === 'camera-free') {
      setManualPaused((value) => !value);
      setCueText(manualPaused ? 'Continue when you are ready.' : 'Paused. Your rep count is safe.');
      return;
    }
    if (controller.status === CONTROLLER_STATUS.RUNNING) controller.userPause();
    else if (controller.status === CONTROLLER_STATUS.PAUSED) controller.userResume();
  }

  async function resumeBackground() {
    const controller = controllerRef.current;
    if (!controller) return;
    setCueText('Restarting private camera guidance…');
    const result = await controller.resumeFromBackground();
    if (!result.ok) {
      setShowCameraFree(true);
      setCueText('Camera could not restart. Camera-free mode is ready.');
    }
  }

  async function stopSet() {
    const controller = controllerRef.current;
    if (!controller?.session) return;
    clearCountdown();
    const nextSummary = await controller.stop();
    setSummary(nextSummary);
    setView('summary');
    setPhase('ended');
  }

  async function retrySave() {
    const result = await controllerRef.current?.retryPendingSaves?.();
    if (result && result.errors?.length === 0) {
      setPersistence('Saved on this device. Bloom will sync when possible.');
      refreshHistory();
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    controllerRef.current?.setMuted(next);
  }

  function backHome() {
    disposeController();
    setView('home');
    setSelectedId(null);
    setMode(null);
    setPhase('idle');
    setReps(0);
    setCueText('');
    setSummary(null);
    setPersistence('');
    setShowCameraFree(false);
    setManualPaused(false);
    refreshHistory();
  }

  const cameraVisible = view === 'session' && mode === 'camera' && phase !== 'ended';
  const paused = mode === 'camera-free'
    ? manualPaused
    : controllerRef.current?.status === CONTROLLER_STATUS.PAUSED;
  const backgroundPaused = controllerRef.current?.status === CONTROLLER_STATUS.BG_PAUSED;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        {view === 'home' ? (
          <View style={styles.homeHeader}>
            <View>
              <Text style={styles.screenTitle}>Strength</Text>
              <Text style={styles.subtitle}>Private, guided movement in one small set.</Text>
            </View>
            <View style={styles.historyPill}>
              <Icon name='checkmark-circle-outline' size={15} color={COLORS.brand} />
              <Text style={styles.historyText}>{recentCount} saved</Text>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <Pressable onPress={backHome} accessibilityRole='button' accessibilityLabel='Back to Strength' hitSlop={8} style={styles.backButton}>
              <Icon name='chevron-back' size={22} color={COLORS.ink} />
            </Pressable>
            <Text style={styles.headerTitle}>{view === 'summary' ? 'Set summary' : selected?.name || 'Strength'}</Text>
            <Pressable onPress={toggleMute} accessibilityRole='button' accessibilityLabel={muted ? 'Turn voice cues on' : 'Mute voice cues'} hitSlop={8} style={styles.backButton}>
              <Icon name={muted ? 'volume-mute-outline' : 'volume-medium-outline'} size={20} color={COLORS.ink} />
            </Pressable>
          </View>
        )}

        <View style={[styles.cameraShell, !cameraVisible && styles.cameraShellHidden]} accessibilityLabel='Private camera preview'>
          {React.createElement('video', {
            ref: videoRef,
            muted: true,
            autoPlay: true,
            playsInline: true,
            style: webStyles.video,
          })}
          {cameraVisible ? (
            <View style={styles.cameraBadge} pointerEvents='none'>
              <View style={styles.liveDot} />
              <Text style={styles.cameraBadgeText}>On-device camera guidance</Text>
            </View>
          ) : null}
        </View>

        {view === 'home' ? (
          <>
            <View style={styles.privacyBand}>
              <Icon name='lock-closed-outline' size={19} color={COLORS.sage} />
              <Text style={styles.privacyText}>Video and pose landmarks stay in this browser session. Bloom saves only a small set summary.</Text>
            </View>
            <Text style={styles.sectionTitle}>Choose a movement</Text>
            <View style={styles.exerciseList}>
              {EXERCISES.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  onPress={() => chooseExercise(exercise.id)}
                  accessibilityRole='button'
                  accessibilityLabel={`${exercise.name}, ${TARGET} repetitions`}
                  style={({ pressed, hovered }) => [styles.exerciseCard, hovered && styles.exerciseCardHover, pressed && styles.pressed]}
                >
                  <View style={styles.exerciseIcon}><Icon name={exercise.icon} size={23} color={COLORS.brand} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>{TARGET} reps · {exercise.view}</Text>
                  </View>
                  <Icon name='chevron-forward' size={20} color={COLORS.muted} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {view === 'setup' && selected ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}><Icon name={selected.icon} size={28} color={COLORS.brand} /></View>
              <Text style={styles.heroTitle}>{TARGET} calm, deliberate reps</Text>
              <Text style={styles.body}>{selected.setup}</Text>
            </View>
            <View style={styles.infoCard}>
              <Icon name='shield-checkmark-outline' size={21} color={COLORS.sage} />
              <View style={styles.flex}>
                <Text style={styles.infoTitle}>Camera stays off until you choose it</Text>
                <Text style={styles.body}>Camera mode uses a local Pose Landmarker in your browser. No microphone, recording, frame upload, or raw landmark storage.</Text>
              </View>
            </View>
            <Text style={styles.safety}>Move in a comfortable range. Stop if something feels painful, dizzy, or unusual.</Text>
            <Button title='Start with camera' onPress={startCamera} />
            <Button title='Use camera-free instead' variant='secondary' onPress={startCameraFree} />
          </>
        ) : null}

        {view === 'session' && selected ? (
          <>
            <View style={[styles.sessionPanel, cameraVisible && styles.sessionPanelCamera]}>
              <View style={styles.repRow}>
                <View>
                  <Text style={styles.repNumber}>{reps}</Text>
                  <Text style={styles.repTarget}>of {TARGET} reps</Text>
                </View>
                <View style={styles.phasePill}>
                  <Text style={styles.phasePillText}>{countdown !== null ? String(countdown) : phaseLabel(phase, mode)}</Text>
                </View>
              </View>
              <Text accessibilityLiveRegion='polite' accessibilityRole='status' style={styles.cueText}>{cueText || defaultCue(phase, mode)}</Text>
              {inference && mode === 'camera' ? (
                <Text style={styles.inferenceText}>On-device guidance · {Number(inference.fps || 0).toFixed(1)} fps</Text>
              ) : null}
            </View>

            {backgroundPaused ? <Button title='Resume camera' onPress={resumeBackground} /> : null}

            {mode === 'camera-free' ? (
              <Pressable
                disabled={manualPaused}
                onPress={manualRep}
                accessibilityRole='button'
                accessibilityLabel='Add one completed repetition'
                accessibilityState={{ disabled: manualPaused }}
                style={({ pressed }) => [styles.repButton, manualPaused && styles.repButtonDisabled, pressed && !manualPaused && styles.repButtonPressed]}
              >
                <Icon name='add' size={32} color={COLORS.canvas} />
                <Text style={styles.repButtonText}>+1 rep</Text>
              </Pressable>
            ) : null}

            {!backgroundPaused && (phase === 'active' || paused || mode === 'camera-free') ? (
              <Button title={paused ? 'Resume' : 'Pause'} variant='secondary' onPress={pauseOrResume} />
            ) : null}

            {showCameraFree && mode !== 'camera-free' ? (
              <Button title='Continue camera-free' variant='secondary' onPress={startCameraFree} />
            ) : null}

            <Button title='Stop set' variant='danger' onPress={stopSet} />
          </>
        ) : null}

        {view === 'summary' && summary ? (
          <>
            <View style={styles.summaryCard}>
              <Icon name='checkmark-circle-outline' size={38} color={COLORS.sage} />
              <Text style={styles.summaryTitle}>{summary.display?.title || 'Set finished'}</Text>
              <Text style={styles.summaryMetric}>{summary.acceptedReps} / {summary.targetReps} reps</Text>
              {summary.display?.observation ? <Text style={styles.bodyCenter}>{summary.display.observation}</Text> : null}
              {summary.display?.nextFocus ? <Text style={styles.focusText}>{summary.display.nextFocus}</Text> : null}
            </View>
            {persistence ? <Text accessibilityRole='status' style={styles.saveStatus}>{persistence}</Text> : null}
            {controllerRef.current?.pendingSaves?.length ? <Button title='Retry save' variant='secondary' onPress={retrySave} /> : null}
            <Button title='Done' onPress={backHome} />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function phaseLabel(phase, mode) {
  if (mode === 'camera-free') return 'Camera-free';
  if (phase === 'preparing') return 'Preparing';
  if (phase === 'calibration') return 'Set up';
  if (phase === 'paused' || phase === 'background-paused') return 'Paused';
  if (phase === 'active') return 'Active';
  return 'Ready';
}

function defaultCue(phase, mode) {
  if (mode === 'camera-free') return 'Tap +1 after each comfortable rep.';
  if (phase === 'calibration') return 'Step into frame and hold your setup steady.';
  if (phase === 'active') return 'Move when you are ready.';
  if (phase === 'paused') return 'Paused. Resume when you are ready.';
  return 'Your camera stays private to this session.';
}

const webStyles = {
  video: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    backgroundColor: '#121113',
  },
};

const styles = createThemedStyles({
  safe: { flex: 1, minHeight: 0, backgroundColor: COLORS.canvas },
  content: { flex: 1, minHeight: 0, width: '100%', maxWidth: LAYOUT.phoneMaxWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingBottom: SIZES.xxl, gap: SIZES.lg, overflow: 'auto' },
  flex: { flex: 1 },
  homeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingTop: SIZES.sm },
  screenTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink },
  subtitle: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginTop: 3 },
  historyPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.brandSoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  historyText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SIZES.sm },
  headerTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, textAlign: 'center', flex: 1 },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.surfaceSoft },
  cameraShell: { position: 'relative', width: '100%', height: 300, overflow: 'hidden', borderRadius: LAYOUT.cardRadius, backgroundColor: '#121113' },
  cameraShellHidden: { height: 1, opacity: 0, marginVertical: -1, pointerEvents: 'none' },
  cameraBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(18,17,19,0.76)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9DB296' },
  cameraBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: '#F7F4F5' },
  privacyBand: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: COLORS.sageLight, borderRadius: LAYOUT.controlRadius },
  privacyText: { ...TYPOGRAPHY.supporting, flex: 1, color: COLORS.body },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, marginTop: SIZES.sm },
  exerciseList: { gap: 10 },
  exerciseCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.canvas },
  exerciseCardHover: { borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSoft },
  pressed: { opacity: 0.72 },
  exerciseIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  exerciseName: { ...TYPOGRAPHY.body, color: COLORS.ink, fontWeight: '700' },
  exerciseMeta: { ...TYPOGRAPHY.caption, color: COLORS.muted, marginTop: 3 },
  heroCard: { gap: 8, alignItems: 'flex-start', padding: 18, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.brandSoft },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: COLORS.canvas, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  body: { ...TYPOGRAPHY.body, color: COLORS.body },
  bodyCenter: { ...TYPOGRAPHY.body, color: COLORS.body, textAlign: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.canvas },
  infoTitle: { ...TYPOGRAPHY.body, color: COLORS.ink, fontWeight: '700', marginBottom: 4 },
  safety: { ...TYPOGRAPHY.supporting, color: COLORS.muted },
  sessionPanel: { gap: 14, padding: 18, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surfaceSoft },
  sessionPanelCamera: { marginTop: -4 },
  repRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  repNumber: { fontSize: 56, lineHeight: 60, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  repTarget: { ...TYPOGRAPHY.supporting, color: COLORS.muted },
  phasePill: { minWidth: 72, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.brandSoft },
  phasePillText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  cueText: { minHeight: 44, ...TYPOGRAPHY.body, color: COLORS.ink, fontWeight: '600' },
  inferenceText: { ...TYPOGRAPHY.caption, color: COLORS.muted },
  repButton: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.brand },
  repButtonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  repButtonDisabled: { opacity: 0.4 },
  repButtonText: { fontSize: 19, lineHeight: 24, fontWeight: '700', color: COLORS.canvas },
  summaryCard: { alignItems: 'center', gap: 10, padding: 24, marginTop: SIZES.lg, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.sageLight },
  summaryTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, textAlign: 'center' },
  summaryMetric: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: COLORS.ink },
  focusText: { ...TYPOGRAPHY.supporting, color: COLORS.brand, textAlign: 'center', fontWeight: '600' },
  saveStatus: { ...TYPOGRAPHY.supporting, color: COLORS.muted, textAlign: 'center' },
});
