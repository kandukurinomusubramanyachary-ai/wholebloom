import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import { COLORS, createThemedStyles, SIZES, TYPOGRAPHY } from '../../../utils/constants';
import { Entrance } from '../../../components/Motion';
import ProgressRing from './ProgressRing';
import { useGuidedSession } from '../useGuidedSession';

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function SessionPlayer({ exercise, sets, onExit, onComplete }) {
  const { state, controls } = useGuidedSession(exercise, sets);
  const [cueIndex, setCueIndex] = useState(0);
  const savedRef = useRef(false);

  // Rotate through the exercise's gentle cues while active.
  useEffect(() => {
    if (state.phase !== 'active') return undefined;
    const id = setInterval(() => {
      setCueIndex((i) => (i + 1) % (exercise.cues?.length || 1));
    }, 4000);
    return () => clearInterval(id);
  }, [state.phase, exercise.cues]);

  // Fire completion save exactly once.
  useEffect(() => {
    if (state.phase === 'complete' && !savedRef.current) {
      savedRef.current = true;
      const reps = exercise.mode === 'hold'
        ? 0
        : state.totalRepsDone;
      onComplete?.({
        id: `strength-${Date.now()}`,
        exerciseId: exercise.id,
        name: exercise.name,
        mode: exercise.mode,
        sets: state.setsPlanned,
        reps,
        holdSec: exercise.mode === 'hold' ? exercise.holdSec : 0,
        durationSec: Math.round(state.elapsedSec),
        completedAt: new Date().toISOString(),
      });
    }
  }, [state.phase, state.totalRepsDone, state.setsPlanned, state.elapsedSec, exercise, onComplete]);

  const ringProgress = useMemo(() => {
    if (state.phase === 'countdown') return 1 - state.remaining / 3;
    if (state.phase === 'rest') return 1 - state.remaining / Math.max(1, state.restSec);
    if (state.phase === 'active') {
      if (state.mode === 'hold') return 1 - state.remaining / Math.max(1, state.holdSec);
      return state.repProgress;
    }
    return 0;
  }, [state]);

  const ringColor = state.phase === 'rest' ? COLORS.success : COLORS.brand;

  // ---- Completion view --------------------------------------------------
  if (state.phase === 'complete') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.completeWrap}>
          <Entrance from="bottom" scaleFrom={0.92}>
            <View style={styles.completeBadge}>
              <Icon name="checkmark" size={44} color={COLORS.onBrand} />
            </View>
          </Entrance>
          <Entrance from="bottom" delay={80}>
            <Text style={styles.completeTitle}>Nicely done</Text>
            <Text style={styles.completeSub}>{exercise.name} complete</Text>
          </Entrance>
          <Entrance from="bottom" delay={160} style={styles.completeStats}>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>{state.setsPlanned}</Text>
              <Text style={styles.completeStatLabel}>sets</Text>
            </View>
            <View style={styles.completeDivider} />
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>
                {exercise.mode === 'hold' ? `${exercise.holdSec}s` : state.totalRepsDone}
              </Text>
              <Text style={styles.completeStatLabel}>{exercise.mode === 'hold' ? 'per hold' : 'reps'}</Text>
            </View>
            <View style={styles.completeDivider} />
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>{formatClock(state.elapsedSec)}</Text>
              <Text style={styles.completeStatLabel}>time</Text>
            </View>
          </Entrance>
          <Entrance from="bottom" delay={220} style={styles.completeActions}>
            <Button title="Done" icon="checkmark-circle-outline" onPress={onExit} style={styles.doneButton} />
            <Button
              title="Repeat"
              variant="secondary"
              icon="refresh-outline"
              onPress={() => { savedRef.current = false; controls.reset(); controls.start(); }}
              style={styles.repeatButton}
            />
          </Entrance>
        </View>
      </SafeAreaView>
    );
  }

  const isIdle = state.phase === 'idle';
  const isPaused = state.phase === 'paused';
  const isRest = state.phase === 'rest';
  const isCountdown = state.phase === 'countdown';

  // ---- Center label -----------------------------------------------------
  let bigLabel;
  let smallLabel;
  if (isIdle) {
    bigLabel = exercise.mode === 'hold' ? `${exercise.holdSec}s` : String(exercise.defaultReps);
    smallLabel = exercise.mode === 'hold' ? 'per hold' : 'reps per set';
  } else if (isCountdown) {
    bigLabel = String(Math.ceil(state.remaining));
    smallLabel = 'get ready';
  } else if (isRest) {
    bigLabel = formatClock(state.remaining);
    smallLabel = 'rest';
  } else if (state.mode === 'hold') {
    bigLabel = String(Math.ceil(state.remaining));
    smallLabel = 'hold';
  } else {
    bigLabel = String(state.currentRep);
    smallLabel = `of ${state.repsPerSet} reps`;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="End session" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="close" size={22} color={COLORS.ink} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{exercise.name}</Text>
          <Text style={styles.headerMeta}>
            Set {Math.min(state.currentSet, state.setsPlanned)} of {state.setsPlanned}
          </Text>
        </View>
        <View style={styles.iconButton} />
      </View>

      {/* Set progress dots */}
      <View style={styles.setDots}>
        {Array.from({ length: state.setsPlanned }).map((_, i) => {
          const done = i + 1 < state.currentSet || (state.phase === 'complete');
          const current = i + 1 === state.currentSet && !isIdle;
          return (
            <View
              key={i}
              style={[styles.setDot, done && styles.setDotDone, current && styles.setDotCurrent]}
            />
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.centerArea} showsVerticalScrollIndicator={false}>
        <ProgressRing
          progress={ringProgress}
          size={252}
          strokeWidth={16}
          color={ringColor}
          trackColor={COLORS.surfaceStrong}
          pulseKey={state.mode === 'reps' && state.lastEvent === 'rep' ? state.eventNonce : null}
          animated={state.phase !== 'active' || state.mode !== 'reps' ? true : true}
        >
          <Text style={[styles.bigLabel, isRest && styles.bigLabelRest]}>{bigLabel}</Text>
          <Text style={styles.smallLabel}>{smallLabel}</Text>
        </ProgressRing>

        {/* Live cue / rest copy */}
        <View style={styles.cueArea}>
          {isRest ? (
            <Entrance replayKey="rest" from="bottom">
              <Text style={styles.cueRest}>Rest and breathe. Next set coming up.</Text>
            </Entrance>
          ) : state.phase === 'active' ? (
            <Entrance replayKey={cueIndex} from="bottom">
              <View style={styles.cuePill}>
                <Icon name="sparkles-outline" size={14} color={COLORS.brand} />
                <Text style={styles.cueText}>{exercise.cues?.[cueIndex] || exercise.intro}</Text>
              </View>
            </Entrance>
          ) : isCountdown ? (
            <Text style={styles.cueRest}>Find your position…</Text>
          ) : (
            <Text style={styles.cueRest}>{exercise.intro}</Text>
          )}
        </View>
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {isIdle ? (
          <Button title="Begin" icon="play" onPress={controls.start} style={styles.primaryControl} testID="strength-begin" />
        ) : isRest ? (
          <View style={styles.controlRow}>
            <Button title="Skip rest" variant="secondary" icon="play-skip-forward-outline" onPress={controls.skipRest} style={styles.flexButton} testID="strength-skip-rest" />
          </View>
        ) : isPaused ? (
          <View style={styles.controlRow}>
            <Button title="Resume" icon="play" onPress={controls.resume} style={styles.flexButton} testID="strength-resume" />
            <Button title="End" variant="secondary" icon="stop-outline" onPress={onExit} style={styles.flexButton} />
          </View>
        ) : (
          <Button title="Pause" variant="secondary" icon="pause" onPress={controls.pause} style={styles.primaryControl} testID="strength-pause" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SIZES.md, paddingVertical: SIZES.compact },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  headerMeta: { ...TYPOGRAPHY.caption, color: COLORS.muted, marginTop: 1 },
  setDots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingVertical: 6 },
  setDot: { width: 26, height: 5, borderRadius: 3, backgroundColor: COLORS.hairline },
  setDotDone: { backgroundColor: COLORS.brand },
  setDotCurrent: { backgroundColor: COLORS.brandActive },
  centerArea: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: SIZES.xl, paddingVertical: SIZES.lg },
  bigLabel: { fontSize: 68, lineHeight: 74, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  bigLabelRest: { color: COLORS.success },
  smallLabel: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginTop: -4 },
  cueArea: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIZES.gutter },
  cuePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.brandSoft, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  cueText: { ...TYPOGRAPHY.body, color: COLORS.brand, fontWeight: '600' },
  cueRest: { ...TYPOGRAPHY.body, color: COLORS.muted, textAlign: 'center' },
  controls: { paddingHorizontal: SIZES.gutter, paddingBottom: SIZES.md, paddingTop: SIZES.sm },
  controlRow: { flexDirection: 'row', gap: SIZES.compact },
  flexButton: { flex: 1 },
  primaryControl: { width: '100%' },
  // completion
  completeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SIZES.lg, paddingHorizontal: SIZES.gutter },
  completeBadge: {
    width: 92, height: 92, borderRadius: 46, backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  completeTitle: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink, textAlign: 'center' },
  completeSub: { ...TYPOGRAPHY.body, color: COLORS.muted, textAlign: 'center', marginTop: 4 },
  completeStats: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.md,
    backgroundColor: COLORS.surfaceSoft, borderRadius: 18, paddingVertical: SIZES.md, paddingHorizontal: SIZES.lg,
    borderWidth: 1, borderColor: COLORS.hairline,
  },
  completeStat: { alignItems: 'center', minWidth: 60 },
  completeStatValue: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, fontWeight: '700' },
  completeStatLabel: { ...TYPOGRAPHY.caption, color: COLORS.muted, marginTop: 2 },
  completeDivider: { width: 1, height: 32, backgroundColor: COLORS.hairline },
  completeActions: { width: '100%', maxWidth: 360, gap: SIZES.compact },
  doneButton: { width: '100%' },
  repeatButton: { width: '100%' },
});
