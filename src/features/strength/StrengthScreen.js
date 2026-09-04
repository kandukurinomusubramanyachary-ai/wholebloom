import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { COLORS, createThemedStyles, LAYOUT, SIZES, TYPOGRAPHY } from '../../utils/constants';
import { StrengthSession, createIdFactory } from './index.native.js';
import { createBloomStrengthOutbox, loadBloomStrengthSessions } from './bloomIntegration.js';

const EXERCISES = [
  { id: 'squat', name: 'Bodyweight Squat', icon: 'body-outline', setup: 'Stand where you have room to sit back and stand tall.' },
  { id: 'wall-pushup', name: 'Wall Push-Up', icon: 'fitness-outline', setup: 'Use a clear wall and place your hands around shoulder height.' },
  { id: 'side-leg-raise', name: 'Standing Side-Leg Raise', icon: 'walk-outline', setup: 'Stand near a stable support if you want one nearby.' },
];

const TARGET = 8;

export default function StrengthScreen() {
  const { user } = useAuth();
  const [view, setView] = useState('home');
  const [selectedId, setSelectedId] = useState(null);
  const [reps, setReps] = useState(0);
  const [paused, setPaused] = useState(false);
  const [summary, setSummary] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [recentCount, setRecentCount] = useState(0);
  const sessionRef = useRef(null);
  const outboxRef = useRef(null);
  const idFactoryRef = useRef(createIdFactory('random'));

  const selected = useMemo(
    () => EXERCISES.find((exercise) => exercise.id === selectedId) || null,
    [selectedId]
  );

  const refreshHistory = useCallback(async () => {
    if (!user?.uid) return;
    const sessions = await loadBloomStrengthSessions(user.uid).catch(() => []);
    setRecentCount(sessions.length);
  }, [user?.uid]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  useEffect(() => () => {
    const session = sessionRef.current;
    if (session && session.phase !== 'ended') session.abandon();
    sessionRef.current = null;
  }, []);

  async function persistSummary(nextSummary) {
    if (!user?.uid) {
      setSaveStatus('Sign in again before saving this set.');
      return;
    }
    try {
      const outbox = outboxRef.current || createBloomStrengthOutbox(user.uid);
      outboxRef.current = outbox;
      const result = await outbox.saveSession(nextSummary);
      setSaveStatus(
        result.status === 'synced'
          ? 'Saved to your Bloom account.'
          : result.status === 'sync-pending'
            ? 'Saved on this device. Bloom will sync it when your connection returns.'
            : 'Saved on this device.'
      );
      refreshHistory();
    } catch {
      setSaveStatus('This set is still on screen, but Bloom could not save it yet.');
    }
  }

  function chooseExercise(id) {
    setSelectedId(id);
    setView('setup');
    setSummary(null);
    setSaveStatus('');
  }

  function startCameraFree() {
    if (!selected || !user?.uid) return;
    const session = new StrengthSession({
      exerciseId: selected.id,
      mode: 'camera-free',
      platform: 'native',
      now: () => Date.now(),
      createId: idFactoryRef.current,
    });
    sessionRef.current = session;
    outboxRef.current = createBloomStrengthOutbox(user.uid);
    setReps(0);
    setPaused(false);
    setSummary(null);
    setSaveStatus('');
    setView('session');
  }

  function addRep() {
    if (paused || !sessionRef.current) return;
    const result = sessionRef.current.manualRep();
    setReps(result.acceptedReps);
    if (result.setComplete) {
      const nextSummary = sessionRef.current.buildSummary();
      setSummary(nextSummary);
      setView('summary');
      void persistSummary(nextSummary);
    }
  }

  async function stopSet() {
    if (!sessionRef.current) return;
    const nextSummary = sessionRef.current.stop();
    setSummary(nextSummary);
    setView('summary');
    await persistSummary(nextSummary);
  }

  function backHome() {
    const session = sessionRef.current;
    if (session && session.phase !== 'ended') session.abandon();
    sessionRef.current = null;
    setSelectedId(null);
    setPaused(false);
    setReps(0);
    setView('home');
    refreshHistory();
  }

  if (view === 'setup' && selected) {
    return (
      <ScreenFrame>
        <Header title={selected.name} onBack={backHome} />
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}><Icon name={selected.icon} size={28} color={COLORS.brand} /></View>
          <Text style={styles.heroTitle}>8 calm, deliberate reps</Text>
          <Text style={styles.body}>{selected.setup}</Text>
        </View>
        <View style={styles.infoCard}>
          <Icon name='shield-checkmark-outline' size={21} color={COLORS.sage} />
          <View style={styles.flex}>
            <Text style={styles.infoTitle}>Camera-free on this device</Text>
            <Text style={styles.body}>Tap +1 after each rep. Bloom stores only a small set summary — no photos, video, audio, or body measurements.</Text>
          </View>
        </View>
        <Text style={styles.safety}>Move in a comfortable range. Stop if something feels painful, dizzy, or unusual.</Text>
        <Button title='Start camera-free' onPress={startCameraFree} />
      </ScreenFrame>
    );
  }

  if (view === 'session' && selected) {
    return (
      <ScreenFrame>
        <Header title={selected.name} />
        <View style={styles.repPanel}>
          <Text style={styles.repNumber}>{reps}</Text>
          <Text style={styles.repTarget}>of {TARGET} reps</Text>
          <Text style={styles.phaseText}>{paused ? 'Paused' : 'Move when you are ready'}</Text>
        </View>
        <Button
          title={paused ? 'Resume' : 'Pause'}
          variant='secondary'
          onPress={() => setPaused((value) => !value)}
        />
        <Pressable
          disabled={paused}
          onPress={addRep}
          accessibilityRole='button'
          accessibilityLabel='Add one completed repetition'
          accessibilityState={{ disabled: paused }}
          style={({ pressed }) => [styles.repButton, paused && styles.repButtonDisabled, pressed && !paused && styles.repButtonPressed]}
        >
          <Icon name='add' size={34} color={COLORS.canvas} />
          <Text style={styles.repButtonText}>+1 rep</Text>
        </Pressable>
        <Button title='Stop set' variant='danger' onPress={stopSet} />
      </ScreenFrame>
    );
  }

  if (view === 'summary' && summary && selected) {
    return (
      <ScreenFrame>
        <Header title='Set complete' />
        <View style={styles.summaryCard}>
          <Icon name='checkmark-circle-outline' size={38} color={COLORS.sage} />
          <Text style={styles.summaryTitle}>{summary.display?.title || 'Set finished'}</Text>
          <Text style={styles.summaryMetric}>{summary.acceptedReps} / {summary.targetReps} reps</Text>
          {summary.display?.observation ? <Text style={styles.body}>{summary.display.observation}</Text> : null}
          {summary.display?.nextFocus ? <Text style={styles.focusText}>{summary.display.nextFocus}</Text> : null}
        </View>
        {saveStatus ? <Text accessibilityRole='status' style={styles.saveStatus}>{saveStatus}</Text> : null}
        <Button title='Done' onPress={backHome} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.screenTitle}>Strength</Text>
          <Text style={styles.subtitle}>Simple movement, one set at a time.</Text>
        </View>
        <View style={styles.historyPill}>
          <Icon name='checkmark-circle-outline' size={15} color={COLORS.brand} />
          <Text style={styles.historyText}>{recentCount} saved</Text>
        </View>
      </View>

      <View style={styles.privacyBand}>
        <Icon name='lock-closed-outline' size={19} color={COLORS.sage} />
        <Text style={styles.privacyText}>Private by design. Strength never records or uploads camera media.</Text>
      </View>

      <Text style={styles.sectionTitle}>Choose a movement</Text>
      <View style={styles.exerciseList}>
        {EXERCISES.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => chooseExercise(exercise.id)}
            accessibilityRole='button'
            accessibilityLabel={`${exercise.name}, ${TARGET} repetitions`}
            style={({ pressed, hovered }) => [
              styles.exerciseCard,
              hovered && styles.exerciseCardHover,
              pressed && styles.exerciseCardPressed,
            ]}
          >
            <View style={styles.exerciseIcon}><Icon name={exercise.icon} size={23} color={COLORS.brand} /></View>
            <View style={styles.flex}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseMeta}>{TARGET} reps · camera-free</Text>
            </View>
            <Icon name='chevron-forward' size={20} color={COLORS.muted} />
          </Pressable>
        ))}
      </View>
    </ScreenFrame>
  );
}

