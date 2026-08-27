import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { isValid, parseISO, subDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { logCheckinEvent } from '../diagnostics/checkinDiagnostics';
import { localDateKey } from '../utils/dateKey';
import { preferredDisplayName } from '../utils/displayName';
import { buildDailyPlan } from '../services/dailyPlan';
import { COLORS, createThemedStyles, LAYOUT } from '../utils/constants';
import BrandMark from '../components/BrandMark';
import Button from '../components/Button';
import { MotionScrollView, Parallax } from '../components/Motion';

const PHASES = ['Menstruation', 'Follicular', 'Ovulation', 'Luteal'];

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
          <Ionicons name='water-outline' size={22} color={COLORS.brand} />
          <Text style={styles.phaseTitle}>Cycle context is ready when you are</Text>
        </View>
        <Text style={styles.emptyCycleText}>Log a period start date to see your current cycle day and phase estimate.</Text>
        <Pressable
          onPress={() => navigation.navigate('LogPeriod')}
          accessibilityRole='button'
          style={({ pressed, focused }) => [styles.cycleLink, focused && styles.focusRing, pressed && styles.pressed]}
        >
          <Text style={styles.cycleLinkText}>Log period dates</Text>
          <Ionicons name='arrow-forward' size={16} color={COLORS.brand} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cycleCard}>
      <Text style={styles.cycleEyebrow}>CURRENT PHASE</Text>
      <View style={styles.phaseTitleRow}>
        <Ionicons name='water' size={22} color={COLORS.brand} />
        <Text style={styles.phaseTitle}>{phaseLabel || 'Pattern still forming'}</Text>
      </View>
      <View style={styles.dayPill}>
        <Text style={styles.dayPillText}>Day {cycleDay} of your cycle</Text>
      </View>
      <View style={styles.phaseProgress}>
        <View style={styles.phaseLabels}>
          {PHASES.map((phase, index) => (
            <Text key={phase} numberOfLines={1} style={[styles.phaseLabel, index === activePhase && styles.phaseLabelActive]}>{phase}</Text>
          ))}
        </View>
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
      </View>
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
        <Ionicons name='checkbox-outline' size={22} color={COLORS.brand} />
        <View>
          <Text style={styles.metricValue}>{recentCheckins.length} <Text style={styles.metricSuffix}>/ 7</Text></Text>
          <Text style={styles.metricLabel}>Check-ins completed</Text>
        </View>
      </View>
      <View style={styles.metricCard}>
        <Ionicons name='fitness-outline' size={22} color={COLORS.brand} />
        <View>
          <Text style={styles.metricValue}>{recentMovements.length} <Text style={styles.metricSuffix}>{recentMovements.length === 1 ? 'session' : 'sessions'}</Text></Text>
          <Text style={styles.metricLabel}>Strength &amp; movement</Text>
        </View>
      </View>
      <View style={styles.sleepCard}>
        <View style={styles.sleepCopy}>
          <View style={styles.sleepIcon}>
            <Ionicons name='moon' size={20} color={COLORS.sage} />
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

  const checkinLabel = useMemo(
    () => state.todayCheckin ? "Review today's check-in" : 'Start 30-sec check-in',
    [state.todayCheckin]
  );

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
              <Ionicons name='calendar-outline' size={20} color={COLORS.brand} />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Button
              title={checkinLabel}
              icon={state.todayCheckin ? 'checkmark-circle' : 'add-circle'}
              onPress={openCheckIn}
              loading={opening}
              loadingLabel='Opening check-in…'
              style={styles.checkinButton}
            />
            {checkinLaunchError ? (
              <Text style={styles.launchError} accessibilityRole='alert' accessibilityLiveRegion='assertive'>{checkinLaunchError}</Text>
            ) : null}
          </View>

          {state.lastError ? (
            <View style={styles.errorBanner} accessibilityLiveRegion='polite'>
              <Ionicons name='alert-circle-outline' size={19} color={COLORS.error} />
              <Text style={styles.errorText}>{state.lastError}</Text>
            </View>
          ) : null}

          <Parallax amount={12}>
            <CycleContext state={state} navigation={navigation} />
          </Parallax>

          <View style={styles.snapshotSection}>
            <Text style={styles.sectionTitle}>This Week's Snapshot</Text>
            <WeeklySnapshot state={state} today={today} />
          </View>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.surfaceWarm,
    ...Platform.select({ web: { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } }),
  },
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.surfaceWarm,
    ...Platform.select({ web: { overflowY: 'auto', overscrollBehavior: 'contain' } }),
  },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  inner: { width: '100%', maxWidth: LAYOUT.phoneMaxWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.compactScreenPadding },
  flex: { flex: 1 },
  brandRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -4, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.brand },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...Platform.select({ web: { cursor: 'pointer', outlineStyle: 'none' } }) },
  focusRing: Platform.select({ web: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: COLORS.brand, outlineOffset: 2 }, default: {} }),
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  hero: { alignItems: 'stretch', paddingTop: 24, paddingBottom: 18 },
  greeting: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.35, color: COLORS.ink },
  checkinButton: { width: '100%', marginTop: 10, borderRadius: 999 },
  launchError: { marginTop: 10, fontSize: 13, lineHeight: 19, color: COLORS.error, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 13, borderRadius: 12, backgroundColor: '#FFF2F0', marginBottom: 16 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.error },
  cycleCard: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.hairline, backgroundColor: COLORS.surfaceSoft },
  cycleEyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1, color: COLORS.muted },
  phaseTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  phaseTitle: { flexShrink: 1, fontSize: 20, lineHeight: 26, fontWeight: '700', color: COLORS.ink, textAlign: 'center' },
  dayPill: { marginTop: 7, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: COLORS.brandSoft },
  dayPillText: { fontSize: 13, lineHeight: 18, color: COLORS.body },
  emptyCycleText: { maxWidth: 420, marginTop: 10, fontSize: 14, lineHeight: 20, color: COLORS.body, textAlign: 'center' },
  cycleLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingHorizontal: 8, borderRadius: 8 },
  cycleLinkText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: COLORS.brand },
  phaseProgress: { width: '100%', marginTop: 14 },
  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  phaseLabel: { width: '25%', fontSize: 10, lineHeight: 14, color: COLORS.muted, textAlign: 'center' },
  phaseLabelActive: { color: COLORS.ink, fontWeight: '700' },
  phaseTrack: { height: 8, flexDirection: 'row', overflow: 'hidden', borderRadius: 4, backgroundColor: COLORS.surfaceStrong },
  phaseSegment: { flex: 1, borderRightWidth: 1, borderRightColor: COLORS.canvas },
  phaseSegmentPast: { backgroundColor: COLORS.borderStrong },
  phaseSegmentActive: { backgroundColor: COLORS.brand },
  snapshotSection: { marginTop: 16 },
  sectionTitle: { marginBottom: 10, fontSize: 14, lineHeight: 20, fontWeight: '700', color: COLORS.ink },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 96, justifyContent: 'space-between', padding: 12, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.hairline },
  metricValue: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: COLORS.ink },
  metricSuffix: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: COLORS.muted },
  metricLabel: { marginTop: 3, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  sleepCard: { width: '100%', minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.hairline },
  sleepCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sleepIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.sageLight },
  sleepValue: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  sleepBars: { height: 30, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  sleepBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.sage },
});
