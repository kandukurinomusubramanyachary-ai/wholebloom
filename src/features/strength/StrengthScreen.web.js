import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import { COLORS, createThemedStyles, LAYOUT } from '../../utils/constants';
import CameraStage from './components/CameraStage.web';
import FramingGuide from './components/FramingGuide';
import SessionControls from './components/SessionControls';
import StrengthSummary from './components/StrengthSummary';
import StrengthUnsupportedScreen from './StrengthUnsupportedScreen';
import { EXERCISE_COPY, STRENGTH_COPY, STRENGTH_DEFAULTS } from './constants';
import useStrengthSession from './useStrengthSession.web';
import { trackStrengthEvent } from './services/strengthAnalytics';

const IMMERSIVE_PHASES = new Set(['countdown', 'active', 'paused']);
const READY_NAMES = {
  'bodyweight-squat-v1': 'squats',
  'wall-pushup-v1': 'wall push-ups',
  'side-leg-raise-v1': 'side-leg raises',
};

function Header({ onBack, onInfo }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole='button' accessibilityLabel='Go back' style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons name='chevron-back' size={22} color={COLORS.ink} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.wordmarkText}>Strength</Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>
        {onInfo ? (
          <Pressable onPress={onInfo} accessibilityRole='button' accessibilityLabel='How camera guidance works' style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons name='information-circle-outline' size={22} color={COLORS.brand} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ExerciseList({ onSelect }) {
  return (
    <View style={styles.exerciseList} accessibilityRole='list'>
      {Object.entries(EXERCISE_COPY).map(([id, item]) => (
        <Pressable
          key={id}
          onPress={() => onSelect(id)}
          accessibilityRole='button'
          accessibilityLabel={`${item.name}, ${STRENGTH_DEFAULTS.targetReps} reps, ${item.view}`}
          style={({ pressed, focused }) => [styles.exercise, focused && styles.focused, pressed && styles.pressed]}
        >
          <View style={styles.exerciseIcon}><Ionicons name={item.icon} size={25} color={COLORS.brand} /></View>
          <View style={styles.flex}>
            <Text style={styles.exerciseName}>{item.name}</Text>
            <View style={styles.exerciseMetaRow}>
              <Text style={styles.exerciseMeta}>{STRENGTH_DEFAULTS.targetReps} reps</Text>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name='videocam-outline' size={13} color={COLORS.muted} />
              <Text style={styles.exerciseMeta}>{item.view}</Text>
            </View>
          </View>
          <Ionicons name='chevron-forward' size={18} color={COLORS.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function PhoneGuide() {
  return (
    <View style={styles.phoneGuide} accessibilityLabel='Prop your phone upright with your full body in frame'>
      <View style={styles.guideArt}>
        <View style={styles.phoneStand}><Ionicons name='phone-portrait-outline' size={46} color={COLORS.ink} /></View>
        <View style={styles.guideDistance} />
        <Ionicons name='body-outline' size={54} color={COLORS.muted} />
      </View>
      <Text style={styles.phoneGuideText}>Prop phone upright, full body in frame</Text>
    </View>
  );
}

function TrustRow() {
  return (
    <View style={styles.trustRow}>
      <View style={styles.trustItem}><Ionicons name='lock-closed-outline' size={14} color={COLORS.muted} /><Text style={styles.trustText}>Camera stays private</Text></View>
      <View style={styles.trustItem}><Ionicons name='heart-outline' size={14} color={COLORS.muted} /><Text style={styles.trustText}>Move comfortably</Text></View>
    </View>
  );
}

function DarkAction({ icon, label, onPress, secondary = false }) {
  return (
    <Pressable onPress={onPress} accessibilityRole='button' style={({ pressed, focused }) => [darkStyles.action, secondary && darkStyles.actionSecondary, focused && darkStyles.focused, pressed && darkStyles.pressed]}>
      {icon ? <Ionicons name={icon} size={19} color='#FFFFFF' /> : null}
      <Text style={darkStyles.actionText}>{label}</Text>
    </Pressable>
  );
}

function CameraFailureState({ failure, onClose, onRetry, onFallback }) {
  const denied = failure?.kind === 'denied';
  return (
    <SafeAreaView style={darkStyles.errorSafe} edges={['top']}>
      <Pressable onPress={onClose} accessibilityRole='button' accessibilityLabel='Close camera error' style={({ pressed }) => [darkStyles.close, pressed && darkStyles.pressed]}>
        <Ionicons name='close' size={22} color='#FFFFFF' />
      </Pressable>
      <View style={darkStyles.errorContent}>
        <View style={darkStyles.errorIcon}><Ionicons name='videocam-off-outline' size={42} color='#FF6682' /></View>
        <Text style={darkStyles.errorTitle}>{denied ? 'Camera access is off' : 'Camera couldn’t start'}</Text>
        <Text style={darkStyles.errorBody}>{failure?.message || STRENGTH_COPY.modelFailed}</Text>
        <View style={darkStyles.errorActions}>
          <DarkAction icon='refresh-outline' label='Try again' onPress={onRetry} />
          <DarkAction label='Use camera-free mode' onPress={onFallback} secondary />
        </View>
      </View>
    </SafeAreaView>
  );
}

function ImmersiveSession({ session, copy }) {
  const countingDown = session.phase === 'countdown';
  return (
    <SafeAreaView style={darkStyles.safe} edges={['top', 'bottom']}>
      <View style={darkStyles.frame}>
        <CameraStage active={session.cameraActive} inferenceActive={session.inferenceActive} showSkeleton={session.showSkeleton} showIndicator={false} style={darkStyles.camera} onFrame={session.onFrame} onReady={session.cameraReady} onError={session.cameraError} />
        <View style={darkStyles.overlay} pointerEvents='box-none'>
          <View style={darkStyles.topRow}>
            <View style={darkStyles.topLeft}>
              <View style={darkStyles.cameraChip}><View style={darkStyles.cameraDot} /><Text style={darkStyles.cameraChipText}>CAMERA ON</Text></View>
              {session.phase === 'paused' ? <View style={darkStyles.warningChip}><Ionicons name='warning-outline' size={15} color='#F2D0D5' /><Text style={darkStyles.warningText}>{session.pauseReason === 'manual' ? 'Session paused' : 'Return to full view'}</Text></View> : null}
            </View>
            <View style={darkStyles.repBlock}>
              <Text style={darkStyles.repCount}>{session.reps}<Text style={darkStyles.repTarget}> / {STRENGTH_DEFAULTS.targetReps}</Text></Text>
              <Text style={darkStyles.exerciseLabel}>{copy.name.toUpperCase()}</Text>
            </View>
          </View>
          <View style={darkStyles.coachCenter} accessibilityLiveRegion='assertive'>
            {countingDown ? <View style={darkStyles.countdownWrap}><Text style={darkStyles.countdownLabel}>Starting in</Text><Text style={darkStyles.countdown}>{Math.max(1, session.countdown)}</Text></View> : <View style={darkStyles.cue}><Text style={darkStyles.cueText}>{session.cueText || 'Move when you are ready.'}</Text></View>}
          </View>
          <View style={darkStyles.bottomArea}>
            {!countingDown ? (
              <Pressable accessibilityRole='switch' accessibilityState={{ checked: session.showSkeleton }} accessibilityLabel='Show pose guide' onPress={() => session.setShowSkeleton(!session.showSkeleton)} style={({ pressed }) => [darkStyles.poseToggle, pressed && darkStyles.pressed]}>
                <Ionicons name={session.showSkeleton ? 'scan' : 'scan-outline'} size={17} color='#FFFFFF' />
                <Text style={darkStyles.poseToggleText}>Pose guide {session.showSkeleton ? 'on' : 'off'}</Text>
              </Pressable>
            ) : null}
            {!countingDown ? <SessionControls paused={session.phase === 'paused'} muted={session.muted} onPause={session.togglePause} onMute={() => session.setMuted(!session.muted)} onStop={session.stop} /> : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function StrengthScreen({ navigation }) {
  const { user } = useAuth();
  const session = useStrengthSession({ uid: user?.uid, navigation });
  const copy = EXERCISE_COPY[session.exerciseId];
  const immersive = IMMERSIVE_PHASES.has(session.phase);

  useEffect(() => { trackStrengthEvent('strength_opened', { platform: 'web' }); }, []);
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: immersive ? { display: 'none' } : undefined });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [immersive, navigation]);

  const chooseExercise = (id) => {
    session.setExerciseId(id);
    trackStrengthEvent('strength_exercise_selected', { exerciseId: id, platform: 'web' });
    session.setPhase('safety');
  };

  if (immersive) return <ImmersiveSession session={session} copy={copy} />;
  if (session.phase === 'permission' && session.cameraFailure) return <CameraFailureState failure={session.cameraFailure} onClose={() => session.setPhase('select')} onRetry={session.beginCamera} onFallback={() => session.setPhase('fallback')} />;

  let content;
  if (session.phase === 'select') {
    content = <View><Header onInfo={() => session.setPhase('learn')} /><View style={styles.hero}><Text style={styles.title}>Move at home</Text><Text style={styles.heroLead}>Camera-guided bodyweight exercises, no equipment needed.</Text></View><ExerciseList onSelect={chooseExercise} /><Pressable onPress={() => session.setPhase('learn')} accessibilityRole='button' style={({ pressed }) => [styles.learnLink, pressed && styles.pressed]}><Text style={styles.learnLinkText}>How camera guidance works</Text></Pressable></View>;
  } else if (session.phase === 'learn') {
    content = <View><Header onBack={() => session.setPhase('select')} /><Text style={styles.title}>Private movement guidance</Text><Text style={styles.lead}>{STRENGTH_COPY.explanation}</Text><View style={styles.explainer}><View style={styles.explainerRow}><Ionicons name='scan-outline' size={22} color={COLORS.brand} /><View style={styles.flex}><Text style={styles.rowTitle}>Counts visible repetitions</Text><Text style={styles.rowBody}>The pose model checks joint positions on this device, one moment at a time.</Text></View></View><View style={styles.divider} /><View style={styles.explainerRow}><Ionicons name='trash-outline' size={22} color={COLORS.sage} /><View style={styles.flex}><Text style={styles.rowTitle}>Discards every camera frame</Text><Text style={styles.rowBody}>Only a small session summary can be saved to your Bloom account.</Text></View></View></View><Button title='Choose an exercise' onPress={() => session.setPhase('select')} style={styles.primaryButton} /></View>;
  } else if (session.phase === 'safety') {
    content = <View><Header onBack={() => session.setPhase('select')} /><View style={styles.safetyIcon}><Ionicons name='heart-outline' size={28} color={COLORS.brand} /></View><Text style={styles.title}>Before you begin</Text><Text style={styles.lead}>{STRENGTH_COPY.safety}</Text><View style={styles.steps}>{copy.steps.map((step) => <View key={step} style={styles.step}><Ionicons name='checkmark-circle-outline' size={20} color={COLORS.sage} /><Text style={styles.stepText}>{step}</Text></View>)}</View><Button title='I understand — continue' onPress={() => session.setPhase('permission')} style={styles.primaryButton} /><Button title='Use camera-free guidance' variant='secondary' onPress={() => session.setPhase('fallback')} style={styles.secondaryButton} /></View>;
  } else if (session.phase === 'permission') {
    content = <View><Header onBack={() => session.setPhase('safety')} /><View style={styles.readyHeader}><Text style={styles.title}>Ready for {READY_NAMES[session.exerciseId] || 'your set'}?</Text><View style={styles.readyMeta}><View style={styles.readyMetaItem}><Ionicons name='repeat-outline' size={17} color={COLORS.muted} /><Text style={styles.readyMetaText}>{STRENGTH_DEFAULTS.targetReps} reps</Text></View><View style={styles.readyDot} /><View style={styles.readyMetaItem}><Ionicons name='videocam-outline' size={17} color={COLORS.muted} /><Text style={styles.readyMetaText}>{copy.view}</Text></View></View></View><PhoneGuide /><Button title='Start with camera' icon='videocam-outline' onPress={session.beginCamera} style={[styles.primaryButton, styles.pillButton]} /><Button title='Use camera-free mode' variant='secondary' onPress={() => session.setPhase('fallback')} style={[styles.secondaryButton, styles.pillButton]} /><TrustRow /></View>;
  } else if (session.phase === 'fallback') {
    content = <View><Header onBack={() => session.setPhase('permission')} /><StrengthUnsupportedScreen embedded initialExerciseId={session.exerciseId} onBack={() => session.setPhase('select')} /></View>;
  } else if (session.phase === 'summary' && session.summaryResult) {
    content = <View><Header /><StrengthSummary summary={session.summaryResult.summary} observation={session.summaryResult.observation} focus={session.summaryResult.focus} synced={session.summaryResult.synced} onDone={() => navigation.navigate('Today')} onAgain={session.reset} /></View>;
  } else if (session.phase === 'save_error') {
    content = <View><Header /><View style={styles.stateCenter}><View style={styles.errorIcon}><Ionicons name='cloud-offline-outline' size={34} color={COLORS.error} /></View><Text style={styles.stateTitle}>Your set is still here</Text><Text style={styles.stateBody}>{session.summaryError}</Text><Button title='Try saving again' icon='refresh-outline' loading={session.savingSummary} onPress={session.retrySummary} style={styles.stateButton} /><Button title='Return to Strength' variant='secondary' disabled={session.savingSummary} onPress={session.discardPendingSummary} style={styles.secondaryButton} /></View></View>;
  } else if (session.phase === 'saving') {
    content = <View><Header /><View style={styles.stateCenter} accessibilityLiveRegion='polite'><ActivityIndicator color={COLORS.brand} size='large' /><Text style={styles.stateTitle}>Saving your set</Text><Text style={styles.stateBody}>Keeping the summary on this device first.</Text></View></View>;
  } else {
    const ready = session.phase === 'ready';
    const loading = session.phase === 'loading';
    content = <View><Header onBack={() => session.setPhase('permission')} /><View style={styles.cameraPreview}><CameraStage active={session.cameraActive} inferenceActive={session.inferenceActive} showSkeleton={session.showSkeleton} showIndicator onFrame={session.onFrame} onReady={session.cameraReady} onError={session.cameraError} /></View><View style={styles.preflightPanel}><Text style={styles.preflightEyebrow}>{copy.name}</Text><Text style={styles.preflightTitle}>{loading ? 'Preparing private guidance' : ready ? 'You’re ready' : 'Finding your starting position'}</Text><Text style={styles.preflightBody}>{ready ? copy.intro : 'Place your phone securely and keep your full body visible.'}</Text>{!loading ? <FramingGuide instruction={ready ? STRENGTH_COPY.fullBody : session.instruction} good={ready || session.calibrationGood} /> : <View style={styles.loadingRow}><ActivityIndicator color={COLORS.brand} /><Text style={styles.loadingText}>Starting the on-device pose model…</Text></View>}{ready ? <Button title='Start set' onPress={session.startCountdown} style={[styles.primaryButton, styles.pillButton]} /> : null}<Button title='Use camera-free mode' variant='ghost' onPress={() => session.setPhase('fallback')} style={styles.secondaryButton} /></View></View>;
  }

  return <SafeAreaView style={styles.safeArea} edges={['top']}><ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator>{content}</ScrollView></SafeAreaView>;
}

const styles = createThemedStyles({
  safeArea: { flex: 1, minHeight: 0, backgroundColor: COLORS.canvas },
  scroll: { flex: 1, minHeight: 0 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingBottom: 38 },
  flex: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft },
  headerSide: { width: 44, alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  wordmarkText: { color: COLORS.brand, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 22 },
  title: { color: COLORS.ink, fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4 },
  heroLead: { maxWidth: 360, marginTop: 8, color: COLORS.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  lead: { marginTop: 10, color: COLORS.body, fontSize: 15, lineHeight: 22 },
  exerciseList: { gap: 10 },
  exercise: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, backgroundColor: COLORS.white },
  exerciseIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: COLORS.surfaceStrong },
  exerciseName: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  exerciseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  exerciseMeta: { color: COLORS.muted, fontSize: 12, lineHeight: 16 },
  metaDot: { color: COLORS.hairline, fontSize: 13 },
  learnLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  learnLinkText: { color: COLORS.body, fontSize: 13, lineHeight: 18, textDecorationLine: 'underline' },
  primaryButton: { width: '100%', marginTop: 24 },
  secondaryButton: { width: '100%', marginTop: 9 },
  pillButton: { borderRadius: 999 },
  explainer: { marginTop: 24, padding: 17, borderRadius: 16, backgroundColor: COLORS.surfaceSoft },
  explainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  divider: { height: 1, marginVertical: 16, backgroundColor: COLORS.hairline },
  rowTitle: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  rowBody: { marginTop: 3, color: COLORS.body, fontSize: 13, lineHeight: 19 },
  safetyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 18, borderRadius: 29, backgroundColor: COLORS.brandSoft },
  steps: { gap: 12, marginTop: 22, paddingVertical: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepText: { flex: 1, color: COLORS.body, fontSize: 14, lineHeight: 20 },
  readyHeader: { alignItems: 'center', paddingTop: 24 },
  readyMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  readyMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readyMetaText: { color: COLORS.body, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  readyDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.hairline },
  phoneGuide: { alignItems: 'center', justifyContent: 'center', marginTop: 22, minHeight: 194, padding: 20, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 20, backgroundColor: COLORS.white },
  guideArt: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 15 },
  phoneStand: { transform: [{ rotate: '-8deg' }] },
  guideDistance: { width: 46, height: 1, marginBottom: 8, backgroundColor: COLORS.hairline },
  phoneGuideText: { marginTop: 18, color: COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 18 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { color: COLORS.muted, fontSize: 11, lineHeight: 15 },
  cameraPreview: { width: '100%', maxWidth: 420, aspectRatio: 3 / 4, maxHeight: 500, alignSelf: 'center', marginTop: 18, overflow: 'hidden', borderRadius: 22, backgroundColor: '#121113' },
  preflightPanel: { marginTop: 18, padding: 18, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 18, backgroundColor: COLORS.white },
  preflightEyebrow: { color: COLORS.brand, fontSize: 12, lineHeight: 16, fontWeight: '700', textTransform: 'uppercase' },
  preflightTitle: { marginTop: 5, color: COLORS.ink, fontSize: 23, lineHeight: 29, fontWeight: '700' },
  preflightBody: { marginTop: 7, marginBottom: 15, color: COLORS.body, fontSize: 14, lineHeight: 20 },
  loadingRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.surfaceSoft },
  loadingText: { flex: 1, color: COLORS.body, fontSize: 13, lineHeight: 18 },
  stateCenter: { minHeight: 460, alignItems: 'center', justifyContent: 'center', paddingVertical: 38 },
  stateTitle: { marginTop: 18, color: COLORS.ink, fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  stateBody: { maxWidth: 420, marginTop: 8, color: COLORS.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  stateButton: { width: '100%', marginTop: 26 },
  errorIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 36, backgroundColor: COLORS.surfaceWarm },
  focused: { borderColor: COLORS.brand },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});

const darkStyles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#050505' },
  frame: { position: 'relative', width: '100%', maxWidth: 520, flex: 1, overflow: 'hidden', borderRadius: 28, backgroundColor: '#121113' },
  camera: { width: '100%', height: '100%', borderRadius: 28 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 18, backgroundColor: 'rgba(0,0,0,0.12)' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  topLeft: { flex: 1, alignItems: 'flex-start', gap: 9 },
  cameraChip: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.58)' },
  cameraDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#7BD9A8' },
  cameraChipText: { color: 'rgba(255,255,255,0.88)', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  warningChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 18, backgroundColor: 'rgba(18,17,19,0.82)' },
  warningText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  repBlock: { alignItems: 'flex-end' },
  repCount: { color: '#FFFFFF', fontSize: 42, lineHeight: 45, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1.4 },
  repTarget: { color: 'rgba(255,255,255,0.62)', fontSize: 19, fontWeight: '700' },
  exerciseLabel: { marginTop: 2, color: 'rgba(255,255,255,0.78)', fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 1.2 },
  coachCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cue: { maxWidth: 300, minHeight: 54, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 27, backgroundColor: '#D63D62' },
  cueText: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  countdownWrap: { alignItems: 'center', padding: 24, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.58)' },
  countdownLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  countdown: { marginTop: 5, color: '#FFFFFF', fontSize: 76, lineHeight: 80, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bottomArea: { alignItems: 'center', gap: 10 },
  poseToggle: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.56)' },
  poseToggleText: { color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  errorSafe: { flex: 1, minHeight: 0, backgroundColor: '#121113' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginLeft: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.13)' },
  errorContent: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 52 },
  errorIcon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 44, backgroundColor: 'rgba(255,102,130,0.10)' },
  errorTitle: { marginTop: 24, color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  errorBody: { maxWidth: 390, marginTop: 9, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errorActions: { width: '100%', gap: 10, marginTop: 34 },
  action: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: '#D63D62' },
  actionSecondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'transparent' },
  actionText: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  focused: { borderWidth: 2, borderColor: '#FFFFFF' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