function ScreenFrame({ children }) {
  return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.content}>{children}</View></SafeAreaView>;
}

function Header({ title, onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole='button' accessibilityLabel='Back' hitSlop={8} style={styles.backButton}>
          <Icon name='chevron-back' size={22} color={COLORS.ink} />
        </Pressable>
      ) : <View style={styles.backSpacer} />}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.backSpacer} />
    </View>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  content: { flex: 1, width: '100%', maxWidth: LAYOUT.phoneMaxWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingBottom: SIZES.xxl, gap: SIZES.lg },
  flex: { flex: 1 },
  homeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingTop: SIZES.sm },
  screenTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink },
  subtitle: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginTop: 3 },
  historyPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.brandSoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  historyText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  privacyBand: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: COLORS.sageLight, borderRadius: LAYOUT.controlRadius },
  privacyText: { ...TYPOGRAPHY.supporting, flex: 1, color: COLORS.body },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, marginTop: SIZES.sm },
  exerciseList: { gap: 10 },
  exerciseCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surface },
  exerciseCardHover: { borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSoft },
  exerciseCardPressed: { opacity: 0.72 },
  exerciseIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  exerciseName: { ...TYPOGRAPHY.body, color: COLORS.ink, fontWeight: '700' },
  exerciseMeta: { ...TYPOGRAPHY.caption, color: COLORS.muted, marginTop: 3 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SIZES.sm },
  headerTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, textAlign: 'center', flex: 1 },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.surfaceSoft },
  backSpacer: { width: 42 },
  heroCard: { gap: 8, alignItems: 'flex-start', padding: 18, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.brandSoft },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: COLORS.canvas, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  body: { ...TYPOGRAPHY.body, color: COLORS.body },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surface },
  infoTitle: { ...TYPOGRAPHY.body, color: COLORS.ink, fontWeight: '700', marginBottom: 4 },
  safety: { ...TYPOGRAPHY.supporting, color: COLORS.muted },
  repPanel: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 22, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surfaceSoft },
  repNumber: { fontSize: 82, lineHeight: 88, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  repTarget: { ...TYPOGRAPHY.sectionTitle, color: COLORS.body },
  phaseText: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginTop: 10 },
  repButton: { minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.brand },
  repButtonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  repButtonDisabled: { opacity: 0.4 },
  repButtonText: { fontSize: 19, lineHeight: 24, fontWeight: '700', color: COLORS.canvas },
  summaryCard: { alignItems: 'center', gap: 10, padding: 24, marginTop: SIZES.lg, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.sageLight },
  summaryTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, textAlign: 'center' },
  summaryMetric: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: COLORS.ink },
  focusText: { ...TYPOGRAPHY.supporting, color: COLORS.brand, textAlign: 'center', fontWeight: '600' },
  saveStatus: { ...TYPOGRAPHY.supporting, color: COLORS.muted, textAlign: 'center' },
});
