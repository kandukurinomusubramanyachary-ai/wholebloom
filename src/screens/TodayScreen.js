import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { format, isValid, parseISO, subDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { logCheckinEvent } from '../diagnostics/checkinDiagnostics';
import { localDateKey } from '../utils/dateKey';
import { preferredDisplayName } from '../utils/displayName';
import { buildDailyPlan } from '../services/dailyPlan';
import {
  AFFIRMATIONS,
  COLORS,
  LAYOUT,
  MOODS,
  SIZES,
  TYPOGRAPHY,
  createThemedStyles,
} from '../utils/constants';
import BrandMark from '../components/BrandMark';
import Button from '../components/Button';
import { MotionScrollView, Parallax, ScrollReveal } from '../components/Motion';

const PHASES = ['Menstruation', 'Follicular', 'Ovulation', 'Luteal'];

// One gentle, observational tip per phase — DESIGN.md voice: validating, never corrective.
const PHASE_TIPS = [
  'Rest is productive too. Warmth and slower movement can feel supportive today.',
  'Energy often lifts here. A short walk can feel especially good right now.',
  'You may feel more social and energetic. Notice what your body enjoys.',
  'Tenderness is common before your period. Be gentle with your plans today.',
];
const DEFAULT_TIP = 'Bloom is here when you are ready. A 30-second check-in helps you notice patterns.';

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(profile) {
  return preferredDisplayName(profile).split(' ')[0] || '';
}

function phaseIndexForLabel(label) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.includes('period')) return 0;
  if (normalized.includes('earlier') || normalized.includes('follicular')) return 1;
  if (normalized.includes('mid') || normalized.includes('ovulation')) return 2;
  if (normalized.includes('later') || normalized.includes('luteal')) return 3;
  return -1;
}

function friendlyPhaseLabel(label) {
  const index = phaseIndexForLabel(label);
  return index >= 0 ? `${PHASES[index]} phase` : label;
}

function validLatestPeriod(periods) {
  return [...(Array.isArray(periods) ? periods : [])]
    .filter((period) => {
      const parsed = period?.startDate ? parseISO(period.startDate) : null;
      return parsed && isValid(parsed);
    })
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0] || null;
}

// Deterministic per-day affirmation so it stays stable across a single day.
function affirmationForDate(dateKey) {
  const seed = String(dateKey || '').split('-').reduce((sum, part) => sum + Number(part || 0), 0);
  return AFFIRMATIONS[seed % AFFIRMATIONS.length] || AFFIRMATIONS[0];
}

function moodLabel(id) {
  return MOODS.find((mood) => mood.id === id)?.label || null;
}

