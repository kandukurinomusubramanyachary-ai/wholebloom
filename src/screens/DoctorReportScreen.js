import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, subDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { COLORS, ELEVATION, LAYOUT } from '../utils/constants';
import {
  buildDoctorReport,
  doctorReportToText,
  DEFAULT_DOCTOR_REPORT_SETTINGS,
} from '../services/doctorReport';
import { exportService } from '../services/export';
import Button from '../components/Button';
import Card from '../components/Card';
import { MotionScrollView, ScrollReveal } from '../components/Motion';

const RANGE_OPTIONS = [
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'all', label: 'All records' },
];

const INCLUSION_OPTIONS = [
  {
    key: 'includeCycles',
    title: 'Cycles and periods',
    description: 'Start dates, cycle lengths, period duration and variation',
    icon: 'calendar-outline',
  },
  {
    key: 'includeSymptoms',
    title: 'Symptoms',
    description: 'Your most frequently recorded symptoms',
    icon: 'pulse-outline',
  },
  {
    key: 'includeMedicines',
    title: 'Medicines and supplements',
    description: 'Items you recorded as taken',
    icon: 'medkit-outline',
  },
  {
    key: 'includeLifestyle',
    title: 'Lifestyle patterns',
    description: 'Sleep, food and movement summaries',
    icon: 'leaf-outline',
  },
  {
    key: 'includeEmotionalNotes',
    title: 'Emotional notes',
    description: 'Mood counts and private notes are off by default',
    icon: 'heart-outline',
  },
];

function getRangeDates(range) {
  const endDate = format(new Date(), 'yyyy-MM-dd');
  if (range === 'all') return { startDate: null, endDate: null };
  const days = range === '30' ? 30 : 90;
  return {
    startDate: format(subDays(new Date(), days - 1), 'yyyy-MM-dd'),
    endDate,
  };
}

function readableDate(value) {
  if (!value || value === 'All records') return 'All records';
  return format(parseISO(value), 'd MMM yyyy');
}

