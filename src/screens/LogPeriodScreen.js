import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, FLOW_LEVELS, LAYOUT } from '../utils/constants';
import { addDays, format, isBefore, parseISO } from 'date-fns';
import Button from '../components/Button';
import { Entrance } from '../components/Motion';
import { localDateKey } from '../utils/dateKey';

function DateControl({ value, onPrevious, onNext, emptyLabel }) {
  return (
    <View style={styles.dateControl}>
      <Pressable
        onPress={onPrevious}
        accessibilityRole='button'
        accessibilityLabel='Previous day'
        style={({ pressed, hovered, focused }) => [
          styles.dateStepButton,
          hovered && styles.controlHovered,
          focused && styles.controlFocused,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name='remove' size={22} color={COLORS.ink} />
      </Pressable>

      <View style={styles.dateCopy}>
        <Ionicons name='calendar-clear-outline' size={18} color={COLORS.brand} />
        <Text style={styles.dateText}>
          {value ? format(parseISO(value), 'MMM d, yyyy') : emptyLabel}
        </Text>
      </View>

      <Pressable
        onPress={onNext}
        accessibilityRole='button'
        accessibilityLabel='Next day'
        style={({ pressed, hovered, focused }) => [
          styles.dateStepButton,
          hovered && styles.controlHovered,
          focused && styles.controlFocused,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name='add' size={22} color={COLORS.ink} />
      </Pressable>
    </View>
  );
}

export default function LogPeriodScreen({ navigation, route }) {
  const { state, savePeriod, deletePeriod } = useApp();
  const existing = state.periods.find((item) => item.id === route?.params?.periodId || item.startDate === route?.params?.periodId) || null;
  const [startDate, setStartDate] = useState(existing?.startDate || localDateKey());
  const [endDate, setEndDate] = useState(existing?.endDate || null);
  const [flow, setFlow] = useState(existing?.flow || 'medium');
  const [isOngoing, setIsOngoing] = useState(existing ? !existing.endDate : true);
  const [hasChangedOngoing, setHasChangedOngoing] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [formError, setFormError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasValidEndDate = isOngoing || Boolean(
    endDate && !isBefore(parseISO(endDate), parseISO(startDate))
  );

  async function handleSave() {
    if (submittingAction || !hasValidEndDate) return;
    setSubmittingAction('save');
    setFormError('');
    let saved = false;
    try {
      await savePeriod({
        ...(existing || {}),
        id: existing?.id,
        startDate,
        endDate: isOngoing ? null : endDate,
        flow,
      });
      saved = true;
    } catch (error) {
      const message = {
        'period-date-conflict': 'A period is already logged for this start date. Choose another date.',
        'period-overlap': 'These dates overlap another logged period. Adjust the start or end date.',
        'period-invalid-start': 'Choose a valid period start date.',
        'period-invalid-end': 'Choose a valid period end date.',
        'period-invalid-range': 'End date cannot be before the start date.',
      }[error?.code];
      setFormError(message || 'Bloom could not save this period. Check your connection and try again.');
    } finally {
      setSubmittingAction(null);
    }
    if (saved) navigation.goBack();
  }

  async function handleDelete() {
    if (!existing || submittingAction) return;
    if (!confirmingDelete) return;
    setSubmittingAction('delete');
    setFormError('');
    let deleted = false;
    try {
      await deletePeriod(existing.id || existing.startDate);
      deleted = true;
    } catch (error) {
      setFormError('Bloom could not delete this period. Check your connection and try again.');
    } finally {
      setSubmittingAction(null);
    }
    if (deleted) navigation.goBack();
  }

  function adjustDate(dateStr, days) {
    return localDateKey(addDays(parseISO(dateStr), days));
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
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

            <Text style={styles.title}>{existing ? 'Edit period' : 'Log period'}</Text>
            <Text style={styles.subtitle}>
              Add what you know today. You can leave the end date open while your period is
              ongoing.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start date</Text>
            <Text style={styles.helperText}>The first day of this period.</Text>
            <DateControl
              value={startDate}
              onPrevious={() => setStartDate(adjustDate(startDate, -1))}
              onNext={() => setStartDate(adjustDate(startDate, 1))}
            />
          </View>

          <View style={styles.section}>
            <Pressable
              onPress={() => {
                setHasChangedOngoing(true);
                setIsOngoing((current) => {
                  const nextValue = !current;
                  if (!nextValue && !endDate) setEndDate(startDate);
                  return nextValue;
                });
              }}
              accessibilityRole='switch'
              accessibilityLabel='Period is ongoing'
              accessibilityState={{ checked: isOngoing }}
              style={({ pressed, hovered, focused }) => [
                styles.ongoingRow,
                hovered && styles.rowHovered,
                focused && styles.rowFocused,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.ongoingCopy}>
                <Text style={styles.sectionTitle}>Period is ongoing</Text>
                <Text style={styles.helperText}>
                  Turn this off when you are ready to add an end date.
                </Text>
              </View>
              <View style={[styles.toggleTrack, isOngoing && styles.toggleTrackActive]}>
                <View style={[styles.toggleKnob, isOngoing && styles.toggleKnobActive]}>
                  {isOngoing ? <Ionicons name='checkmark' size={13} color={COLORS.brand} /> : null}
                </View>
              </View>
            </Pressable>

            {!isOngoing ? (
              <Entrance
                style={styles.endDate}
                duration={220}
                distance={8}
                disabled={!hasChangedOngoing}
              >
                <Text style={styles.sectionTitle}>End date</Text>
                <Text style={styles.helperText}>The final day of this period, if you know it.</Text>
                <DateControl
                  value={endDate}
                  emptyLabel='Select date'
                  onPrevious={() => setEndDate(adjustDate(endDate || startDate, -1))}
                  onNext={() => setEndDate(adjustDate(endDate || startDate, 1))}
                />
                {!hasValidEndDate ? (
                  <Entrance duration={180} distance={4}>
                    <Text style={styles.rangeError} accessibilityRole='alert'>End date cannot be before the start date.</Text>
                  </Entrance>
                ) : null}
              </Entrance>
            ) : null}
          </View>

          <View style={[styles.section, styles.flowSection]}>
            <Text style={styles.sectionTitle}>Flow intensity</Text>
            <Text style={styles.helperText}>Choose the option that feels closest.</Text>
            <View style={styles.flowGrid} accessibilityRole='radiogroup'>
              {FLOW_LEVELS.map(flowLevel => {
                const selected = flow === flowLevel.id;
                return (
                  <Pressable
                    key={flowLevel.id}
                    onPress={() => setFlow(flowLevel.id)}
                    accessibilityRole='radio'
                    accessibilityLabel={`${flowLevel.label} flow`}
                    accessibilityState={{ selected, checked: selected }}
                    style={({ pressed, hovered, focused }) => [
                      styles.flowOption,
                      selected && styles.flowOptionSelected,
                      hovered && !selected && styles.controlHovered,
                      focused && styles.controlFocused,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.flowIcon, selected && styles.flowIconSelected]}>
                      <Ionicons
                        name={flowLevel.icon}
                        size={19}
                        color={selected ? COLORS.brand : COLORS.muted}
                      />
                    </View>
                    <Text style={[styles.flowLabel, selected && styles.flowLabelSelected]}>
                      {flowLevel.label}
                    </Text>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={selected ? COLORS.brand : COLORS.hairline}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            {formError ? <Text style={styles.rangeError} accessibilityRole='alert'>{formError}</Text> : null}
            <Button
              title={existing ? 'Save period changes' : 'Save period'}
              icon='checkmark-circle-outline'
              onPress={handleSave}
              loading={submittingAction === 'save'}
              disabled={!hasValidEndDate || Boolean(submittingAction)}
            />
            {existing && !confirmingDelete ? (
              <Button
                title='Delete this period'
                variant='danger'
                icon='trash-outline'
                onPress={() => {
                  setFormError('');
                  setConfirmingDelete(true);
                }}
                disabled={Boolean(submittingAction)}
                style={styles.cancelButton}
              />
            ) : null}
            {existing && confirmingDelete ? (
              <View style={styles.deleteConfirmation} accessibilityRole='alert'>
                <Text style={styles.deleteConfirmationTitle}>Delete this period?</Text>
                <Text style={styles.deleteConfirmationBody}>
                  This removes the period dates. Daily check-ins and symptoms stay in your timeline.
                </Text>
                <Button
                  title='Yes, delete period'
                  variant='danger'
                  icon='trash-outline'
                  onPress={handleDelete}
                  loading={submittingAction === 'delete'}
                  disabled={Boolean(submittingAction)}
                  style={styles.deleteConfirmationAction}
                />
                <Button
                  title='Keep period'
                  variant='secondary'
                  onPress={() => setConfirmingDelete(false)}
                  disabled={Boolean(submittingAction)}
                  style={styles.cancelButton}
                />
              </View>
            ) : null}
            <Button
              title='Cancel'
              variant='secondary'
              onPress={() => navigation.goBack()}
              disabled={Boolean(submittingAction)}
              style={styles.cancelButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  rowPressed: { opacity: 0.78 },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft },
  backButtonFocused: { backgroundColor: COLORS.brandSoft },
  controlHovered: { borderColor: '#D2D2CE', backgroundColor: COLORS.surfaceSoft },
  controlFocused: { borderColor: COLORS.brand },
  rowHovered: { backgroundColor: COLORS.surfaceSoft },
  rowFocused: { backgroundColor: COLORS.brandSoft },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.35,
    color: COLORS.ink,
  },
  subtitle: { maxWidth: 560, marginTop: 8, fontSize: 15, lineHeight: 22, color: COLORS.body },
  section: { paddingVertical: 24, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: COLORS.ink },
  helperText: { marginTop: 3, fontSize: 14, lineHeight: 20, color: COLORS.body },
  dateControl: {
    minHeight: 64,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dateStepButton: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: LAYOUT.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.canvas,
  },
  dateCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: COLORS.ink, textAlign: 'center' },
  rangeError: { marginTop: 9, fontSize: 13, lineHeight: 18, color: COLORS.error },
  ongoingRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: LAYOUT.controlRadius,
  },
  ongoingCopy: { flex: 1 },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
    backgroundColor: COLORS.hairline,
  },
  toggleTrackActive: { backgroundColor: COLORS.brand },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvas,
    transform: [{ translateX: 0 }],
  },
  toggleKnobActive: { transform: [{ translateX: 22 }] },
  endDate: { marginTop: 22, paddingTop: 22, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  flowSection: { paddingBottom: 28 },
  flowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  flowOption: {
    minWidth: 112,
    minHeight: 52,
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: LAYOUT.controlRadius,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.canvas,
  },
  flowOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  flowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  flowIconSelected: { backgroundColor: COLORS.canvas },
  flowLabel: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500', color: COLORS.body },
  flowLabelSelected: { color: COLORS.brand, fontWeight: '600' },
  footer: { paddingTop: 8 },
  cancelButton: { marginTop: 10 },
  deleteConfirmation: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  deleteConfirmationTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  deleteConfirmationBody: { marginTop: 4, fontSize: 14, lineHeight: 20, color: COLORS.body },
  deleteConfirmationAction: { marginTop: 14 },
});
