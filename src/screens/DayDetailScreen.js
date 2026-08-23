import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, createThemedStyles, LAYOUT, MOODS, FLOW_LEVELS, SYMPTOMS } from '../utils/constants';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { getCycleDay } from '../utils/helpers';
import Button from '../components/Button';
import { Entrance } from '../components/Motion';
import { periodRange } from '../services/periodValidation';

export default function DayDetailScreen({ route, navigation }) {
  const { date } = route.params;
  const { state, deleteCheckin } = useApp();
  const [deleteNotice, setDeleteNotice] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingCheckin, setDeletingCheckin] = useState(false);
  const checkin = state.checkins.find(c => c.date === date);
  const meals = (state.meals || []).filter(item => item.date === date);
  const movements = (state.movements || []).filter(item => item.date === date);
  const medications = (state.medications || []).filter(item => item.date === date);
  const selectedDate = parseISO(date);
  const period = [...state.periods]
    .sort((first, second) => String(second?.startDate || '').localeCompare(String(first?.startDate || '')))
    .find((item) => {
      const range = periodRange(item);
      if (!range) return false;
      const daysAgo = differenceInCalendarDays(new Date(), range.start);
      const end = item.endDate
        ? range.end
        : (daysAgo >= 0 && daysAgo <= 10 ? new Date() : range.start);
      return selectedDate >= range.start && selectedDate <= end;
    });

  const dateObj = parseISO(date);
  const dayName = format(dateObj, 'EEEE');
  const calendarDate = format(dateObj, 'MMMM d, yyyy');
  const moodData = MOODS.find(m => m.id === checkin?.mood);
  const flowData = FLOW_LEVELS.find(f => f.id === checkin?.flow);
  const symptomData = (checkin?.symptoms || [])
    .map(symptomId => SYMPTOMS.find(symptom => symptom.id === symptomId))
    .filter(Boolean);
  const priorPeriod = [...state.periods]
    .filter(item => item.startDate <= date)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const cycleDay = priorPeriod ? getCycleDay(priorPeriod.startDate, dateObj) : null;
  const hasAnyRecord = checkin || period || meals.length || movements.length || medications.length;

  async function handleDeleteCheckin() {
    if (!checkin || deletingCheckin) return;
    setDeletingCheckin(true);
    setDeleteError('');
    setDeleteNotice('');
    try {
      await deleteCheckin(date);
      setDeleteNotice('Check-in deleted. Any other logs for this day are still here.');
    } catch (error) {
      setDeleteError('Bloom could not delete this check-in. Please try again.');
    } finally {
      setDeletingCheckin(false);
    }
  }

  function formatMetric(value, suffix = '') {
    return value === undefined || value === null || value === ''
      ? 'Not logged'
      : `${value}${suffix}`;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole='button'
              accessibilityLabel='Go back'
              style={({ pressed, hovered, focused }) => [
                styles.backButton,
                hovered && styles.backButtonHovered,
                focused && styles.backButtonFocused,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name='chevron-back' size={22} color={COLORS.ink} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
            <Text style={styles.dayName}>{dayName}</Text>
            <Text style={styles.calendarDate}>{calendarDate}</Text>
            {cycleDay ? <Text style={styles.cycleDay}>Cycle day {cycleDay}</Text> : null}
            <View style={styles.dayActions}>
              <Button
                title={checkin ? 'Edit day' : 'Add check-in'}
                icon='create-outline'
                onPress={() => navigation.navigate('DailyCheckIn', { date })}
                style={styles.dayAction}
              />
              <Button
                title='Log food'
                variant='secondary'
                icon='restaurant-outline'
                onPress={() => navigation.navigate('Food', { date })}
                style={styles.dayAction}
              />
            </View>
          </View>

          {deleteNotice ? (
            <Entrance duration={180} distance={6}>
              <View
                style={styles.feedback}
                accessibilityRole='status'
                accessibilityLiveRegion='polite'
              >
                <Ionicons name='checkmark-circle-outline' size={20} color={COLORS.sage} />
                <Text style={styles.feedbackText}>{deleteNotice}</Text>
              </View>
            </Entrance>
          ) : null}

          {deleteError ? (
            <View style={styles.deleteError} accessibilityRole='alert'>
              <Ionicons name='alert-circle-outline' size={20} color={COLORS.error} />
              <Text style={styles.deleteErrorText}>{deleteError}</Text>
            </View>
          ) : null}

          {!hasAnyRecord ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name='calendar-clear-outline' size={28} color={COLORS.brand} />
              </View>
              <Text style={styles.emptyTitle}>Nothing logged this day</Text>
              <Text style={styles.emptyBody}>
                Your timeline stays open and pressure-free. Bloom is here whenever you want to
                check in.
              </Text>
            </View>
          ) : null}

          {period ? (
            <View style={styles.periodSummary}>
              <View style={styles.sectionHeading}>
                <View style={[styles.headingIcon, styles.periodIcon]}>
                  <Ionicons name='water-outline' size={19} color={COLORS.brand} />
                </View>
                <View style={styles.headingCopy}>
                  <Text style={styles.sectionTitle}>Period logged</Text>
                  <Text style={styles.sectionDescription}>This date is part of your recorded cycle.</Text>
                </View>
              </View>
              {period.flow ? (
                <View style={styles.inlineDetail}>
                  <Text style={styles.inlineLabel}>Flow</Text>
                  <Text style={styles.inlineValue}>{period.flow}</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => navigation.navigate('LogPeriod', { periodId: period.id || period.startDate })}
                accessibilityRole='button'
                style={({ pressed, hovered, focused }) => [
                  styles.periodEdit,
                  hovered && styles.inlineActionHovered,
                  focused && styles.inlineActionFocused,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name='create-outline' size={17} color={COLORS.brand} />
                <Text style={styles.periodEditText}>Edit period dates</Text>
              </Pressable>
            </View>
          ) : null}

          {checkin ? (
            <View style={styles.checkin}>
              <Text style={styles.checkinTitle}>Daily check-in</Text>

              <View style={styles.detailSection}>
                <View style={styles.sectionHeading}>
                  <View style={styles.headingIcon}>
                    <Ionicons
                      name={moodData?.icon || 'help-circle-outline'}
                      size={19}
                      color={COLORS.brand}
                    />
                  </View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>Mood</Text>
                    <Text style={styles.primaryValue}>
                      {moodData?.label || checkin.mood || 'Not logged'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Body basics</Text>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Ionicons name='battery-half-outline' size={19} color={COLORS.sage} />
                    <Text style={styles.statValue}>{formatMetric(checkin.energy)}</Text>
                    <Text style={styles.statLabel}>Energy</Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name='moon-outline' size={19} color={COLORS.sage} />
                    <Text style={styles.statValue}>{formatMetric(checkin.sleep, ' h')}</Text>
                    <Text style={styles.statLabel}>Sleep</Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name='pulse-outline' size={19} color={COLORS.sage} />
                    <Text style={styles.statValue}>{formatMetric(checkin.pain)}</Text>
                    <Text style={styles.statLabel}>Pain</Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <View style={styles.sectionHeading}>
                  <View style={styles.headingIcon}>
                    <Ionicons
                      name={flowData?.icon || 'water-outline'}
                      size={19}
                      color={COLORS.brand}
                    />
                  </View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>Flow</Text>
                    <Text style={styles.primaryValue}>
                      {flowData?.label || checkin.flow || 'Not logged'}
                    </Text>
                  </View>
                </View>
              </View>

              {symptomData.length > 0 ? (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Symptoms</Text>
                  <View style={styles.symptomsRow}>
                    {symptomData.map(symptom => (
                      <View key={symptom.id} style={styles.symptomChip}>
                        <Ionicons name={symptom.icon} size={16} color={COLORS.brand} />
                        <Text style={styles.symptomLabel}>{symptom.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {checkin.notes ? (
                <View style={[styles.detailSection, styles.notesSection]}>
                  <View style={styles.sectionHeading}>
                    <View style={styles.headingIcon}>
                      <Ionicons name='document-text-outline' size={19} color={COLORS.brand} />
                    </View>
                    <View style={styles.headingCopy}>
                      <Text style={styles.sectionTitle}>Notes</Text>
                      <Text style={styles.notesText}>{checkin.notes}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {checkin.medicationTaken || checkin.medicationName ? (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Medication or supplement</Text>
                  <Text style={styles.primaryValue}>{checkin.medicationName || 'Marked as taken'}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleDeleteCheckin}
                disabled={deletingCheckin}
                accessibilityRole='button'
                accessibilityLabel='Delete this check-in'
                accessibilityState={{ disabled: deletingCheckin, busy: deletingCheckin }}
                style={({ pressed, hovered, focused }) => [
                  styles.deleteEntry,
                  hovered && styles.deleteEntryHovered,
                  focused && styles.deleteEntryFocused,
                  pressed && styles.pressed,
                  deletingCheckin && styles.deleteEntryDisabled,
                ]}
              >
                <Ionicons name='trash-outline' size={18} color={COLORS.error} />
                <Text style={styles.deleteEntryText}>{deletingCheckin ? 'Deleting check-inâ€¦' : 'Delete this check-in'}</Text>
              </Pressable>
            </View>
          ) : null}

          {meals.length ? (
            <View style={styles.recordSection}>
              <View style={styles.recordHeader}>
                <Text style={styles.checkinTitle}>Meals</Text>
                <Pressable
                  onPress={() => navigation.navigate('Food', { date })}
                  accessibilityRole='button'
                  accessibilityLabel='Edit meals'
                  style={({ pressed, hovered, focused }) => [
                    styles.smallAction,
                    hovered && styles.inlineActionHovered,
                    focused && styles.inlineActionFocused,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.smallActionText}>Edit</Text>
                </Pressable>
              </View>
              {meals.map(item => (
                <View key={item.id} style={styles.recordRow}>
                  <View style={styles.headingIcon}><Ionicons name='restaurant-outline' size={19} color={COLORS.brand} /></View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>{item.name || 'Meal'}</Text>
                    <Text style={styles.primaryValue}>{[item.protein && 'protein', item.fibre && 'fibre', item.produce && 'fruit or vegetables'].filter(Boolean).join(' · ') || 'No meal details added'}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {movements.length ? (
            <View style={styles.recordSection}>
              <View style={styles.recordHeader}>
                <Text style={styles.checkinTitle}>Movement and recovery</Text>
                <Pressable
                  onPress={() => navigation.navigate('Movement', { date })}
                  accessibilityRole='button'
                  accessibilityLabel='Edit movement and recovery'
                  style={({ pressed, hovered, focused }) => [
                    styles.smallAction,
                    hovered && styles.inlineActionHovered,
                    focused && styles.inlineActionFocused,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.smallActionText}>Edit</Text>
                </Pressable>
              </View>
              {movements.map(item => (
                <View key={item.id} style={styles.recordRow}>
                  <View style={styles.headingIcon}><Ionicons name='walk-outline' size={19} color={COLORS.sage} /></View>
                  <View style={styles.headingCopy}>
                    <Text style={styles.sectionTitle}>{item.activityLabel || item.activity || 'Movement'}</Text>
                    <Text style={styles.primaryValue}>{String(item.status || '').replace('_', ' ')}{item.duration ? ` · ${item.duration} min` : ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {medications.length ? (
            <View style={styles.recordSection}>
              <Text style={styles.checkinTitle}>Medicines and supplements</Text>
              {medications.map(item => <Text key={item.id} style={styles.medicationLine}>{item.name || 'Medication'} · {item.taken === false ? 'not taken' : 'taken'}</Text>)}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  inner: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  header: { paddingTop: 8, paddingBottom: 28 },
  backButton: {
    minHeight: LAYOUT.touchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingRight: 12,
    marginLeft: -8,
    marginBottom: 16,
    borderRadius: 999,
  },
  backLabel: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft },
  backButtonFocused: { backgroundColor: COLORS.brandSoft },
  dayName: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.35,
  },
  calendarDate: { marginTop: 4, fontSize: 15, lineHeight: 22, color: COLORS.body },
  cycleDay: { marginTop: 6, fontSize: 13, lineHeight: 18, fontWeight: '700', color: COLORS.brand },
  dayActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  dayAction: { flex: 1, paddingHorizontal: 10 },
  feedback: {
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderColor: '#D6E0D2',
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.sageLight,
  },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.body },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: { maxWidth: 390, fontSize: 15, lineHeight: 22, color: COLORS.body, textAlign: 'center' },
  periodSummary: {
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.brandSoft,
    padding: 20,
    marginBottom: 28,
  },
  periodIcon: { backgroundColor: COLORS.canvas },
  checkin: { borderTopWidth: 1, borderTopColor: COLORS.hairline },
  checkinTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
    paddingTop: 24,
    paddingBottom: 4,
  },
  detailSection: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  headingCopy: { flex: 1, minHeight: 40, justifyContent: 'center' },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: COLORS.ink },
  sectionDescription: { marginTop: 2, fontSize: 14, lineHeight: 20, color: COLORS.body },
  primaryValue: { marginTop: 2, fontSize: 15, lineHeight: 22, color: COLORS.body },
  inlineDetail: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168, 79, 55, 0.18)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineLabel: { fontSize: 14, color: COLORS.body },
  inlineValue: { fontSize: 14, fontWeight: '600', color: COLORS.brand, textTransform: 'capitalize' },
  periodEdit: { minHeight: 44, marginTop: 8, marginLeft: -8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderRadius: 999 },
  periodEditText: { fontSize: 13, fontWeight: '700', color: COLORS.brand },
  inlineActionHovered: { backgroundColor: COLORS.surfaceSoft },
  inlineActionFocused: { backgroundColor: COLORS.brandSoft },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: {
    flex: 1,
    minHeight: 102,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  statValue: {
    marginTop: 7,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: COLORS.ink,
    textAlign: 'center',
  },
  statLabel: { marginTop: 3, fontSize: 12, lineHeight: 16, color: COLORS.muted },
  symptomsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  symptomChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  symptomLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: COLORS.body },
  notesSection: { borderBottomWidth: 0 },
  notesText: { marginTop: 5, fontSize: 15, lineHeight: 23, color: COLORS.body },
  deleteEntry: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderRadius: LAYOUT.controlRadius },
  deleteEntryText: { fontSize: 14, fontWeight: '600', color: COLORS.error },
  deleteEntryHovered: { backgroundColor: '#FFF7F6' },
  deleteEntryFocused: { backgroundColor: '#FCEBE8' },
  deleteEntryDisabled: { opacity: 0.5 },
  deleteError: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, padding: 12, borderRadius: LAYOUT.controlRadius, backgroundColor: '#FFF7F6' },
  deleteErrorText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.error },
  recordSection: { paddingTop: 24, marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  recordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  smallAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  smallActionText: { fontSize: 13, fontWeight: '700', color: COLORS.brand },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  medicationLine: { paddingVertical: 12, fontSize: 14, lineHeight: 20, color: COLORS.body, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
});