function readableName(value) {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ToggleRow({ option, value, onChange, last = false }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole='switch'
      accessibilityLabel={option.title}
      accessibilityHint={option.description}
      accessibilityState={{ checked: value }}
      style={({ pressed, hovered, focused }) => [
        styles.toggleRow,
        last && styles.toggleRowLast,
        hovered && styles.toggleRowHovered,
        focused && styles.toggleRowFocused,
        pressed && styles.pressedRow,
      ]}
    >
      <View style={styles.toggleIcon}>
        <Ionicons name={option.icon} size={20} color={COLORS.brand} />
      </View>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{option.title}</Text>
        <Text style={styles.toggleDescription}>{option.description}</Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackActive]}>
        <View style={[styles.switchKnob, value && styles.switchKnobActive]}>
          {value ? <Ionicons name='checkmark' size={12} color={COLORS.brand} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function PreviewSection({ icon, title, children, excluded = false }) {
  return (
    <View style={styles.previewSection}>
      <View style={styles.previewSectionHeading}>
        <View style={styles.previewSectionIcon}>
          <Ionicons name={icon} size={18} color={COLORS.brand} />
        </View>
        <Text style={styles.previewSectionTitle}>{title}</Text>
      </View>
      {excluded ? (
        <Text style={styles.excludedText}>Excluded by your report preferences.</Text>
      ) : children}
    </View>
  );
}

function PreviewRow({ label, value, last = false }) {
  return (
    <View style={[styles.previewRow, last && styles.previewRowLast]}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

function EmptyPreview({ children }) {
  return <Text style={styles.emptyPreview}>{children}</Text>;
}

export default function DoctorReportScreen({ navigation }) {
  const { state, saveDoctorReportSettings } = useApp();
  const savedSettings = state.doctorReportSettings || state.settings?.doctorReport || {};
  const initialSettings = {
    ...DEFAULT_DOCTOR_REPORT_SETTINGS,
    ...savedSettings,
    range: RANGE_OPTIONS.some((option) => option.id === savedSettings.range)
      ? savedSettings.range
      : DEFAULT_DOCTOR_REPORT_SETTINGS.range,
    includeMeg: false,
  };

  const [settings, setSettings] = useState(initialSettings);
  const [busyAction, setBusyAction] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const effectiveSettings = useMemo(() => ({
    ...settings,
    ...getRangeDates(settings.range),
    includeMeg: false,
  }), [settings]);

  const report = useMemo(() => {
    const nextReport = buildDoctorReport(state, effectiveSettings);
    return {
      ...nextReport,
      concerns: effectiveSettings.includeEmotionalNotes ? (nextReport.concerns || []) : [],
      megIncluded: false,
    };
  }, [state, effectiveSettings]);

  const reportText = useMemo(() => doctorReportToText(report), [report]);
  const reportLineCount = reportText.split('\n').filter((line) => line.trim()).length;
  const isBusy = busyAction !== null;

  function updateSetting(key, value) {
    setError('');
    setSuccess('');
    setSettings((current) => ({ ...current, [key]: value, includeMeg: false }));
  }

  async function runAction(action) {
    if (isBusy) return;
    setBusyAction(action);
    setError('');
    setSuccess('');

    try {
      if (typeof saveDoctorReportSettings !== 'function') {
        throw new Error('Doctor report settings are unavailable.');
      }
      await saveDoctorReportSettings(effectiveSettings);

      if (action === 'pdf') {
        await exportService.exportDoctorReportPDF(report);
        setSuccess('PDF summary prepared for export.');
      } else if (action === 'text') {
        await exportService.exportDoctorReportText(report);
        setSuccess('Readable report prepared for export.');
      } else if (action === 'json') {
        await exportService.exportDoctorReportJSON(report);
        setSuccess('Structured report prepared for export.');
      } else {
        setSuccess('Doctor-summary preferences saved on this device.');
      }
    } catch (actionError) {
      setError(
        action === 'save'
          ? 'Bloom could not save these preferences. Please try again.'
          : 'Bloom could not prepare the export. Your records have not been changed.'
      );
    } finally {
      setBusyAction(null);
    }
  }

  const cycleStarts = report.cycles?.starts || [];
  const cycleLengths = report.cycles?.lengths || [];
  const periodDurations = report.cycles?.durations || [];
  const symptoms = report.symptoms || [];
  const moods = report.moods || [];
  const medications = report.medications || [];
  const questions = report.questions || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <MotionScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole='button'
            accessibilityLabel='Go back'
            style={({ pressed, hovered, focused }) => [styles.backButton, hovered && styles.backButtonHovered, focused && styles.backButtonFocused, pressed && styles.pressed]}
          >
            <Ionicons name='chevron-back' size={21} color={COLORS.ink} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.localLabel}>
              <Ionicons name='shield-checkmark-outline' size={15} color={COLORS.sage} />
              <Text style={styles.localLabelText}>Prepared locally on this device</Text>
            </View>
            <Text style={styles.title}>Doctor-ready summary</Text>
            <Text style={styles.subtitle}>
              Choose what to include, review it here, and take a clear record to your appointment.
            </Text>
          </View>

          <Card variant='sage' style={styles.megNotice}>
            <View style={styles.megIcon}>
              <Ionicons name='lock-closed-outline' size={20} color={COLORS.sage} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.megTitle}>Meg conversations stay out</Text>
              <Text style={styles.megText}>
                Private Meg chats are never included in this report or any export.
              </Text>
            </View>
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date range</Text>
            <Text style={styles.sectionDescription}>Select the records that feel relevant.</Text>
            <View style={styles.rangeOptions} accessibilityRole='radiogroup'>
              {RANGE_OPTIONS.map((option) => {
                const selected = settings.range === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => updateSetting('range', option.id)}
                    accessibilityRole='radio'
                    accessibilityLabel={option.label}
                    accessibilityState={{ checked: selected, selected }}
                    style={({ pressed, hovered, focused }) => [
                      styles.rangeOption,
                      selected && styles.rangeOptionSelected,
                      hovered && styles.rangeOptionHovered,
                      focused && styles.focusedControl,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.rangeSummary}>
              <Ionicons name='calendar-clear-outline' size={17} color={COLORS.muted} />
              <Text style={styles.rangeSummaryText}>
                {effectiveSettings.startDate
                  ? `${readableDate(effectiveSettings.startDate)} - ${readableDate(effectiveSettings.endDate)}`
                  : 'All locally stored records'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to include</Text>
            <Text style={styles.sectionDescription}>
              Emotional notes remain private unless you turn them on.
            </Text>
            <View style={styles.toggleGroup}>
              {INCLUSION_OPTIONS.map((option, index) => (
                <ToggleRow
                  key={option.key}
                  option={option}
                  value={Boolean(settings[option.key])}
                  onChange={(value) => updateSetting(option.key, value)}
                  last={index === INCLUSION_OPTIONS.length - 1}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Questions for your appointment</Text>
            <Text style={styles.sectionDescription}>
              Add one question per line. You can leave this blank.
            </Text>
            <TextInput
              style={styles.questionsInput}
              value={settings.questions || ''}
              onChangeText={(value) => updateSetting('questions', value)}
              multiline
              maxLength={1200}
              placeholder={'Example:\nCould my medicines affect my cycle?\nWhich symptoms should I monitor?'}
              placeholderTextColor={COLORS.muted}
              textAlignVertical='top'
              accessibilityLabel='Questions for your doctor, one per line'
            />
            <Text style={styles.characterCount}>{(settings.questions || '').length}/1200</Text>
          </View>

          <Button
            title={busyAction === 'save' ? 'Saving preferences...' : 'Save preferences'}
            icon='save-outline'
            onPress={() => runAction('save')}
            disabled={isBusy}
            style={styles.savePreferences}
          />

          {error ? (
            <View style={styles.errorState} accessibilityRole='alert' accessibilityLiveRegion='assertive'>
              <Ionicons name='alert-circle-outline' size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successState} accessibilityRole='status' accessibilityLiveRegion='polite'>
              <Ionicons name='checkmark-circle-outline' size={20} color={COLORS.sage} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <ScrollReveal>
          <View style={styles.previewHeader}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Report preview</Text>
              <Text style={styles.previewMeta}>
                Prepared locally for {report.profile?.name || 'you'} · {reportLineCount} summary lines
              </Text>
            </View>
            <View style={styles.previewBadge}>
              <Ionicons name='eye-outline' size={15} color={COLORS.brand} />
              <Text style={styles.previewBadgeText}>Preview</Text>
            </View>
          </View>

          <Card style={styles.reportPaper}>
            <View style={styles.reportHeading}>
              <Text style={styles.reportKicker}>Bloom health record</Text>
              <Text style={styles.reportTitle}>Doctor-ready summary</Text>
              <Text style={styles.reportRange}>
                {readableDate(report.range.startDate)} to {readableDate(report.range.endDate)}
              </Text>
            </View>

            <PreviewSection
              icon='calendar-outline'
              title='Cycles and periods'
              excluded={!effectiveSettings.includeCycles}
            >
              {cycleStarts.length ? (
                <>
                  <PreviewRow
                    label='Period starts'
                    value={cycleStarts.map(readableDate).join(', ')}
                  />
                  <PreviewRow
                    label='Cycle lengths'
                    value={cycleLengths.length
                      ? `${cycleLengths.join(', ')} days`
                      : 'Not enough completed cycles'}
                  />
                  <PreviewRow
                    label='Period duration'
                    value={periodDurations.length
                      ? `${periodDurations.join(', ')} days`
                      : 'No completed period durations'}
                  />
                  <PreviewRow
                    label='Variation'
                    value={report.cycles?.variation == null
                      ? 'Not enough data'
                      : `${report.cycles.variation} days`}
                    last
                  />
                </>
              ) : (
                <EmptyPreview>No periods fall within this date range.</EmptyPreview>
              )}
            </PreviewSection>

            <PreviewSection
              icon='pulse-outline'
              title='Frequent symptoms'
              excluded={!effectiveSettings.includeSymptoms}
            >
              {symptoms.length ? (
                <View style={styles.countList}>
                  {symptoms.slice(0, 8).map((item) => (
                    <View key={item.name} style={styles.countChip}>
                      <Text style={styles.countName}>{readableName(item.name)}</Text>
                      <Text style={styles.countValue}>{item.count}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyPreview>No symptom entries fall within this date range.</EmptyPreview>
              )}
            </PreviewSection>

            <PreviewSection
              icon='moon-outline'
              title='Sleep'
              excluded={!effectiveSettings.includeLifestyle}
            >
              {report.sleep?.entries ? (
                <PreviewRow
                  label='Average sleep'
                  value={`${report.sleep.averageHours?.toFixed(1) || 'Not available'} hours across ${report.sleep.entries} ${report.sleep.entries === 1 ? 'entry' : 'entries'}`}
                  last
                />
              ) : (
                <EmptyPreview>No sleep entries fall within this date range.</EmptyPreview>
              )}
            </PreviewSection>

            <PreviewSection
              icon='restaurant-outline'
              title='Food'
              excluded={!effectiveSettings.includeLifestyle}
            >
              {report.meals?.entries ? (
                <>
                  <PreviewRow label='Meals logged' value={String(report.meals.entries)} />
                  <PreviewRow
                    label='Protein included'
                    value={`${report.meals.proteinIncluded} meals`}
                  />
                  <PreviewRow
                    label='Fibre included'
                    value={`${report.meals.fibreIncluded} meals`}
                  />
                  <PreviewRow
                    label='Fruit or vegetables'
                    value={`${report.meals.produceIncluded} meals`}
                    last
                  />
                </>
              ) : (
                <EmptyPreview>No meals fall within this date range.</EmptyPreview>
              )}
            </PreviewSection>

            <PreviewSection
              icon='walk-outline'
              title='Movement'
              excluded={!effectiveSettings.includeLifestyle}
            >
              {report.movement?.entries ? (
                <>
                  <PreviewRow label='Activities logged' value={String(report.movement.entries)} />
                  <PreviewRow label='Completed' value={String(report.movement.completed)} />
                  <PreviewRow label='Partially completed' value={String(report.movement.partial)} last />
                </>
              ) : (
                <EmptyPreview>No movement entries fall within this date range.</EmptyPreview>
              )}
            </PreviewSection>

            <PreviewSection
              icon='medkit-outline'
              title='Medicines and supplements'
              excluded={!effectiveSettings.includeMedicines}
            >
              {medications.length ? (
                <View style={styles.recordList}>
                  {medications.map((item, index) => (
                    <View key={`${item.date}-${item.id || item.name}-${index}`} style={styles.recordItem}>
                      <Text style={styles.recordDate}>{readableDate(item.date)}</Text>
                      <Text style={styles.recordName}>
                        {item.name || item.medicationName || 'Medicine or supplement'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyPreview>No medicines or supplements fall within this date range.</EmptyPreview>
              )}
            </PreviewSection>

            {effectiveSettings.includeEmotionalNotes ? (
              <PreviewSection icon='heart-outline' title='Emotional notes'>
                {moods.length || report.concerns.length ? (
                  <>
                    {moods.length ? (
                      <View style={styles.countList}>
                        {moods.slice(0, 6).map((item) => (
                          <View key={item.name} style={styles.countChip}>
                            <Text style={styles.countName}>{readableName(item.name)}</Text>
                            <Text style={styles.countValue}>{item.count}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {report.concerns.length ? (
                      <View style={styles.concernList}>
                        {report.concerns.map((item, index) => (
                          <Text key={`${item.date}-${index}`} style={styles.concernText}>
                            {readableDate(item.date)} · {item.note}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <EmptyPreview>No emotional notes fall within this date range.</EmptyPreview>
                )}
              </PreviewSection>
            ) : null}

            <PreviewSection icon='help-circle-outline' title='Questions for the appointment'>
              {questions.length ? (
                <View style={styles.questionList}>
                  {questions.map((question, index) => (
                    <View key={`${question}-${index}`} style={styles.questionRow}>
                      <Text style={styles.questionNumber}>{index + 1}</Text>
                      <Text style={styles.questionText}>{question}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyPreview>No appointment questions added yet.</EmptyPreview>
              )}
            </PreviewSection>

            <View style={styles.disclaimer}>
              <Ionicons name='information-circle-outline' size={20} color={COLORS.sage} />
              <Text style={styles.disclaimerText}>{report.disclaimer}</Text>
            </View>
          </Card>
          </ScrollReveal>

          <View style={styles.exportSection}>
            <Text style={styles.sectionTitle}>Export this summary</Text>
            <Text style={styles.sectionDescription}>
              Choose a PDF, a readable text copy, or structured data. Each uses the preview above.
            </Text>
            <Button
              title={busyAction === 'pdf' ? 'Preparing PDF...' : 'Export as PDF'}
              icon='document-outline'
              onPress={() => runAction('pdf')}
              disabled={isBusy}
            />
            <Button
              title={busyAction === 'text' ? 'Preparing readable report...' : 'Export readable report'}
              icon='document-text-outline'
              variant='secondary'
              onPress={() => runAction('text')}
              disabled={isBusy}
              style={styles.secondaryExport}
            />
            <Button
              title={busyAction === 'json' ? 'Preparing structured data...' : 'Export structured data'}
              icon='code-slash-outline'
              variant='secondary'
              onPress={() => runAction('json')}
              disabled={isBusy}
              style={styles.secondaryExport}
            />
            <Text style={styles.exportPrivacy}>
              Meg conversations are excluded from every file. Check where you save or share health information.
            </Text>
          </View>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  content: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  flex: {
    flex: 1,
  },
  backButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: -7,
    paddingHorizontal: 7,
  },
  backText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.ink,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.98 }],
  },
  pressedRow: {
    backgroundColor: COLORS.surfaceSoft,
  },
  header: {
    paddingTop: 14,
    paddingBottom: 24,
  },
  localLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  localLabelText: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: COLORS.sage },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '600',
    letterSpacing: -0.55,
    color: COLORS.ink,
  },
  subtitle: {
    maxWidth: 590,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
  },
  megNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 28,
    borderWidth: 0,
  },
  megIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvas,
  },
  megTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    color: COLORS.ink,
  },
  megText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.body,
  },
  section: {
    marginBottom: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
  },
  rangeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  rangeOption: {
    minHeight: 48,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
  },
  rangeOptionSelected: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
  },
  rangeOptionHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  focusedControl: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  rangeText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.body,
    textAlign: 'center',
  },
  rangeTextSelected: {
    color: COLORS.brand,
  },
  rangeSummary: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  rangeSummaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  toggleGroup: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.cardRadius,
    overflow: 'hidden',
    backgroundColor: COLORS.canvas,
  },
  toggleRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  toggleRowLast: {
    borderBottomWidth: 0,
  },
  toggleRowHovered: { backgroundColor: COLORS.surfaceWarm },
  toggleRowFocused: { backgroundColor: COLORS.brandSoft },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.ink,
  },
  toggleDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  switchTrack: {
    width: 50,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: 14,
    backgroundColor: COLORS.hairline,
  },
  switchTrackActive: {
    backgroundColor: COLORS.brand,
  },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvas,
    transform: [{ translateX: 0 }],
  },
  switchKnobActive: {
    transform: [{ translateX: 22 }],
  },
  questionsInput: {
    minHeight: 144,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  characterCount: {
    marginTop: 5,
    alignSelf: 'flex-end',
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.muted,
  },
  savePreferences: {
    marginTop: -6,
    marginBottom: 12,
  },
  errorState: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8C8C4',
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: '#FFF7F6',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.error,
  },
  successState: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 12,
    padding: 14,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.sageLight,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.body,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  previewMeta: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  previewBadge: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: COLORS.brandSoft,
  },
  previewBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: COLORS.brand,
  },
  reportPaper: {
    padding: 20,
    borderWidth: 0,
    ...Platform.select({ web: ELEVATION.web, ios: ELEVATION.ios, android: ELEVATION.android, default: {} }),
  },
  reportHeading: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  reportKicker: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.brand,
  },
  reportTitle: {
    marginTop: 5,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '600',
    color: COLORS.ink,
  },
  reportRange: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  previewSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  previewSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  previewSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  previewSectionTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
  },
  previewRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  previewRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  previewLabel: {
    flex: 0.4,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  previewValue: {
    flex: 0.6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: COLORS.ink,
    textAlign: 'right',
  },
  excludedText: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  emptyPreview: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  countList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countChip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceSoft,
  },
  countName: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: COLORS.body,
  },
  countValue: {
    minWidth: 20,
    minHeight: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.canvas,
    color: COLORS.brand,
    fontSize: 11,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  recordList: {
    gap: 8,
  },
  recordItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  recordDate: {
    width: 86,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },
  recordName: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.ink,
  },
  concernList: {
    gap: 8,
    marginTop: 12,
  },
  concernText: {
    padding: 11,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceWarm,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.body,
  },
  questionList: {
    gap: 8,
  },
  questionRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  questionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.brandSoft,
    color: COLORS.brand,
    fontSize: 12,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  questionText: {
    flex: 1,
    paddingTop: 2,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.body,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 20,
    padding: 14,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.sageLight,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.body,
  },
  exportSection: {
    marginTop: 28,
  },
  secondaryExport: {
    marginTop: 10,
  },
  exportPrivacy: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
    textAlign: 'center',
  },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  backButtonFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 10 },
});
