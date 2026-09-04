import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { COLORS, createThemedStyles, LAYOUT } from '../../utils/constants';
import { EXERCISE_COPY, STRENGTH_COPY, STRENGTH_DEFAULTS } from './constants';

const READY_NAMES = {
  'bodyweight-squat-v1': 'squats',
  'wall-pushup-v1': 'wall push-ups',
  'side-leg-raise-v1': 'side-leg raises',
};

function ExerciseChoices({ onSelect }) {
  return (
    <View style={styles.list} accessibilityRole='list'>
      {Object.entries(EXERCISE_COPY).map(([id, item]) => (
        <Pressable key={id} onPress={() => onSelect(id)} accessibilityRole='button' accessibilityLabel={`${item.name}, ${STRENGTH_DEFAULTS.targetReps} repetitions`} style={({ pressed, focused }) => [styles.option, focused && styles.focused, pressed && styles.pressed]}>
          <View style={styles.optionIcon}><Icon name={item.icon} size={24} color={COLORS.brand} /></View>
          <View style={styles.flex}><Text style={styles.optionText}>{item.name}</Text><Text style={styles.optionMeta}>{STRENGTH_DEFAULTS.targetReps} reps · Camera-free</Text></View>
          <Icon name='chevron-forward' size={18} color={COLORS.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function MovementGuide({ exercise }) {
  return (
    <View style={styles.movementGuide} accessibilityLabel={`${exercise.name} movement guide`}>
      <Text style={styles.guideLabel}>{exercise.name.toUpperCase()} FORM</Text>
      <View style={styles.guideIcon}><Icon name={exercise.icon} size={82} color={COLORS.sage} /></View>
      <Text style={styles.guideCaption}>{exercise.steps[1]}</Text>
    </View>
  );
}

export default function StrengthUnsupportedScreen({ onBack, embedded = false, initialExerciseId = 'bodyweight-squat-v1' }) {
  const validInitial = EXERCISE_COPY[initialExerciseId] ? initialExerciseId : 'bodyweight-squat-v1';
  const [exerciseId, setExerciseId] = useState(validInitial);
  const [phase, setPhase] = useState(embedded ? 'ready' : 'select');
  const [count, setCount] = useState(0);
  const exercise = EXERCISE_COPY[exerciseId];

  const reset = () => { setCount(0); setPhase('select'); };
  let content;
  if (phase === 'active') {
    content = (
      <View style={styles.active}>
        <Text style={styles.activeTitle}>{exercise.name}</Text>
        <Text style={styles.body}>{exercise.intro}</Text>
        <MovementGuide exercise={exercise} />
        <View style={styles.countRow}><Text style={styles.count}>{count}</Text><Text style={styles.countLabel}>/ {STRENGTH_DEFAULTS.targetReps} reps</Text></View>
        <Pressable accessibilityRole='button' accessibilityLabel='Count one repetition' onPress={() => setCount((value) => Math.min(STRENGTH_DEFAULTS.targetReps, value + 1))} style={({ pressed, focused }) => [styles.countButton, focused && styles.focused, pressed && styles.pressed]}>
          <Icon name='add' size={34} color={COLORS.ink} />
        </Pressable>
        <View style={styles.actionRow}>
          <Button title='Skip' variant='secondary' onPress={reset} style={styles.actionButton} />
          <Button title='Finish' onPress={reset} style={styles.actionButton} />
        </View>
      </View>
    );
  } else if (phase === 'ready') {
    content = (
      <View style={styles.ready}>
        <View style={styles.cameraFreeIcon}><Icon name='videocam-off-outline' size={26} color={COLORS.brand} /></View>
        <Text style={styles.title}>Ready for {READY_NAMES[exerciseId] || 'your set'}?</Text>
        <View style={styles.readyMeta}><Text style={styles.readyMetaText}>{STRENGTH_DEFAULTS.targetReps} reps</Text><Text style={styles.readyMetaDot}>·</Text><Text style={styles.readyMetaText}>Camera-free</Text></View>
        <View style={styles.readyCard}>{exercise.steps.map((step) => <View key={step} style={styles.readyStep}><Icon name='checkmark-circle-outline' size={19} color={COLORS.sage} /><Text style={styles.readyStepText}>{step}</Text></View>)}</View>
        <Button title='Start guided set' accessibilityHint='Starts the camera-free repetition counter' onPress={() => setPhase('active')} style={styles.primary} />
        <Button title='Choose another exercise' variant='secondary' onPress={() => setPhase('select')} style={styles.secondary} />
      </View>
    );
  } else {
    content = (
      <View>
        <View style={styles.hero}><Text style={styles.title}>Move at home</Text><Text style={styles.body}>Follow calm, camera-free guidance and count each repetition yourself.</Text></View>
        <ExerciseChoices onSelect={(id) => { setExerciseId(id); setCount(0); setPhase('ready'); }} />
        <View style={styles.privacyNote}><Icon name='shield-checkmark-outline' size={20} color={COLORS.sage} /><Text style={styles.privacyText}>{STRENGTH_COPY.unsupportedBody}</Text></View>
        {onBack ? <Button title='Back' variant='ghost' onPress={onBack} style={styles.secondary} /> : null}
      </View>
    );
  }

  if (embedded) return <View style={styles.embedded}>{content}</View>;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.header}><View style={styles.headerSide} /><Text style={styles.wordmark}>Strength</Text><View style={styles.headerSide}><Icon name='videocam-off-outline' size={20} color={COLORS.brand} /></View></View>
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: { flex: 1, minHeight: 0, backgroundColor: COLORS.canvas },
  scroll: { flex: 1, minHeight: 0 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingBottom: 38 },
  embedded: { width: '100%', paddingTop: 18 },
  flex: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.hairlineSoft },
  headerSide: { width: 42, alignItems: 'center' },
  wordmark: { color: COLORS.brand, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 22 },
  title: { color: COLORS.ink, fontSize: 25, lineHeight: 31, fontWeight: '700', textAlign: 'center', letterSpacing: -0.35 },
  body: { maxWidth: 440, marginTop: 8, color: COLORS.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  list: { width: '100%', gap: 10 },
  option: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, backgroundColor: COLORS.white },
  optionIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: COLORS.surfaceStrong },
  optionText: { color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  optionMeta: { marginTop: 4, color: COLORS.muted, fontSize: 12, lineHeight: 16 },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20, padding: 14, borderRadius: 13, backgroundColor: COLORS.sageLight },
  privacyText: { flex: 1, color: COLORS.body, fontSize: 13, lineHeight: 19 },
  ready: { alignItems: 'center', paddingTop: 12 },
  cameraFreeIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderRadius: 29, backgroundColor: COLORS.brandSoft },
  readyMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  readyMetaText: { color: COLORS.body, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  readyMetaDot: { color: COLORS.hairline, fontSize: 14 },
  readyCard: { width: '100%', gap: 12, marginTop: 22, padding: 17, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 16, backgroundColor: COLORS.surfaceSoft },
  readyStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  readyStepText: { flex: 1, color: COLORS.body, fontSize: 14, lineHeight: 20 },
  primary: { width: '100%', marginTop: 22, borderRadius: 999 },
  secondary: { width: '100%', marginTop: 9 },
  active: { alignItems: 'center', paddingTop: 16 },
  activeTitle: { color: COLORS.ink, fontSize: 25, lineHeight: 31, fontWeight: '700', textAlign: 'center' },
  movementGuide: { width: '100%', maxWidth: 390, minHeight: 220, alignItems: 'center', justifyContent: 'center', marginTop: 24, padding: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 14, backgroundColor: COLORS.surfaceSoft },
  guideLabel: { color: COLORS.muted, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.8 },
  guideIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guideCaption: { color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 22 },
  count: { color: COLORS.brand, fontSize: 56, lineHeight: 60, fontWeight: '800', fontVariant: ['tabular-nums'] },
  countLabel: { paddingBottom: 8, color: COLORS.muted, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  countButton: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginTop: 16, borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 44, backgroundColor: COLORS.surfaceStrong },
  actionRow: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 24 },
  actionButton: { flex: 1 },
  focused: { borderColor: COLORS.brand, borderWidth: 2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
