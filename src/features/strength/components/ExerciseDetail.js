import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import { COLORS, createThemedStyles, SIZES, TYPOGRAPHY } from '../../../utils/constants';
import { Entrance } from '../../../components/Motion';
import { LEVELS } from '../data/exerciseLibrary';

const SET_OPTIONS = [1, 2, 3, 4, 5];
const LEVEL_COLOR = { success: 'success', brand: 'brand', warning: 'warning' };

export default function ExerciseDetail({ exercise, onBack, onStart }) {
  const [sets, setSets] = useState(exercise.defaultSets || 3);
  const level = LEVELS[exercise.level] || LEVELS.steady;
  const levelColorKey = LEVEL_COLOR[level.color] || 'brand';

  const perSet = exercise.mode === 'hold'
    ? `${exercise.holdSec}s hold`
    : `${exercise.defaultReps} reps`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to exercises" style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="chevron-back" size={22} color={COLORS.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Set up</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Entrance from="bottom" style={styles.hero}>
          <View style={styles.heroIcon}><Icon name={exercise.icon} size={38} color={COLORS.brand} /></View>
          <Text style={styles.heroName}>{exercise.name}</Text>
          <View style={[styles.levelPill, { backgroundColor: COLORS.surfaceStrong }]}>
            <View style={[styles.levelDot, { backgroundColor: COLORS[levelColorKey] }]} />
            <Text style={styles.levelText}>{level.label}</Text>
          </View>
          <Text style={styles.heroIntro}>{exercise.intro}</Text>
        </Entrance>

        <Entrance from="bottom" delay={80} style={styles.metaCard}>
          <View style={styles.metaItem}>
            <Icon name="repeat-outline" size={18} color={COLORS.brand} />
            <Text style={styles.metaValue}>{perSet}</Text>
            <Text style={styles.metaLabel}>{exercise.mode === 'hold' ? 'each set' : 'per set'}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Icon name="time-outline" size={18} color={COLORS.brand} />
            <Text style={styles.metaValue}>{exercise.restSec}s</Text>
            <Text style={styles.metaLabel}>rest</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Icon name="hourglass-outline" size={18} color={COLORS.brand} />
            <Text style={styles.metaValue}>~{exercise.minutes}m</Text>
            <Text style={styles.metaLabel}>total</Text>
          </View>
        </Entrance>

        <Entrance from="bottom" delay={140}>
          <Text style={styles.sectionLabel}>How many sets?</Text>
          <View style={styles.setRow}>
            {SET_OPTIONS.map((option) => {
              const active = option === sets;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSets(option)}
                  accessibilityRole="button"
                  accessibilityLabel={`${option} sets`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed, hovered }) => [
                    styles.setChip,
                    hovered && styles.setChipHover,
                    active && styles.setChipActive,
                    pressed && styles.setChipPressed,
                  ]}
                >
                  <Text style={[styles.setChipText, active && styles.setChipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </Entrance>

        <Entrance from="bottom" delay={200}>
          <Text style={styles.sectionLabel}>The movement</Text>
          <View style={styles.steps}>
            {exercise.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </Entrance>

        <Entrance from="bottom" delay={240} style={styles.safetyNote}>
          <Icon name="shield-checkmark-outline" size={16} color={COLORS.muted} />
          <Text style={styles.safetyText}>
            Move only through a comfortable range. Ease up if anything hurts or you feel unwell.
          </Text>
        </Entrance>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={`Start · ${sets} set${sets === 1 ? '' : 's'}`}
          icon="play"
          onPress={() => onStart(exercise, sets)}
          style={styles.startButton}
          testID="strength-start-session"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.md, paddingVertical: SIZES.compact },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  headerTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  content: { padding: SIZES.gutter, gap: SIZES.lg, paddingBottom: SIZES.xxl },
  hero: { alignItems: 'center', gap: SIZES.sm },
  heroIcon: { width: 76, height: 76, borderRadius: 22, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  heroName: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink, textAlign: 'center' },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { ...TYPOGRAPHY.caption, color: COLORS.body, fontSize: 12, fontWeight: '600' },
  heroIntro: { ...TYPOGRAPHY.body, color: COLORS.muted, textAlign: 'center', maxWidth: 420, marginTop: 2 },
  metaCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceSoft,
    borderRadius: 18, paddingVertical: SIZES.md, borderWidth: 1, borderColor: COLORS.hairline,
  },
  metaItem: { flex: 1, alignItems: 'center', gap: 3 },
  metaValue: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink, fontWeight: '700' },
  metaLabel: { ...TYPOGRAPHY.caption, color: COLORS.muted },
  metaDivider: { width: 1, height: 40, backgroundColor: COLORS.hairline },
  sectionLabel: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink, marginBottom: SIZES.compact },
  setRow: { flexDirection: 'row', gap: SIZES.sm },
  setChip: {
    flex: 1, height: 52, borderRadius: 14, backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1, borderColor: COLORS.hairline, alignItems: 'center', justifyContent: 'center',
  },
  setChipHover: { borderColor: COLORS.borderStrong },
  setChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  setChipPressed: { transform: [{ scale: 0.96 }] },
  setChipText: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, fontWeight: '700' },
  setChipTextActive: { color: COLORS.onBrand },
  steps: { gap: SIZES.compact },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.compact },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  stepText: { ...TYPOGRAPHY.body, color: COLORS.body, flex: 1 },
  safetyNote: { flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-start', backgroundColor: COLORS.surfaceSoft, borderRadius: 14, padding: SIZES.compact },
  safetyText: { ...TYPOGRAPHY.supporting, color: COLORS.muted, flex: 1 },
  footer: { padding: SIZES.gutter, paddingTop: SIZES.sm, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  startButton: { width: '100%' },
});
