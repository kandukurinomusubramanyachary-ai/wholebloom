import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { STRENGTH_COPY, STRENGTH_DEFAULTS } from './constants';
import { exerciseById } from './exercises';
import { midpoint, point } from './engine/jointAngles';
import { createCueScheduler } from './engine/cueScheduler';
import { createPositioningCoach } from './engine/positioningCoach';
import { createRepStateMachine } from './engine/repStateMachine';
import { buildStrengthFocus, buildStrengthObservation } from './engine/strengthSummary';
import { createVoiceCoach } from './services/voiceCoach';
import { flushStrengthOutbox, saveStrengthSummary } from './services/strengthStorage';
import { trackStrengthEvent } from './services/strengthAnalytics';

function sessionId() {
  return `strength-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function baselineFrom(landmarks) {
  const leftVisibility = [11, 23, 25, 27].reduce((sum, id) => sum + Number(point(landmarks, id)?.visibility || 0), 0);
  const rightVisibility = [12, 24, 26, 28].reduce((sum, id) => sum + Number(point(landmarks, id)?.visibility || 0), 0);
  return {
    activeSide: rightVisibility > leftVisibility ? 'right' : 'left',
    shoulderMid: midpoint(point(landmarks, 11), point(landmarks, 12)),
    hipMid: midpoint(point(landmarks, 23), point(landmarks, 24)),
    hipDeviation: 0,
  };
}

export default function useStrengthSession({ uid, navigation }) {
  const [phase, setPhase] = useState('learn');
  const [exerciseId, setExerciseId] = useState('bodyweight-squat-v1');
  const [instruction, setInstruction] = useState('Looking for you…');
  const [calibrationGood, setCalibrationGood] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [reps, setReps] = useState(0);
  const [pauseReason, setPauseReason] = useState(null);
  const [muted, setMuted] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [cueText, setCueText] = useState('');
  const [summaryResult, setSummaryResult] = useState(null);
  const runtime = useRef({ engine: null, scheduler: null, positioning: null, calibrationCompleted: false, baseline: null, startedAt: null, pausedAt: null, pauseCount: 0, repDurations: [], cueCounts: {}, ended: false });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const voice = useRef(createVoiceCoach({ rate: STRENGTH_DEFAULTS.speechRate, pitch: STRENGTH_DEFAULTS.speechPitch }));
  const exercise = useMemo(() => exerciseById(exerciseId), [exerciseId]);

  useEffect(() => { voice.current.setMuted(muted); }, [muted]);
  useEffect(() => {
    void flushStrengthOutbox(uid);
    const timers = STRENGTH_DEFAULTS.outboxRetryMs.map((delay) => setTimeout(() => {
      void flushStrengthOutbox(uid);
    }, delay));
    return () => timers.forEach(clearTimeout);
  }, [uid]);

  const resetRuntime = useCallback(() => {
    runtime.current = { engine: null, scheduler: null, positioning: null, calibrationCompleted: false, baseline: null, startedAt: null, pausedAt: null, pauseCount: 0, repDurations: [], cueCounts: {}, ended: false };
    voice.current.cancel(); setReps(0); setCueText(''); setPauseReason(null); setCalibrationGood(false); setInstruction('Looking for you…');
  }, []);

  const finish = useCallback(async (completionState = 'stopped', acceptedReps = reps) => {
    const current = runtime.current;
    if (current.ended || !current.startedAt) { setPhase('select'); return; }
    current.ended = true;
    voice.current.cancel();
    const completedAt = new Date();
    const safeSummary = {
      id: sessionId(), exerciseId: exercise.id, exerciseVersion: exercise.exerciseVersion,
      startedAt: current.startedAt.toISOString(), completedAt: completedAt.toISOString(),
      durationSeconds: Math.max(1, Math.round((completedAt - current.startedAt) / 1000)),
      targetReps: STRENGTH_DEFAULTS.targetReps, acceptedReps,
      pauseCount: current.pauseCount, cueCounts: current.scheduler?.snapshot() || {},
      completionState, platform: Platform.OS, privacyVersion: 1,
    };
    const saved = await saveStrengthSummary(uid, safeSummary);
    setSummaryResult({
      ...saved,
      observation: buildStrengthObservation(saved.summary, current.repDurations),
      focus: buildStrengthFocus(saved.summary.cueCounts || {}),
    });
    setPhase('summary');
    trackStrengthEvent(completionState === 'completed' ? 'strength_session_completed' : 'strength_session_stopped', { exerciseId: exercise.id, completionState, acceptedReps, targetReps: STRENGTH_DEFAULTS.targetReps, platform: Platform.OS });
  }, [exercise, reps, uid]);

  const onFrame = useCallback((frame) => {
    const current = runtime.current;
    if (phase === 'calibrating') {
      if (!current.positioning) {
        current.positioning = createPositioningCoach({
          cameraView: exercise.camera,
          mirrored: true,
          readyHoldMs: STRENGTH_DEFAULTS.baselineHoldMs,
        });
      }
      const positioning = current.positioning.process(frame);
      if (positioning.shouldPublish) {
        setInstruction(positioning.instruction);
        setCalibrationGood(Boolean(positioning.ok));
      }
      if (positioning.ready && !current.calibrationCompleted) {
        current.calibrationCompleted = true;
        current.baseline = baselineFrom(frame.landmarks);
        current.engine = createRepStateMachine(exercise, current.baseline);
        current.scheduler = createCueScheduler();
        setInstruction(STRENGTH_COPY.fullBody); setPhase('ready');
        trackStrengthEvent('strength_calibration_result', { exerciseId: exercise.id, result: 'ready', platform: Platform.OS });
      }
      return;
    }
    const trackingPause = phase === 'paused' && !['manual', 'page_hidden'].includes(pauseReason);
    if ((phase !== 'active' && !trackingPause) || !current.engine) return;
    const output = current.engine.process(frame);
    const candidates = [];
    output.events.forEach((event) => {
      if (event.type === 'pauseRequested') {
        current.pauseCount += 1; setPauseReason(event.reason); setPhase('paused');
        setCueText(event.reason === 'multi_person' ? STRENGTH_COPY.onePerson : 'I lost a clear view. Return to your starting position when ready.');
      }
      if (event.type === 'stateChanged' && event.from === 'paused') {
        setPauseReason(null); setCueText('Clear view restored. Continue when you are ready.'); setPhase('active');
      }
      if (event.type === 'repAccepted') {
        current.repDurations.push(event.durationMs); setReps(event.count); voice.current.speak(String(event.count));
        if (event.count >= STRENGTH_DEFAULTS.targetReps) void finish('completed', event.count);
      }
      if (event.type === 'cueCondition') candidates.push(event.cue);
    });
    const scheduled = current.scheduler.schedule(candidates, frame.ts);
    if (scheduled) {
      setCueText(scheduled.cue.text); voice.current.speak(scheduled.cue.text, scheduled.cancel);
    }
  }, [exercise, finish, pauseReason, phase]);

  const beginCamera = useCallback(() => { resetRuntime(); setPhase('loading'); trackStrengthEvent('strength_camera_requested', { exerciseId: exercise.id, platform: Platform.OS }); }, [exercise.id, resetRuntime]);
  const cameraReady = useCallback(() => { setPhase('calibrating'); trackStrengthEvent('strength_camera_result', { exerciseId: exercise.id, result: 'granted', platform: Platform.OS }); }, [exercise.id]);
  const cameraError = useCallback((error) => { setInstruction(error?.name === 'NotAllowedError' ? STRENGTH_COPY.permissionDenied : STRENGTH_COPY.modelFailed); setPhase('permission'); trackStrengthEvent('strength_camera_result', { exerciseId: exercise.id, result: error?.name === 'NotAllowedError' ? 'denied' : 'failed', platform: Platform.OS }); }, [exercise.id]);
  const startCountdown = useCallback(() => { setCountdown(3); setPhase('countdown'); voice.current.speak(STRENGTH_COPY.readyThree); }, []);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    if (countdown <= 0) {
      runtime.current.startedAt = new Date(); runtime.current.ended = false; setPhase('active'); setCueText('Move when you are ready.');
      trackStrengthEvent('strength_session_started', { exerciseId: exercise.id, exerciseVersion: exercise.exerciseVersion, platform: Platform.OS });
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, exercise, phase]);

  const togglePause = useCallback(() => {
    if (phase === 'paused') { setPauseReason(null); setCueText('Return to your starting position, then continue.'); setPhase('active'); }
    else { runtime.current.pauseCount += 1; setPauseReason('manual'); setCueText(STRENGTH_COPY.manualPause); setPhase('paused'); voice.current.cancel(); trackStrengthEvent('strength_session_paused', { exerciseId: exercise.id, reason: 'manual', platform: Platform.OS }); }
  }, [exercise.id, phase]);

  useFocusEffect(useCallback(() => () => {
    if (['loading', 'calibrating', 'ready', 'countdown', 'active', 'paused'].includes(phaseRef.current)) {
      voice.current.cancel(); resetRuntime(); setPhase('select');
    }
  }, [resetRuntime]));

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phase === 'active') {
        runtime.current.pauseCount += 1; setPauseReason('page_hidden'); setCueText(STRENGTH_COPY.pageHidden); setPhase('paused'); voice.current.cancel();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  return {
    phase, setPhase, exercise, exerciseId, setExerciseId, instruction, calibrationGood,
    countdown, reps, pauseReason, muted, setMuted, showSkeleton, setShowSkeleton, cueText,
    summaryResult, beginCamera, cameraReady, cameraError, onFrame, startCountdown, togglePause,
    stop: () => void finish('stopped'), reset: () => { resetRuntime(); setSummaryResult(null); setPhase('select'); },
    cameraActive: ['loading', 'calibrating', 'ready', 'countdown', 'active', 'paused'].includes(phase),
    inferenceActive: ['calibrating', 'ready', 'countdown', 'active'].includes(phase) || (phase === 'paused' && pauseReason !== 'manual' && pauseReason !== 'page_hidden'),
    voiceAvailable: voice.current.available,
  };
}
