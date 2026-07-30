import React, { useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { localDateKey } from '../utils/dateKey';
import { preferredDisplayName } from '../utils/displayName';
import { buildDailyPlan } from '../services/dailyPlan';
import { COLORS, LAYOUT, MOODS, SYMPTOMS } from '../utils/constants';
import BrandMark from '../components/BrandMark';
import Button from '../components/Button';
import Card from '../components/Card';
import { MotionScrollView, Parallax, ScrollReveal } from '../components/Motion';

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function newest(items, dateField = 'date') {
  return [...items].sort((a, b) => String(b[dateField]).localeCompare(String(a[dateField])))[0] || null;
}

function labelFor(items, id) {
  return items.find((item) => item.id === id)?.label || String(id || '').replace(/_/g, ' ');
}

function predictionRangeLabel(prediction) {
  if (!prediction?.nextPeriodStart || !prediction?.nextPeriodEnd) return null;
  const start = parseISO(prediction.nextPeriodStart);
  const end = parseISO(prediction.nextPeriodEnd);
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'd')}–${format(end, 'd MMM')}`
    : `${format(start, 'd MMM')}–${format(end, 'd MMM')}`;
}

function SectionHeading({ title, subtitle, action, onAction }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable
          onPress={onAction}
          accessibilityRole='button'
          style={({ pressed, hovered, focused }) => [
            styles.sectionAction,
            hovered && styles.sectionActionHovered,
            focused && styles.focusRing,
            pressed && styles.inlinePressed,
          ]}
        >
          <Text style={styles.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CycleContext({ state, navigation }) {
  const latestPeriod = newest(state.periods || [], 'startDate');
  if (!latestPeriod) {
    return (
      <Card variant='brandSoft' style={styles.cycleCard}>
        <View style={styles.roundIcon}><Ionicons name='calendar-outline' size={22} color={COLORS.brand} /></View>
        <View style={styles.flex}>
          <Text style={styles.cycleMeta}>Add cycle context</Text>
          <Text style={styles.cycleTitle}>Start with a period date</Text>
          <Text style={styles.cycleBody}>A start date helps Bloom place today in context without judging your pattern.</Text>
          <Pressable onPress={() => navigation.navigate('LogPeriod')} accessibilityRole='button' style={styles.inlineLink}>
            <Text style={styles.inlineLinkText}>Log period dates</Text>
            <Ionicons name='arrow-forward' size={16} color={COLORS.brand} />
          </Pressable>
        </View>
      </Card>
    );
  }

  const currentLength = Math.max(1, differenceInCalendarDays(new Date(), parseISO(latestPeriod.startDate)) + 1);
  const likelyPeriodRange = predictionRangeLabel(state.cyclePrediction);
  let patternMessage = 'Your cycle may vary. Predictions are estimates based on what you have logged.';
  if (state.averageCycleLength && currentLength > state.averageCycleLength + 7) {
    patternMessage = 'Your current cycle is longer than your recent pattern. Variation can happen, including with PCOS.';
  } else if (state.periods.length < 3) {
    patternMessage = 'A few more cycle starts will help Bloom describe your pattern more carefully.';
  }

  return (
    <Card variant='brandSoft' style={styles.cycleCard}>
      <View style={styles.roundIcon}><Ionicons name='leaf-outline' size={22} color={COLORS.brand} /></View>
      <View style={styles.flex}>
        <Text style={styles.cycleMeta}>Cycle day {state.currentCycleDay || currentLength}</Text>
        <Text style={styles.cycleTitle}>
          {state.currentPhase ? `${state.currentPhase.label} estimate` : 'Your current cycle'}
        </Text>
        {likelyPeriodRange ? (
          <View style={styles.predictionSummary} accessibilityRole='summary'>
            <Text style={styles.predictionEyebrow}>Estimated next period</Text>
            <Text style={styles.predictionRange}>Likely {likelyPeriodRange}</Text>
            <Text style={styles.predictionConfidence}>
              {state.cyclePrediction.confidenceLabel} · Based on {state.cyclePrediction.dataPointsUsed} completed {state.cyclePrediction.dataPointsUsed === 1 ? 'cycle' : 'cycles'}
            </Text>
          </View>
        ) : null}
        <View style={styles.cycleFacts}>
          <Text style={styles.cycleFact}>Started {format(parseISO(latestPeriod.startDate), 'd MMM')}</Text>
          <Text style={styles.cycleFact}>{currentLength} {currentLength === 1 ? 'day' : 'days'} so far</Text>
        </View>
        <Text style={styles.cycleBody}>{patternMessage}</Text>
        <Pressable onPress={() => navigation.navigate('Timeline')} accessibilityRole='button' style={styles.inlineLink}>
          <Text style={styles.inlineLinkText}>View Timeline</Text>
          <Ionicons name='arrow-forward' size={16} color={COLORS.brand} />
        </Pressable>
      </View>
    </Card>
  );
}

function CheckInCard({ checkin, navigation, date }) {
  if (!checkin) {
    return <Button title='Start 30-second check-in' icon='add-circle-outline' onPress={() => navigation.navigate('DailyCheckIn', { date })} />;
  }
  const signals = [
    { label: 'Mood', value: checkin.mood ? labelFor(MOODS, checkin.mood) : 'Skipped' },
    { label: 'Energy', value: checkin.energy != null ? `${checkin.energy}/10` : 'Skipped' },
    { label: 'Sleep', value: checkin.sleep != null ? `${checkin.sleep}h` : 'Skipped' },
    { label: 'Flow', value: checkin.flow && checkin.flow !== 'none' ? checkin.flow : 'None' },
  ];
  return (
    <Card style={styles.checkinCard}>
      <View style={styles.summaryGrid}>
        {signals.map((item) => (
          <View key={item.label} style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{item.value}</Text>
          </View>
        ))}
      </View>
      <Button title="Edit today's check-in" variant='secondary' icon='create-outline' onPress={() => navigation.navigate('DailyCheckIn', { date })} style={styles.cardButton} />
    </Card>
  );
}

const PLAN_ICONS = { food: 'restaurant-outline', movement: 'walk-outline', emotional: 'heart-outline' };

function DailyPlan({ plan, onUpdate, navigation, date, showDeepSupport }) {
  if (!plan) return null;
  return (
    <Card style={styles.planCard}>
      {(plan.actions || []).map((item, index) => {
        const done = item.status === 'completed';
        return (
          <View key={item.id} style={[styles.planRow, index === plan.actions.length - 1 && styles.planRowLast]}>
            <View style={[styles.planIcon, done && styles.planIconDone]}>
              <Ionicons name={done ? 'checkmark' : PLAN_ICONS[item.type] || 'leaf-outline'} size={19} color={done ? COLORS.white : COLORS.brand} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.planText, done && styles.planTextDone]}>{item.title}</Text>
              <Pressable
                onPress={() => onUpdate(item.id, done ? 'pending' : 'completed')}
                accessibilityRole='checkbox'
                accessibilityState={{ checked: done }}
                style={styles.planStatus}
              >
                <Text style={styles.planStatusText}>{done ? 'Done for today' : 'Mark as done'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {plan.careNotice ? (
        <View style={styles.careNotice} accessibilityRole='note'>
          <Ionicons name='medical-outline' size={18} color={COLORS.sage} />
          <Text style={styles.careNoticeText}>{plan.careNotice}</Text>
        </View>
      ) : null}
      {showDeepSupport ? (
        <View style={styles.planLinks}>
          <Pressable onPress={() => navigation.navigate('Food', { date })} style={styles.planLink} accessibilityRole='button'><Text style={styles.planLinkText}>Log food</Text></Pressable>
          <Pressable onPress={() => navigation.navigate('Movement', { date })} style={styles.planLink} accessibilityRole='button'><Text style={styles.planLinkText}>Choose movement</Text></Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function QuickLogCard({ icon, title, value, detail, action, onPress, tone = 'brand' }) {
  const color = tone === 'sage' ? COLORS.sage : COLORS.brand;
  const background = tone === 'sage' ? COLORS.sageLight : COLORS.brandSoft;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={`${title}. ${value}. ${action}`}
      style={({ pressed, hovered, focused }) => [
        styles.quickRow,
        hovered && styles.quickRowHovered,
        focused && styles.focusRing,
        pressed && styles.quickRowPressed,
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: background }]}><Ionicons name={icon} size={20} color={color} /></View>
      <View style={styles.flex}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickValue}>{value}</Text>
        {detail ? <Text style={styles.quickDetail}>{detail}</Text> : null}
      </View>
      <View style={styles.quickAction}>
        <Text style={styles.quickActionText}>{action}</Text>
        <Ionicons name='chevron-forward' size={17} color={COLORS.ink} />
      </View>
    </Pressable>
  );
}

function WeeklyProgress({ state, today }) {
  const cutoff = format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const recentCheckins = state.checkins.filter((item) => item.date >= cutoff && item.date <= today);
  const recentMeals = state.meals.filter((item) => item.date >= cutoff && item.date <= today);
  const recentMovements = state.movements.filter((item) => item.date >= cutoff && item.date <= today && item.status !== 'not_today');
  const sleepEntries = recentCheckins.filter((item) => item.sleep != null);
  const averageSleep = sleepEntries.length
    ? sleepEntries.reduce((sum, item) => sum + item.sleep, 0) / sleepEntries.length
    : null;
  const symptomCounts = {};
  recentCheckins.forEach((item) => (item.symptoms || []).forEach((symptom) => {
    symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
  }));
  const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const metrics = [
    ['Check-ins', String(recentCheckins.length)],
    ['Meals logged', String(recentMeals.length)],
    ['Movement days', String(new Set(recentMovements.map((item) => item.date)).size)],
    ['Sleep trend', averageSleep != null ? `${averageSleep.toFixed(1)}h avg` : 'Not enough data'],
    ['Frequent symptom', topSymptom ? labelFor(SYMPTOMS, topSymptom) : 'None noted'],
  ];
  return (
    <View style={styles.progressList}>
      {metrics.map(([label, value], index) => (
        <View key={label} style={[styles.progressRow, index === metrics.length - 1 && styles.progressRowLast]}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={styles.progressValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TodayScreen({ navigation }) {
  const { state, saveDailyPlan, updatePlanAction } = useApp();
  const now = new Date();
  const today = localDateKey(now);
  const todayPlan = state.dailyPlans.find((item) => item.date === today) || null;
  const todayMeals = state.meals.filter((item) => item.date === today);
  const todayMovements = state.movements.filter((item) => item.date === today);
  const latestMeal = newest(todayMeals, 'updatedAt');
  const latestMovement = newest(todayMovements, 'updatedAt');
  const profileName = preferredDisplayName(state.profile);
  const pcosMode = (state.settings?.trackingMode || state.profile?.trackingMode) === 'pcos';
  const greeting = `${greetingForHour(now.getHours())}${profileName ? `, ${profileName}` : ''}`;

  useEffect(() => {
    if (!state.todayCheckin || todayPlan) return;
    const plan = buildDailyPlan({
      date: today,
      checkin: state.todayCheckin,
      meals: state.meals,
      movements: state.movements,
    });
    saveDailyPlan(plan).catch(() => {});
  }, [state.todayCheckin, todayPlan, today]);

  const prompts = useMemo(() => [
    'I need someone to listen',
    'Help me plan the rest of today',
    'My period has not arrived',
  ], []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <MotionScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.brandRow}>
            <BrandMark size='small' showWordmark={false} />
            <Pressable
              onPress={() => navigation.navigate('Profile')}
              accessibilityRole='button'
              accessibilityLabel='Open profile and settings'
              style={({ pressed, hovered, focused }) => [
                styles.iconButton,
                hovered && styles.iconButtonHovered,
                focused && styles.focusRing,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <Ionicons name='person-circle-outline' size={22} color={COLORS.ink} />
            </Pressable>
          </View>

          <Parallax amount={12}>
            <View style={styles.header}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.date}>{format(now, 'EEEE, d MMMM')}</Text>
            </View>

            <CycleContext state={state} navigation={navigation} />
          </Parallax>

          {state.lastError ? (
            <View style={styles.errorBanner} accessibilityLiveRegion='polite'>
              <Ionicons name='alert-circle-outline' size={19} color={COLORS.error} />
              <Text style={styles.errorText}>{state.lastError}</Text>
            </View>
          ) : null}

          <ScrollReveal style={styles.section}>
            <SectionHeading title="Today's check-in" subtitle={state.todayCheckin ? 'Your latest notes are saved to your Bloom account.' : 'Everything is optional. Notice only what feels useful.'} />
            <CheckInCard checkin={state.todayCheckin} navigation={navigation} date={today} />
          </ScrollReveal>

          {state.todayCheckin ? (
            <ScrollReveal style={styles.section}>
              <SectionHeading title='Your plan for today' subtitle='Three small actions shaped by what you logged.' />
              <DailyPlan plan={todayPlan} onUpdate={(id, status) => updatePlanAction(today, id, status)} navigation={navigation} date={today} showDeepSupport={pcosMode} />
            </ScrollReveal>
          ) : null}

          {pcosMode ? <ScrollReveal style={styles.section}>
            <SectionHeading title='Food and movement' subtitle='Simple records, without calories or pressure.' />
            <View style={styles.quickList}>
              <QuickLogCard
                icon='restaurant-outline'
                title='Food'
                value={todayMeals.length ? `${todayMeals.length} ${todayMeals.length === 1 ? 'meal' : 'meals'} logged` : 'Nothing logged yet'}
                detail={latestMeal?.observation || 'Add a familiar meal in a few taps.'}
                action={todayMeals.length ? 'View' : 'Log'}
                onPress={() => navigation.navigate('Food', { date: today })}
              />
              <QuickLogCard
                icon='walk-outline'
                title='Movement and recovery'
                value={latestMovement ? `${latestMovement.activityLabel || latestMovement.activity} · ${String(latestMovement.status).replace('_', ' ')}` : 'Choose what fits today'}
                detail='Rest and partial movement are valid choices.'
                action={latestMovement ? 'Edit' : 'Choose'}
                onPress={() => navigation.navigate('Movement', { date: today })}
                tone='sage'
              />
            </View>
          </ScrollReveal> : null}

          {pcosMode ? <ScrollReveal style={styles.section}>
            <SectionHeading title='Talk to Meg' subtitle='Private, gentle support with one manageable next step.' />
            <Card variant='sage' style={styles.megCard}>
              <View style={styles.megHeader}>
                <View style={styles.megIcon}><Ionicons name='chatbubbles-outline' size={21} color={COLORS.sage} /></View>
                <View style={styles.flex}>
                  <Text style={styles.megTitle}>What would help right now?</Text>
                  <Text style={styles.megBody}>Meg can listen, help you understand a pattern, or make today feel smaller.</Text>
                </View>
              </View>
              <View style={styles.promptRow}>
                {prompts.map((prompt) => (
                  <Pressable key={prompt} onPress={() => navigation.navigate('Meg', { prompt })} accessibilityRole='button' style={styles.promptChip}>
                    <Text style={styles.promptText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
              <Button title='Open Meg' variant='secondary' icon='chatbubble-outline' onPress={() => navigation.navigate('Meg')} style={styles.cardButton} />
            </Card>
          </ScrollReveal> : null}

          <ScrollReveal style={styles.section}>
            <SectionHeading title='This week' subtitle='A quiet summary—no streaks, no judgement.' action='View insights' onAction={() => navigation.navigate('Insights')} />
            <WeeklyProgress state={state} today={today} />
          </ScrollReveal>

          <Text style={styles.closingThought}>Small records can become useful context. You do not need to log perfectly.</Text>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { paddingBottom: 48 },
  inner: { width: '100%', maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding },
  flex: { flex: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginBottom: 28 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
    ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'transform, background-color', transitionDuration: '150ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)', outlineStyle: 'none' } }),
  },
  iconButtonHovered: { backgroundColor: COLORS.brandSoft },
  iconButtonPressed: { transform: [{ scale: 0.96 }] },
  header: { marginBottom: 22 },
  greeting: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5, color: COLORS.ink },
  date: { marginTop: 5, fontSize: 15, lineHeight: 22, color: COLORS.muted },
  errorBanner: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 13, borderRadius: 12, backgroundColor: '#FFF2F0', marginBottom: 16 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.error },
  cycleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 30 },
  roundIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  cycleMeta: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: COLORS.brand, marginBottom: 3 },
  cycleTitle: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: COLORS.ink },
  predictionSummary: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.hairlineSoft },
  predictionEyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.45, textTransform: 'uppercase', color: COLORS.muted },
  predictionRange: { marginTop: 2, fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.brand },
  predictionConfidence: { marginTop: 3, fontSize: 12, lineHeight: 17, color: COLORS.body },
  cycleFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  cycleFact: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: COLORS.white, fontSize: 12, lineHeight: 16, color: COLORS.body },
  cycleBody: { marginTop: 9, fontSize: 14, lineHeight: 20, color: COLORS.body },
  inlineLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  inlineLinkText: { fontSize: 14, fontWeight: '700', color: COLORS.brand },
  section: { marginBottom: 32 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: COLORS.ink },
  sectionSubtitle: { marginTop: 3, fontSize: 14, lineHeight: 20, color: COLORS.muted },
  sectionAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 7, borderRadius: 8, ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'background-color, transform', transitionDuration: '150ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)', outlineStyle: 'none' } }) },
  sectionActionHovered: { backgroundColor: COLORS.brandSoft },
  inlinePressed: { transform: [{ scale: 0.97 }] },
  focusRing: Platform.select({ web: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: COLORS.brand, outlineOffset: 2 }, default: {} }),
  sectionActionText: { fontSize: 13, fontWeight: '700', color: COLORS.brand },
  checkinCard: { padding: 18 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  summaryItem: { width: '50%' },
  summaryLabel: { fontSize: 12, lineHeight: 16, color: COLORS.muted },
  summaryValue: { marginTop: 2, fontSize: 15, lineHeight: 21, fontWeight: '600', color: COLORS.ink, textTransform: 'capitalize' },
  cardButton: { marginTop: 16 },
  planCard: { paddingVertical: 4 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  planRowLast: { borderBottomWidth: 0 },
  planIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  planIconDone: { backgroundColor: COLORS.sage },
  planText: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
  planTextDone: { color: COLORS.muted },
  planStatus: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  planStatusText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: COLORS.sage },
  careNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 12, backgroundColor: COLORS.sageLight, marginTop: 8 },
  careNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.body },
  planLinks: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  planLink: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.surfaceSoft },
  planLinkText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  quickList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  quickRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairline, ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'background-color, transform', transitionDuration: '170ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)', outlineStyle: 'none' } }) },
  quickRowHovered: { backgroundColor: COLORS.surfaceSoft },
  quickRowPressed: { transform: [{ scale: 0.992 }], opacity: 0.78 },
  quickIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: COLORS.ink },
  quickValue: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.body },
  quickDetail: { marginTop: 2, fontSize: 11.5, lineHeight: 16, color: COLORS.muted },
  quickAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 8 },
  quickActionText: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  megCard: { padding: 18 },
  megHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  megIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  megTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  megBody: { marginTop: 3, fontSize: 13, lineHeight: 19, color: COLORS.body },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  promptChip: { minHeight: 44, justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, backgroundColor: COLORS.white },
  promptText: { fontSize: 12, lineHeight: 17, color: COLORS.body },
  progressList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  progressRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  progressRowLast: { borderBottomWidth: 0 },
  progressLabel: { fontSize: 14, color: COLORS.body },
  progressValue: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: COLORS.ink, textAlign: 'right' },
  closingThought: { maxWidth: 520, alignSelf: 'center', paddingVertical: 8, fontSize: 13, lineHeight: 20, color: COLORS.muted, textAlign: 'center' },
});