function CycleContext({ state, navigation }) {
  const latestPeriod = validLatestPeriod(state.periods);
  const cycleDay = Number.isFinite(state.currentCycleDay) ? state.currentCycleDay : null;
  const phaseLabel = state.currentPhase?.label ? friendlyPhaseLabel(state.currentPhase.label) : null;
  const activePhase = phaseIndexForLabel(state.currentPhase?.label);

  if (!latestPeriod || !cycleDay) {
    return (
      <View style={styles.cycleCard}>
        <Text style={styles.cycleEyebrow}>CURRENT PHASE</Text>
        <View style={styles.phaseTitleRow}>
          <Icon name='water-outline' size={22} color={COLORS.brand} />
          <Text style={styles.phaseTitle}>Cycle context is ready when you are</Text>
        </View>
        <Text style={styles.emptyCycleText}>Log a period start date to see your current cycle day and phase estimate.</Text>
        <Pressable
          onPress={() => navigation.navigate('LogPeriod')}
          accessibilityRole='button'
          style={({ pressed, focused }) => [styles.cycleLink, focused && styles.focusRing, pressed && styles.pressed]}
        >
          <Text style={styles.cycleLinkText}>Log period dates</Text>
          <Icon name='arrow-forward' size={16} color={COLORS.brand} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cycleCard}>
      <View style={styles.cycleHeaderRow}>
        <Text style={styles.cycleEyebrow}>CURRENT PHASE</Text>
        <View style={styles.dayPill}>
          <Text style={styles.dayPillText}>Day {cycleDay}</Text>
        </View>
      </View>
      <View style={styles.phaseTitleRow}>
        <View style={styles.phaseIconWrap}>
          <Icon name='water' size={20} color={COLORS.brand} />
        </View>
        <Text style={styles.phaseTitle}>{phaseLabel || 'Pattern still forming'}</Text>
      </View>
      <View style={styles.phaseProgress}>
        <View style={styles.phaseTrack} accessibilityRole='progressbar' accessibilityValue={{ min: 0, max: 4, now: activePhase + 1 }}>
          {PHASES.map((phase, index) => (
            <View
              key={phase}
              style={[
                styles.phaseSegment,
                index < activePhase && styles.phaseSegmentPast,
                index === activePhase && styles.phaseSegmentActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.phaseLabels}>
          {PHASES.map((phase, index) => (
            <Text key={phase} numberOfLines={1} style={[styles.phaseLabel, index === activePhase && styles.phaseLabelActive]}>{phase}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function CheckInSummary({ checkin, onReview }) {
  const mood = moodLabel(checkin?.mood);
  const symptomCount = Array.isArray(checkin?.symptoms) ? checkin.symptoms.length : 0;
  const sleep = Number.isFinite(checkin?.sleep) ? checkin.sleep : null;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryBadge}>
          <Icon name='checkmark-circle' size={18} color={COLORS.sage} />
        </View>
        <Text style={styles.summaryTitle}>Today's check-in is done</Text>
      </View>
      <View style={styles.summaryChips}>
        {mood ? (
          <View style={styles.summaryChip}>
            <Icon name='happy-outline' size={14} color={COLORS.body} />
            <Text style={styles.summaryChipText}>{mood}</Text>
          </View>
        ) : null}
        {symptomCount > 0 ? (
          <View style={styles.summaryChip}>
            <Icon name='pulse-outline' size={14} color={COLORS.body} />
            <Text style={styles.summaryChipText}>{symptomCount} {symptomCount === 1 ? 'symptom' : 'symptoms'}</Text>
          </View>
        ) : null}
        {sleep != null ? (
          <View style={styles.summaryChip}>
            <Icon name='moon-outline' size={14} color={COLORS.body} />
            <Text style={styles.summaryChipText}>{sleep}h sleep</Text>
          </View>
        ) : null}
      </View>
      <Button
        title="Review today's check-in"
        icon='create-outline'
        variant='secondary'
        onPress={onReview}
        style={styles.summaryButton}
      />
    </View>
  );
}

function WeeklySnapshot({ state, today }) {
  const cutoff = localDateKey(subDays(new Date(), 6));
  const recentCheckins = (state.checkins || []).filter((item) => item?.date >= cutoff && item.date <= today);
  const recentMovements = (state.movements || []).filter((item) => item?.date >= cutoff && item.date <= today && item.status !== 'not_today');
  const sleepEntries = recentCheckins.filter((item) => Number.isFinite(item.sleep));
  const averageSleep = sleepEntries.length
    ? sleepEntries.reduce((sum, item) => sum + item.sleep, 0) / sleepEntries.length
    : null;
  const averageSleepMinutes = averageSleep == null ? null : Math.round(averageSleep * 60);
  const sleepHours = averageSleepMinutes == null ? null : Math.floor(averageSleepMinutes / 60);
  const sleepMinutes = averageSleepMinutes == null ? null : averageSleepMinutes % 60;

  return (
    <View style={styles.snapshotGrid}>
      <View style={styles.metricCard}>
        <View style={styles.metricIcon}>
          <Icon name='checkbox-outline' size={20} color={COLORS.brand} />
        </View>
        <View>
          <Text style={styles.metricValue}>{recentCheckins.length} <Text style={styles.metricSuffix}>/ 7</Text></Text>
          <Text style={styles.metricLabel}>Check-ins completed</Text>
        </View>
      </View>
      <View style={styles.metricCard}>
        <View style={styles.metricIcon}>
          <Icon name='fitness-outline' size={20} color={COLORS.brand} />
        </View>
        <View>
          <Text style={styles.metricValue}>{recentMovements.length} <Text style={styles.metricSuffix}>{recentMovements.length === 1 ? 'session' : 'sessions'}</Text></Text>
          <Text style={styles.metricLabel}>Strength &amp; movement</Text>
        </View>
      </View>
      <View style={styles.sleepCard}>
        <View style={styles.sleepCopy}>
          <View style={styles.sleepIcon}>
            <Icon name='moon' size={18} color={COLORS.sage} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.sleepValue}>{averageSleep == null ? 'Not enough data' : `${sleepHours}h ${sleepMinutes}m`}</Text>
            <Text style={styles.metricLabel}>Avg. sleep duration</Text>
          </View>
        </View>
        <View style={styles.sleepBars} accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
          {(sleepEntries.length ? sleepEntries.slice(-7).map((item) => item.sleep) : [0, 0, 0, 0, 0]).map((hours, index) => (
            <View key={`${hours}-${index}`} style={[styles.sleepBar, { height: averageSleep == null ? 3 : Math.max(5, Math.min(28, hours * 3)) }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function TodayScreen({ navigation }) {
  const { state, saveDailyPlan } = useApp();
  const { user } = useAuth();
  const checkinLaunchRef = useRef(false);
  const [opening, setCheckinOpening] = useState(false);
  const [checkinLaunchError, setCheckinLaunchError] = useState('');
  const now = new Date();
  const today = localDateKey(now);
  const todayPlan = (state.dailyPlans || []).find((item) => item.date === today) || null;
  const name = firstName(state.profile);
  const greeting = `${greetingForHour(now.getHours())}${name ? `, ${name}` : ''}.`;
  const dateLabel = format(now, 'EEEE, MMMM d');
  const affirmation = useMemo(() => affirmationForDate(today), [today]);
  const activePhase = phaseIndexForLabel(state.currentPhase?.label);
  const gentleTip = activePhase >= 0 ? PHASE_TIPS[activePhase] : DEFAULT_TIP;

  const resetCheckinLaunch = useCallback(() => {
    checkinLaunchRef.current = false;
    setCheckinOpening(false);
  }, []);

  useEffect(() => navigation.addListener('focus', resetCheckinLaunch), [navigation, resetCheckinLaunch]);

  useEffect(() => {
    if (!state.todayCheckin || todayPlan) return;
    const plan = buildDailyPlan({
      date: today,
      checkin: state.todayCheckin,
      meals: state.meals,
      movements: state.movements,
    });
    saveDailyPlan(plan).catch(() => {
      if (__DEV__) console.warn('[Bloom Today] Daily plan refresh failed');
    });
  }, [saveDailyPlan, state.meals, state.movements, state.todayCheckin, today, todayPlan]);

  const openCheckIn = useCallback(() => {
    logCheckinEvent('button_pressed', {
      hasUser: Boolean(user),
      hasDate: Boolean(today),
      isEditing: Boolean(state.todayCheckin),
      source: 'TodayScreen',
    });
    if (checkinLaunchRef.current) {
      logCheckinEvent('navigation_action', { result: 'duplicate_ignored', source: 'TodayScreen' });
      return;
    }

    checkinLaunchRef.current = true;
    setCheckinOpening(true);
    setCheckinLaunchError('');
    try {
      logCheckinEvent('navigation_action', { result: 'opening', source: 'TodayScreen' });
      navigation.navigate('DailyCheckIn', { date: today });
    } catch (error) {
      checkinLaunchRef.current = false;
      setCheckinOpening(false);
      setCheckinLaunchError('Bloom could not open the check-in. Please try again.');
      logCheckinEvent('caught_error', {
        hasUser: Boolean(user),
        stage: 'navigation',
        source: 'TodayScreen',
      }, error);
    }
  }, [navigation, state.todayCheckin, today, user]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <MotionScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.brandRow}>
            <View style={styles.brandIdentity} accessible accessibilityRole='image' accessibilityLabel='Bloom'>
              <BrandMark size='small' showWordmark={false} decorative />
              <Text style={styles.brandName}>Bloom</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Timeline')}
              accessibilityRole='button'
              accessibilityLabel='Open calendar timeline'
              style={({ pressed, focused }) => [styles.iconButton, focused && styles.focusRing, pressed && styles.pressed]}
            >
              <Icon name='calendar-outline' size={20} color={COLORS.brand} />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <Text style={styles.greeting}>{greeting}</Text>
          </View>

          {state.lastError ? (
            <View style={styles.errorBanner} accessibilityLiveRegion='polite'>
              <Icon name='alert-circle-outline' size={19} color={COLORS.error} />
              <Text style={styles.errorText}>{state.lastError}</Text>
            </View>
          ) : null}

          {state.todayCheckin ? (
            <CheckInSummary checkin={state.todayCheckin} onReview={openCheckIn} />
          ) : (
            <View style={styles.checkinCard}>
              <Text style={styles.checkinPrompt}>How is your body feeling today?</Text>
              <Text style={styles.checkinHint}>A 30-second check-in helps Bloom notice your patterns.</Text>
              <Button
                title='Start 30-sec check-in'
                icon='add-circle'
                onPress={openCheckIn}
                loading={opening}
                loadingLabel='Opening check-in…'
                style={styles.checkinButton}
              />
              {checkinLaunchError ? (
                <Text style={styles.launchError} accessibilityRole='alert' accessibilityLiveRegion='assertive'>{checkinLaunchError}</Text>
              ) : null}
            </View>
          )}

          <Parallax amount={12}>
            <CycleContext state={state} navigation={navigation} />
          </Parallax>

          <ScrollReveal>
            <View style={styles.careCard}>
              <Text style={styles.affirmation}>{affirmation}</Text>
              <View style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <Icon name='sparkles-outline' size={15} color={COLORS.sage} />
                </View>
                <Text style={styles.tipText}>{gentleTip}</Text>
              </View>
            </View>
          </ScrollReveal>

          <ScrollReveal>
            <View style={styles.snapshotSection}>
              <Text style={styles.sectionTitle}>This week's snapshot</Text>
              <WeeklySnapshot state={state} today={today} />
            </View>
          </ScrollReveal>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
    ...Platform.select({ web: { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } }),
  },
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
    ...Platform.select({ web: { overflowY: 'auto', overscrollBehavior: 'contain' } }),
  },
  scrollContent: { flexGrow: 1, paddingBottom: SIZES.xl },
  inner: { width: '100%', maxWidth: LAYOUT.phoneMaxWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.gutter },
  flex: { flex: 1 },

  brandRow: { minHeight: LAYOUT.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -4 },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  brandName: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.brand },
  iconButton: { width: LAYOUT.touchTarget, height: LAYOUT.touchTarget, borderRadius: LAYOUT.touchTarget / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceSoft, ...Platform.select({ web: { cursor: 'pointer', outlineStyle: 'none' } }) },
  focusRing: Platform.select({ web: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: COLORS.brand, outlineOffset: 2 }, default: {} }),
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },

  hero: { alignItems: 'stretch', paddingTop: SIZES.lg, paddingBottom: SIZES.md },
  dateLabel: { ...TYPOGRAPHY.caption, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted },
  greeting: { marginTop: SIZES.xs, ...TYPOGRAPHY.screenTitle, letterSpacing: -0.4, color: COLORS.ink },

  launchError: { marginTop: SIZES.compact, ...TYPOGRAPHY.supporting, color: COLORS.error, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-start', padding: SIZES.compact, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.blush, marginBottom: SIZES.md },
  errorText: { flex: 1, ...TYPOGRAPHY.supporting, color: COLORS.error },

  // Check-in prompt (empty state)
  checkinCard: { padding: SIZES.lg, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.brandSoft },
  checkinPrompt: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  checkinHint: { marginTop: SIZES.xs, ...TYPOGRAPHY.supporting, color: COLORS.body },
  checkinButton: { width: '100%', marginTop: SIZES.md, borderRadius: 999 },

  // Check-in completed summary
  summaryCard: { padding: SIZES.lg, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.sageLight },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  summaryBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  summaryTitle: { flexShrink: 1, ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  summaryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.compact },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: SIZES.compact, borderRadius: 999, backgroundColor: COLORS.canvas },
  summaryChipText: { ...TYPOGRAPHY.caption, fontWeight: '500', color: COLORS.body },
  summaryButton: { width: '100%', marginTop: SIZES.md, borderRadius: LAYOUT.controlRadius },

  // Cycle context
  cycleCard: { marginTop: SIZES.md, paddingHorizontal: SIZES.lg, paddingVertical: SIZES.lg, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surfaceWarm },
  cycleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cycleEyebrow: { ...TYPOGRAPHY.caption, fontWeight: '700', letterSpacing: 1, color: COLORS.muted },
  phaseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.compact, marginTop: SIZES.compact },
  phaseIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  phaseTitle: { flexShrink: 1, ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  dayPill: { paddingVertical: 5, paddingHorizontal: SIZES.compact, borderRadius: 999, backgroundColor: COLORS.brandSoft },
  dayPillText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.brand },
  emptyCycleText: { maxWidth: 420, marginTop: SIZES.compact, ...TYPOGRAPHY.supporting, color: COLORS.body },
  cycleLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SIZES.sm, alignSelf: 'flex-start', borderRadius: 8 },
  cycleLinkText: { ...TYPOGRAPHY.supporting, fontWeight: '700', color: COLORS.brand },
  phaseProgress: { width: '100%', marginTop: SIZES.md },
  phaseTrack: { height: 8, flexDirection: 'row', overflow: 'hidden', borderRadius: 4, backgroundColor: COLORS.surfaceStrong },
  phaseSegment: { flex: 1, borderRightWidth: 1, borderRightColor: COLORS.canvas },
  phaseSegmentPast: { backgroundColor: COLORS.borderStrong },
  phaseSegmentActive: { backgroundColor: COLORS.brand },
  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SIZES.sm },
  phaseLabel: { width: '25%', fontSize: 10, lineHeight: 14, color: COLORS.muted, textAlign: 'center' },
  phaseLabelActive: { color: COLORS.ink, fontWeight: '700' },

  // Affirmation + gentle tip
  careCard: { marginTop: SIZES.md, padding: SIZES.lg, borderRadius: LAYOUT.cardRadius, borderWidth: 1, borderColor: COLORS.hairline, backgroundColor: COLORS.canvas },
  affirmation: { ...TYPOGRAPHY.body, fontStyle: 'italic', color: COLORS.ink },
  tipRow: { flexDirection: 'row', gap: SIZES.compact, marginTop: SIZES.md, paddingTop: SIZES.md, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  tipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.sageLight },
  tipText: { flex: 1, ...TYPOGRAPHY.supporting, color: COLORS.body },

  // Weekly snapshot
  snapshotSection: { marginTop: SIZES.xl },
  sectionTitle: { marginBottom: SIZES.compact, ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.compact },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 104, justifyContent: 'space-between', padding: SIZES.md, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surfaceSoft },
  metricIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  metricValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: COLORS.ink },
  metricSuffix: { ...TYPOGRAPHY.supporting, fontWeight: '400', color: COLORS.muted },
  metricLabel: { marginTop: 3, ...TYPOGRAPHY.caption, fontWeight: '400', color: COLORS.muted },
  sleepCard: { width: '100%', minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.compact, padding: SIZES.md, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surfaceSoft },
  sleepCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SIZES.compact },
  sleepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.sageLight },
  sleepValue: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  sleepBars: { height: 30, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  sleepBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.sage },
});
