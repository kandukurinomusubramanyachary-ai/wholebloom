import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { COLORS, createThemedStyles, SIZES, TYPOGRAPHY } from '../../../utils/constants';
import { LEVELS } from '../data/exerciseLibrary';

const LEVEL_COLOR = { success: 'success', brand: 'brand', warning: 'warning' };

export default function ExerciseCard({ exercise, onPress, testID }) {
  const level = LEVELS[exercise.level] || LEVELS.steady;
  const levelColorKey = LEVEL_COLOR[level.color] || 'brand';
  const meta = exercise.mode === 'hold'
    ? `${exercise.holdSec}s hold · ${exercise.defaultSets} sets`
    : `${exercise.defaultReps} reps · ${exercise.defaultSets} sets`;

  return (
    <Pressable
      testID={testID}
      onPress={() => onPress(exercise)}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${meta}, ${level.label} level`}
      style={({ pressed, hovered, focused }) => [
        styles.card,
        hovered && styles.cardHover,
        focused && styles.cardFocused,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: COLORS[levelColorKey] }]} />
      <View style={styles.iconWrap}>
        <Icon name={exercise.icon} size={24} color={COLORS.brand} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{exercise.name}</Text>
          <View style={[styles.levelPill, { backgroundColor: COLORS.surfaceStrong }]}>
            <View style={[styles.levelDot, { backgroundColor: COLORS[levelColorKey] }]} />
            <Text style={styles.levelText}>{level.label}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Icon name="repeat-outline" size={13} color={COLORS.muted} />
          <Text style={styles.meta}>{meta}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Icon name="time-outline" size={13} color={COLORS.muted} />
          <Text style={styles.meta}>{exercise.minutes} min</Text>
        </View>
      </View>
      <Icon name="chevron-forward" size={18} color={COLORS.muted} />
    </Pressable>
  );
}

const styles = createThemedStyles({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SIZES.compact,
    backgroundColor: COLORS.canvas, borderRadius: 16, padding: 14, paddingLeft: 18,
    borderWidth: 1, borderColor: COLORS.hairline, overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardHover: { borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSoft },
  cardFocused: { borderColor: COLORS.brand },
  cardPressed: { backgroundColor: COLORS.surfaceStrong, transform: [{ scale: 0.99 }] },
  iconWrap: {
    width: 46, height: 46, borderRadius: 13, backgroundColor: COLORS.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink, flexShrink: 1 },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { ...TYPOGRAPHY.caption, color: COLORS.body, fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { ...TYPOGRAPHY.supporting, color: COLORS.muted },
  metaDot: { color: COLORS.muted, marginHorizontal: 1 },
});
