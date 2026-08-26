import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/Button';
import { COLORS, createThemedStyles } from '../../../utils/constants';
import { EXERCISE_COPY } from '../constants';

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(Math.floor(safeSeconds % 60)).padStart(2, '0')}`;
}

function completedLabel(summary) {
  const exercise = EXERCISE_COPY[summary.exerciseId]?.name || 'Reps';
  if (exercise === 'Bodyweight squat') return 'SQUATS COMPLETED';
  return `${exercise.toUpperCase()} REPS`;
}

export default function StrengthSummary({ summary, observation, focus, synced, onDone, onAgain }) {
  const completed = summary.completionState === 'completed';
  return (
    <View style={styles.wrap}>
      <View style={styles.mark}><Ionicons name={completed ? 'checkmark-circle-outline' : 'bookmark-outline'} size={38} color={COLORS.brand} /></View>
      <Text style={styles.title}>{completed ? 'Session Complete' : 'Session Saved'}</Text>
      <Text style={styles.subtitle}>{completed ? 'Great work today.' : 'Your movement still counts.'}</Text>

      <View style={styles.stats}>
        <View style={styles.statCard}><Text style={styles.statValue}>{summary.acceptedReps}</Text><Text style={styles.statLabel}>{completedLabel(summary)}</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{formatDuration(summary.durationSeconds)}</Text><Text style={styles.statLabel}>DURATION</Text></View>
      </View>

      <View style={styles.insights}>
        <View style={styles.insightCard}>
          <Ionicons name='analytics-outline' size={20} color={COLORS.brand} />
          <View style={styles.flex}><Text style={styles.insightTitle}>Observation</Text><Text style={styles.insightBody}>{observation}</Text></View>
        </View>
        {focus ? (
          <View style={styles.insightCard}>
            <Ionicons name='bulb-outline' size={20} color={COLORS.brand} />
            <View style={styles.flex}><Text style={styles.insightTitle}>Focus Tip</Text><Text style={styles.insightBody}>{focus}</Text></View>
          </View>
        ) : null}
      </View>

      <Text style={styles.sync}>{synced ? 'Saved to your Bloom account.' : 'Saved on this device. Bloom will sync when you are online.'}</Text>
      <Button title='Done' onPress={onDone} style={styles.button} />
      <Button title='Try again' variant='secondary' onPress={onAgain} style={styles.againButton} />
    </View>
  );
}

const styles = createThemedStyles({
  wrap: { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
  flex: { flex: 1 },
  mark: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 17, borderRadius: 36, backgroundColor: COLORS.brandSoft },
  title: { color: COLORS.ink, fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  subtitle: { marginTop: 5, color: COLORS.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  stats: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 26 },
  statCard: { flex: 1, minHeight: 112, alignItems: 'center', justifyContent: 'center', padding: 14, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 14, backgroundColor: COLORS.surfaceSoft },
  statValue: { color: COLORS.brand, fontSize: 36, lineHeight: 41, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.7 },
  statLabel: { marginTop: 4, color: COLORS.muted, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  insights: { width: '100%', gap: 10, marginTop: 22 },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 13, backgroundColor: COLORS.surfaceSoft },
  insightTitle: { color: COLORS.ink, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  insightBody: { marginTop: 3, color: COLORS.body, fontSize: 13, lineHeight: 19 },
  sync: { marginTop: 15, color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  button: { width: '100%', marginTop: 22 },
  againButton: { width: '100%', marginTop: 8 },
});
