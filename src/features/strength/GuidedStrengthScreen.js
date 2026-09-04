import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { COLORS, createThemedStyles, LAYOUT, SIZES, TYPOGRAPHY } from '../../utils/constants';
import { MotionScrollView, ScrollReveal } from '../../components/Motion';
import { storage } from '../../services/storage';
import { EXERCISE_LIBRARY, FOCUS_AREAS, exercisesByFocus } from './data/exerciseLibrary';
import { summarizeSessions } from './data/strengthStats';
import StatsHeader from './components/StatsHeader';
import ExerciseCard from './components/ExerciseCard';
import ExerciseDetail from './components/ExerciseDetail';
import SessionPlayer from './components/SessionPlayer';

// Bloom Strength — camera-free guided workouts.
// View machine: 'catalog' → 'detail' → 'session'.
export default function StrengthScreen() {
  const [view, setView] = useState('catalog');
  const [focus, setFocus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null); // { exercise, sets }
  const [sessions, setSessions] = useState([]);

  const loadSessions = useCallback(async () => {
    try {
      const stored = await storage.getStrengthSessions();
      setSessions(Array.isArray(stored) ? stored : []);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const stats = useMemo(() => summarizeSessions(sessions), [sessions]);
  const filtered = useMemo(() => exercisesByFocus(focus), [focus]);

  const handleSelect = useCallback((exercise) => {
    setSelected(exercise);
    setView('detail');
  }, []);

  const handleStart = useCallback((exercise, sets) => {
    setSession({ exercise, sets });
    setView('session');
  }, []);

  const handleComplete = useCallback(async (summary) => {
    try {
      const next = await storage.saveStrengthSession(summary);
      setSessions(Array.isArray(next) ? next : [summary, ...sessions]);
    } catch {
      setSessions((current) => [summary, ...current]);
    }
  }, [sessions]);

  const handleExitSession = useCallback(() => {
    setSession(null);
    setSelected(null);
    setView('catalog');
    loadSessions();
  }, [loadSessions]);

  if (view === 'session' && session) {
    return (
      <SessionPlayer
        exercise={session.exercise}
        sets={session.sets}
        onExit={handleExitSession}
        onComplete={handleComplete}
      />
    );
  }

  if (view === 'detail' && selected) {
    return (
      <ExerciseDetail
        exercise={selected}
        onBack={() => { setView('catalog'); setSelected(null); }}
        onStart={handleStart}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>Strength</Text>
        <View style={styles.libraryPill}>
          <Icon name="barbell-outline" size={14} color={COLORS.brand} />
          <Text style={styles.libraryPillText}>{EXERCISE_LIBRARY.length} moves</Text>
        </View>
      </View>

      <MotionScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <StatsHeader stats={stats} />

        <ScrollReveal style={styles.filterWrap}>
          <View style={styles.filterRow}>
            {FOCUS_AREAS.map((area) => {
              const active = area.id === focus;
              return (
                <Pressable
                  key={area.id}
                  onPress={() => setFocus(area.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed, hovered }) => [
                    styles.chip,
                    hovered && styles.chipHover,
                    active && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{area.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollReveal>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Choose a move</Text>
          <Text style={styles.listCount}>{filtered.length} {filtered.length === 1 ? 'move' : 'moves'}</Text>
        </View>

        <View style={styles.list}>
          {filtered.map((exercise, index) => (
            <ScrollReveal key={exercise.id} delay={index * 40}>
              <ExerciseCard exercise={exercise} onPress={handleSelect} testID={`exercise-${exercise.id}`} />
            </ScrollReveal>
          ))}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No moves in this group yet.</Text>
            </View>
          ) : null}
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.screenPadding, paddingTop: SIZES.sm, paddingBottom: SIZES.compact,
  },
  wordmark: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink },
  libraryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.brandSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  libraryPillText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  scroll: { paddingHorizontal: LAYOUT.screenPadding, paddingBottom: SIZES.xxl, gap: SIZES.lg, maxWidth: LAYOUT.maxContentWidth, width: '100%', alignSelf: 'center' },
  filterWrap: { marginBottom: -SIZES.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.hairline,
  },
  chipHover: { borderColor: COLORS.borderStrong },
  chipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  chipPressed: { transform: [{ scale: 0.96 }] },
  chipText: { ...TYPOGRAPHY.supporting, color: COLORS.body, fontWeight: '600' },
  chipTextActive: { color: COLORS.canvas },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SIZES.xs },
  listTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  listCount: { ...TYPOGRAPHY.supporting, color: COLORS.muted },
  list: { gap: SIZES.compact },
  empty: { padding: SIZES.xl, alignItems: 'center' },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.muted },
});
