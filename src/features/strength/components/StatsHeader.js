import React from 'react';
import { Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { COLORS, createThemedStyles, SIZES, TYPOGRAPHY } from '../../../utils/constants';
import { ScrollReveal } from '../../../components/Motion';
import { localDateKey } from '../../../utils/dateKey';

function Stat({ icon, value, label }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}><Icon name={icon} size={16} color={COLORS.brand} /></View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function StatsHeader({ stats }) {
  const maxReps = Math.max(1, ...stats.weekBars.map((bar) => bar.reps));
  const hasActivity = stats.totalReps > 0;
  const todayKey = localDateKey();

  return (
    <ScrollReveal style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>This week</Text>
          <Text style={styles.title}>Your strength</Text>
        </View>
        <View style={[styles.streakPill, stats.streak > 0 && styles.streakPillActive]}>
          <Icon name="flame-outline" size={15} color={stats.streak > 0 ? COLORS.brand : COLORS.muted} />
          <Text style={[styles.streakText, stats.streak === 0 && styles.streakTextIdle]}>
            {stats.streak} day{stats.streak === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat icon="checkmark-circle-outline" value={stats.sessionCount} label="sessions" />
        <View style={styles.divider} />
        <Stat icon="repeat-outline" value={stats.totalReps} label="reps" />
        <View style={styles.divider} />
        <Stat icon="time-outline" value={`${stats.totalMinutes}m`} label="active" />
      </View>

      <View style={styles.chartBlock}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Last 7 days</Text>
          {hasActivity ? (
            <Text style={styles.chartHint}>{stats.activeDays} active</Text>
          ) : null}
        </View>
        <View style={styles.chart} accessibilityLabel="Reps over the last seven days">
          {stats.weekBars.map((bar) => {
            const isToday = bar.key === todayKey;
            const filled = bar.reps > 0;
            const fillColor = !filled
              ? 'transparent'
              : isToday
                ? COLORS.brandActive
                : COLORS.brand;
            return (
              <View key={bar.key} style={styles.barColumn}>
                <View style={[styles.barTrack, { backgroundColor: COLORS.surfaceStrong }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: filled ? `${Math.max(14, Math.round((bar.reps / maxReps) * 100))}%` : 0,
                        backgroundColor: fillColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{bar.label}</Text>
              </View>
            );
          })}
        </View>
        {!hasActivity ? (
          <View style={styles.emptyHint}>
            <Icon name="sparkles-outline" size={14} color={COLORS.brand} />
            <Text style={styles.emptyHintText}>Finish a session to start your streak.</Text>
          </View>
        ) : null}
      </View>
    </ScrollReveal>
  );
}

const styles = createThemedStyles({
  card: {
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 20,
    padding: SIZES.gutter,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    gap: SIZES.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { ...TYPOGRAPHY.caption, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, marginTop: 2 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.surfaceStrong, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  streakPillActive: { backgroundColor: COLORS.brandSoft },
  streakText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  streakTextIdle: { color: COLORS.muted },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.brandSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  statValue: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, fontWeight: '700' },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.muted },
  divider: { width: 1, height: 34, backgroundColor: COLORS.hairline },
  chartBlock: { gap: SIZES.sm },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { ...TYPOGRAPHY.caption, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  chartHint: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '600' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 60, gap: 6 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', height: 40, borderRadius: 7, backgroundColor: COLORS.surfaceStrong, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: COLORS.brand, borderRadius: 7, minHeight: 3 },
  barToday: { backgroundColor: COLORS.brandActive },
  barEmpty: { backgroundColor: COLORS.hairline },
  barLabel: { ...TYPOGRAPHY.caption, color: COLORS.muted, fontSize: 10 },
  barLabelToday: { color: COLORS.brand, fontWeight: '700' },
  emptyHint: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 2 },
  emptyHintText: { ...TYPOGRAPHY.caption, color: COLORS.muted },
});
