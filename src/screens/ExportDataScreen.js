import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { useApp } from '../context/AppContext';
import { COLORS, createThemedStyles, LAYOUT, WEB_FOCUS } from '../utils/constants';
import { exportService } from '../services/export';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import ScreenScaffold from '../components/ScreenScaffold';

const FORMATS = [
  { id: 'json', label: 'JSON', desc: 'Tracked records and Meg conversations in a machine-readable file', icon: 'code-slash-outline' },
  { id: 'csv', label: 'CSV', desc: 'Check-ins and periods for a spreadsheet', icon: 'grid-outline' },
  { id: 'pdf', label: 'Text report', desc: 'A simple summary that is easy to read', icon: 'document-text-outline' },
];

export default function ExportDataScreen({ navigation }) {
  const { state } = useApp();
  const [activeExport, setActiveExport] = useState(null);
  const [lastExport, setLastExport] = useState(null);

  async function handleExport(format) {
    setActiveExport(format);
    try {
      if (format === 'json') await exportService.exportToJSON(state);
      if (format === 'csv') await exportService.exportToCSV(state);
      if (format === 'pdf') await exportService.exportToPDF(state);
      setLastExport(format);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export did not finish', 'Please try again. Your records have not been changed.');
    } finally {
      setActiveExport(null);
    }
  }

  const exporting = activeExport !== null;

  return (
    <ScreenScaffold
      contentContainerStyle={styles.scrollContent}
      innerStyle={styles.content}
    >
          <BackButton onPress={() => navigation.goBack()} />
          <ScreenHeader title='Export your data' subtitle='Take a copy of what you have recorded in Bloom.' />

          <View style={[styles.infoCard, styles.privacyBand]}>
            <View style={styles.infoIcon}><Icon name='shield-checkmark-outline' size={22} color={COLORS.sage} /></View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Your records, your choice</Text>
              <Text style={styles.infoText}>Bloom creates the file on this device, then opens your system share sheet when it is available. JSON includes your Meg conversations. Be mindful of where you send health information.</Text>
            </View>
          </View>

          <View style={styles.doctorSection}>
            <View style={[styles.infoIcon, styles.doctorIcon]}><Icon name='medkit-outline' size={22} color={COLORS.brand} /></View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Preparing for an appointment?</Text>
              <Text style={styles.infoText}>Choose a date range and preview a concise cycle, symptom, sleep, food, movement, and medicine summary first.</Text>
              <Button title='Preview doctor summary' variant='secondary' onPress={() => navigation.navigate('DoctorReport')} style={styles.doctorButton} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Choose a format</Text>
          <View style={styles.formatList}>
            {FORMATS.map((format, index) => {
              const isActive = activeExport === format.id;
              return (
                <Pressable
                  key={format.id}
                  onPress={() => handleExport(format.id)}
                  disabled={exporting}
                  accessibilityRole='button'
                  accessibilityLabel={`Export as ${format.label}`}
                  accessibilityHint={format.desc}
                  accessibilityState={{ disabled: exporting, busy: isActive }}
                  style={({ pressed, hovered, focused }) => [
                    styles.formatRow,
                    index === FORMATS.length - 1 && styles.lastRow,
                    hovered && !exporting && styles.rowHovered,
                    focused && styles.rowFocused,
                    pressed && !exporting && styles.rowPressed,
                    exporting && !isActive && styles.disabledRow,
                  ]}
                >
                  <View style={styles.formatIcon}><Icon name={format.icon} size={21} color={COLORS.brand} /></View>
                  <View style={styles.formatCopy}>
                    <Text style={styles.formatLabel}>{format.label}</Text>
                    <Text style={styles.formatDesc}>{format.desc}</Text>
                  </View>
                  {isActive ? <ActivityIndicator color={COLORS.brand} /> : <Icon name='download-outline' size={21} color={COLORS.body} />}
                </Pressable>
              );
            })}
          </View>

          {lastExport ? (
            <View style={styles.successNote} accessibilityRole='status'>
              <Icon name='checkmark-circle-outline' size={18} color={COLORS.sage} />
              <Text style={styles.successText}>{FORMATS.find((item) => item.id === lastExport)?.label} export prepared.</Text>
            </View>
          ) : null}

          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Your Bloom record</Text>
            <Text style={styles.summaryHelp}>JSON includes these saved categories and your profile. CSV and the text report include check-ins and periods.</Text>
            <SummaryRow label='Check-ins' value={state.checkins.length} />
            <SummaryRow label='Periods logged' value={state.periods.length} />
            <SummaryRow label='Meg conversations' value={state.megConversations?.length || 0} />
            <SummaryRow label='Bookmarks' value={state.bookmarks.length} />
            <SummaryRow label='Meals' value={state.meals?.length || 0} />
            <SummaryRow label='Movement entries' value={state.movements?.length || 0} last />
          </View>
    </ScreenScaffold>
  );
}

function BackButton({ onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel='Go back' hitSlop={8} style={({ pressed, hovered, focused }) => [styles.backButton, hovered && styles.backButtonHovered, focused && styles.backButtonFocused, pressed && styles.pressed]}><Icon name='chevron-back' size={20} color={COLORS.ink} /><Text style={styles.backText}>Back</Text></Pressable>;
}

function SummaryRow({ label, value, last = false }) {
  return <View style={[styles.summaryRow, last && styles.lastRow]}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = createThemedStyles({
  scrollContent: { paddingBottom: 40 },
  content: { maxWidth: LAYOUT.phoneMaxWidth, paddingTop: 12 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, marginBottom: 8, paddingHorizontal: 6 },
  backText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  pressed: { opacity: 0.65 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8, padding: 16, borderRadius: LAYOUT.controlRadius },
  privacyBand: { backgroundColor: COLORS.sageLight },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.canvas, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1 },
  infoTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: COLORS.ink },
  infoText: { marginTop: 4, fontSize: 13, lineHeight: 19, color: COLORS.body },
  doctorSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 28, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  doctorIcon: { backgroundColor: COLORS.brandSoft },
  doctorButton: { marginTop: 14 },
  sectionLabel: { marginBottom: 10, fontSize: 13, lineHeight: 18, fontWeight: '700', color: COLORS.muted },
  formatList: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.cardRadius, overflow: 'hidden', backgroundColor: COLORS.canvas },
  formatRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  lastRow: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: COLORS.surfaceSoft },
  rowHovered: { backgroundColor: COLORS.surfaceWarm },
  rowFocused: {
    backgroundColor: COLORS.brandSoft,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
  disabledRow: { opacity: 0.5 },
  formatIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  formatCopy: { flex: 1 },
  formatLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: COLORS.ink },
  formatDesc: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.muted },
  successNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  successText: { fontSize: 13, color: COLORS.sage },
  summarySection: { marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  summaryTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: COLORS.ink },
  summaryHelp: { maxWidth: 560, marginTop: 4, marginBottom: 10, fontSize: 13, lineHeight: 19, color: COLORS.muted },
  summaryRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  summaryLabel: { flex: 1, fontSize: 14, color: COLORS.body },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  backButtonFocused: {
    backgroundColor: COLORS.brandSoft,
    borderRadius: 10,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
});
