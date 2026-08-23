import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import { useApp } from '../context/AppContext';
import { localDateKey } from '../utils/dateKey';
import { COLORS, createThemedStyles, ELEVATION, LAYOUT } from '../utils/constants';
import Card from '../components/Card';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';
import { MotionScrollView, ScrollReveal } from '../components/Motion';

const ACTIVITIES = [
  { id: 'mobility-5', label: '5-minute mobility', duration: 5, icon: 'body-outline', tone: 'sage' },
  { id: 'walk-10', label: '10-minute walk', duration: 10, icon: 'walk-outline', tone: 'brand' },
  { id: 'walk-15', label: '15-minute walk', duration: 15, icon: 'footsteps-outline', tone: 'brand' },
  { id: 'stretch', label: 'Gentle stretching', duration: 10, icon: 'accessibility-outline', tone: 'sage' },
  { id: 'strength', label: 'Beginner strength', duration: 15, icon: 'barbell-outline', tone: 'brand' },
  { id: 'breathing', label: 'Breathing exercise', duration: 5, icon: 'leaf-outline', tone: 'sage' },
  { id: 'recovery', label: 'Rest and recovery', duration: 0, icon: 'moon-outline', tone: 'sage' },
  { id: 'custom', label: 'My own activity', duration: 10, icon: 'add-outline', tone: 'brand' },
];

const STATUSES = [
  { id: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
  { id: 'partial', label: 'Partly completed', icon: 'contrast-outline' },
  { id: 'not_today', label: 'Not today', icon: 'pause-circle-outline' },
];

function selectedDate(route) {
  return localDateKey(route?.params?.date);
}

function createId() {
  return `movement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function activityById(id) {
  return ACTIVITIES.find((activity) => activity.id === id) || ACTIVITIES[1];
}

function movementActivityId(entry) {
  return entry?.activityId || entry?.type || 'custom';
}

function movementLabel(entry) {
  return entry?.activityLabel || entry?.name || activityById(movementActivityId(entry)).label;
}

function dateLabel(value) {
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'd MMM yyyy') : value;
}

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildRecommendation(checkin, previousMovement) {
  const energy = numeric(checkin?.energy);
  const sleep = numeric(checkin?.sleepDuration ?? checkin?.sleep);
  const pain = numeric(checkin?.pain);
  const stress = numeric(checkin?.stress);
  const flow = checkin?.flow || checkin?.bleeding;
  const sleepQuality = checkin?.sleepQuality;

  if (flow === 'heavy' || (pain !== null && pain >= 7)) {
    return { activityId: 'recovery', reason: 'Heavy bleeding or stronger discomfort was logged, so rest and gentle care are a reasonable option.' };
  }
  if (pain !== null && pain >= 4) {
    return { activityId: 'stretch', reason: 'You logged some discomfort. Gentle stretching keeps the plan easy to adjust or stop.' };
  }
  if ((energy !== null && energy <= 3) || (sleep !== null && sleep < 6) || sleepQuality === 'poor') {
    return { activityId: 'mobility-5', reason: 'Energy or sleep looks lower today, so this starts small and leaves room for recovery.' };
  }
  if (stress !== null && stress >= 7) {
    return { activityId: 'breathing', reason: 'You logged higher stress. A short breathing pause may feel more manageable than a workout.' };
  }
  if (previousMovement && movementActivityId(previousMovement) === 'strength' && previousMovement.status === 'completed') {
    return { activityId: 'walk-10', reason: 'Your previous activity was strength-focused, so an easy walk offers a different kind of movement.' };
  }
  if (!checkin) {
    return { activityId: 'walk-10', reason: 'There is no check-in for this date, so Bloom is offering a flexible starting point you can replace.' };
  }
  return { activityId: 'walk-10', reason: 'Your check-in does not call for extra intensity. A short walk is one practical option, not a requirement.' };
}

function statusMessage(status) {
  if (status === 'completed') return 'Logged. How it felt matters more than how much you did.';
  if (status === 'partial') return 'Partly completed still reflects what was realistic today.';
  return 'Not today is useful context too. Nothing resets and there is no penalty.';
}

export default function MovementScreen({ navigation, route }) {
  const { state, saveMovement, deleteMovement } = useApp();
  const date = selectedDate(route);
  const movements = Array.isArray(state.movements) ? state.movements : [];
  const checkin = (state.checkins || []).find((entry) => entry.date === date);
  const previousMovement = useMemo(() => movements
    .filter((entry) => entry.date && entry.date < date)
    .sort((a, b) => `${b.date}${b.updatedAt || ''}`.localeCompare(`${a.date}${a.updatedAt || ''}`))[0], [date, movements]);
  const recommendation = useMemo(() => buildRecommendation(checkin, previousMovement), [checkin, previousMovement]);
  const recommendedActivity = activityById(recommendation.activityId);
  const [editingId, setEditingId] = useState(null);
  const [activityId, setActivityId] = useState(recommendation.activityId);
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState(recommendedActivity.duration);
  const [status, setStatus] = useState('completed');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const history = useMemo(() => [...movements]
    .sort((a, b) => `${b.date || ''}${b.updatedAt || ''}`.localeCompare(`${a.date || ''}${a.updatedAt || ''}`)), [movements]);
  const selectedDateEntries = useMemo(() => history.filter((entry) => entry.date === date), [date, history]);

  function chooseActivity(activity) {
    setActivityId(activity.id);
    setDuration(activity.duration);
    if (activity.id !== 'custom') setCustomName('');
    setNotice(null);
  }

  function resetForm(useRecommendation = true) {
    const nextActivity = useRecommendation ? recommendedActivity : ACTIVITIES[1];
    setEditingId(null);
    setActivityId(nextActivity.id);
    setDuration(nextActivity.duration);
    setCustomName('');
    setStatus('completed');
    setNotes('');
  }

  function editMovement(entry) {
    const nextActivityId = movementActivityId(entry);
    setEditingId(entry.id);
    setActivityId(nextActivityId);
    setCustomName(nextActivityId === 'custom' ? movementLabel(entry) : '');
    setDuration(numeric(entry.duration) ?? activityById(nextActivityId).duration);
    setStatus(entry.status || 'completed');
    setNotes(entry.notes || '');
    setNotice({ type: 'info', text: 'Editing this activity. Choose another option to replace it.' });
  }

  async function handleSave() {
    if ((activityId === 'custom' && !customName.trim()) || saving) return;
    const existing = editingId ? movements.find((entry) => entry.id === editingId) : null;
    const activity = activityById(activityId);
    const now = new Date().toISOString();
    setSaving(true);
    setNotice(null);
    try {
      await saveMovement({
        ...existing,
        id: editingId || createId(),
        date,
        activityId,
        activityLabel: activityId === 'custom' ? customName.trim() : activity.label,
        duration,
        status,
        notes: notes.trim(),
        source: activityId === recommendation.activityId ? 'recommended' : activityId === 'custom' ? 'custom' : 'chosen',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
      setNotice({ type: 'success', text: statusMessage(status) });
      resetForm();
    } catch (error) {
      setNotice({ type: 'error', text: 'This activity could not be saved. Your choices are still here so you can try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    setNotice(null);
    try {
      await deleteMovement(id);
      if (editingId === id) resetForm();
      setDeletingId(null);
      setNotice({ type: 'success', text: 'Activity deleted. Your progress is not scored or reset.' });
    } catch (error) {
      setNotice({ type: 'error', text: 'This activity could not be deleted. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (state.isLoading) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.loadingState}><Text style={styles.loadingText}>Loading movement support...</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <MotionScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
        <View style={styles.content}>
          {navigation?.canGoBack?.() ? <BackButton onPress={() => navigation.goBack()} /> : null}
          <ScreenHeader
            title='Movement and recovery'
            subtitle='Choose what fits your body today. Rest is always a valid option.'
            action={<View style={styles.dateBadge}><Ionicons name='calendar-clear-outline' size={15} color={COLORS.brand} /><Text style={styles.dateBadgeText}>{dateLabel(date)}</Text></View>}
          />

          {notice ? (
            <View style={[styles.notice, notice.type === 'success' && styles.noticeSuccess, notice.type === 'error' && styles.noticeError]} accessibilityLiveRegion='polite'>
              <Ionicons name={notice.type === 'error' ? 'alert-circle-outline' : notice.type === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'} size={20} color={notice.type === 'error' ? COLORS.error : notice.type === 'success' ? COLORS.sage : COLORS.brand} />
              <Text style={styles.noticeText}>{notice.text}</Text>
            </View>
          ) : null}

          <Card variant='sage' style={styles.recommendationCard}>
            <View style={styles.eyebrowRow}><Ionicons name='sparkles-outline' size={17} color={COLORS.sage} /><Text style={styles.eyebrow}>A gentle suggestion</Text></View>
            <View style={styles.recommendationMain}>
              <View style={styles.recommendationIcon}><Ionicons name={recommendedActivity.icon} size={24} color={COLORS.sage} /></View>
              <View style={styles.flex}><Text style={styles.recommendationTitle}>{recommendedActivity.label}</Text><Text style={styles.recommendationReason}>{recommendation.reason}</Text></View>
            </View>
            <View style={styles.recommendationActions}>
              <Pressable onPress={() => chooseActivity(recommendedActivity)} accessibilityRole='button' style={({ pressed, hovered, focused }) => [styles.primarySmallAction, hovered && styles.primarySmallHovered, focused && styles.primarySmallFocused, pressed && styles.pressed]}><Text style={styles.primarySmallText}>Choose this</Text></Pressable>
              <Pressable onPress={() => { setActivityId(null); setNotice({ type: 'info', text: 'Choose any activity below. Replacing a suggestion does not affect progress.' }); }} accessibilityRole='button' style={({ pressed, hovered, focused }) => [styles.secondarySmallAction, hovered && styles.secondarySmallHovered, focused && styles.focusedControl, pressed && styles.pressed]}><Text style={styles.secondarySmallText}>Replace activity</Text></Pressable>
            </View>
            <Text style={styles.disclaimer}>This suggestion is based only on what you logged. Stop or seek medical care if movement feels unsafe.</Text>
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{editingId ? 'Replace or edit activity' : 'What feels realistic?'}</Text>
            <Text style={styles.sectionSubtitle}>There is no preferred choice and no missed-day penalty.</Text>
            <View style={styles.activityGrid} accessibilityRole='radiogroup'>
              {ACTIVITIES.map((activity, index) => (
                <ActivityOption key={activity.id} activity={activity} selected={activityId === activity.id} recommended={activity.id === recommendation.activityId} last={index === ACTIVITIES.length - 1} onPress={() => chooseActivity(activity)} />
              ))}
            </View>
          </View>

          <Card style={styles.formCard}>
            <View style={styles.formHeading}>
              <View style={styles.formIcon}><Ionicons name={editingId ? 'create-outline' : 'flag-outline'} size={21} color={COLORS.brand} /></View>
              <View style={styles.flex}><Text style={styles.cardTitle}>{editingId ? 'Update activity' : 'Log what happened'}</Text><Text style={styles.cardSubtitle}>Partial and not today are both useful entries.</Text></View>
            </View>

            {activityId === 'custom' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Your activity</Text>
                <TextInput value={customName} onChangeText={setCustomName} placeholder='For example, dancing or household chores' placeholderTextColor={COLORS.muted} style={styles.input} maxLength={80} accessibilityLabel='Custom activity name' />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Time <Text style={styles.optional}>optional</Text></Text>
              <View style={styles.chipRow} accessibilityRole='radiogroup'>
                {[0, 5, 10, 15, 20, 30].map((minutes) => <ChoiceChip key={minutes} label={minutes === 0 ? 'No time goal' : `${minutes} min`} selected={duration === minutes} onPress={() => setDuration(minutes)} />)}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>How did it go?</Text>
              <View style={styles.statusList} accessibilityRole='radiogroup'>
                {STATUSES.map((item) => (
                  <Pressable key={item.id} onPress={() => setStatus(item.id)} accessibilityRole='radio' accessibilityState={{ checked: status === item.id }} style={({ pressed, hovered, focused }) => [styles.statusOption, status === item.id && styles.statusOptionSelected, hovered && styles.optionHovered, focused && styles.focusedControl, pressed && styles.pressed]}>
                    <Ionicons name={item.icon} size={20} color={status === item.id ? COLORS.brand : COLORS.muted} />
                    <Text style={[styles.statusText, status === item.id && styles.statusTextSelected]}>{item.label}</Text>
                    <Ionicons name={status === item.id ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={status === item.id ? COLORS.brand : COLORS.hairline} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>A note <Text style={styles.optional}>optional</Text></Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder='How it felt, what helped, or why today was a rest day' placeholderTextColor={COLORS.muted} style={[styles.input, styles.notesInput]} multiline maxLength={180} textAlignVertical='top' accessibilityLabel='Optional activity note' />
            </View>

            <View style={styles.reassurance}><Ionicons name='heart-outline' size={18} color={COLORS.sage} /><Text style={styles.reassuranceText}>{statusMessage(status)}</Text></View>
            <Button title={editingId ? 'Save changes' : 'Save activity'} icon='checkmark-circle-outline' onPress={handleSave} disabled={!activityId || (activityId === 'custom' && !customName.trim())} loading={saving} />
            {editingId ? <Button title='Cancel edit' variant='ghost' onPress={() => { resetForm(); setNotice(null); }} style={styles.cancelButton} /> : null}
          </Card>

          <ScrollReveal style={styles.section}>
            <Text style={styles.sectionTitle}>Movement history</Text>
            <Text style={styles.sectionSubtitle}>{selectedDateEntries.length} on this date / {history.length} total</Text>
            {history.length === 0 ? (
              <Card variant='cream' style={styles.emptyCard}>
                <View style={styles.emptyIcon}><Ionicons name='walk-outline' size={25} color={COLORS.brand} /></View>
                <Text style={styles.emptyTitle}>Nothing logged yet</Text>
                <Text style={styles.emptyText}>Choose a suggestion, your own activity, or a rest day. Each one adds useful context.</Text>
              </Card>
            ) : history.map((entry) => (
              <MovementHistoryCard
                key={entry.id}
                entry={entry}
                confirming={deletingId === entry.id}
                onEdit={() => editMovement(entry)}
                onDelete={() => setDeletingId(entry.id)}
                onCancelDelete={() => setDeletingId(null)}
                onConfirmDelete={() => handleDelete(entry.id)}
              />
            ))}
          </ScrollReveal>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

function ActivityOption({ activity, selected, recommended, last, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole='radio' accessibilityState={{ checked: selected }} accessibilityLabel={`${activity.label}${recommended ? ', suggested' : ''}`} style={({ pressed, hovered, focused }) => [styles.activityOption, !last && styles.activityOptionDivider, selected && styles.activityOptionSelected, hovered && styles.optionHovered, focused && styles.focusedRow, pressed && styles.pressed]}>
      <View style={[styles.activityIcon, activity.tone === 'sage' && styles.activityIconSage]}><Ionicons name={activity.icon} size={20} color={activity.tone === 'sage' ? COLORS.sage : COLORS.brand} /></View>
      <View style={styles.flex}><Text style={[styles.activityLabel, selected && styles.activityLabelSelected]}>{activity.label}</Text>{recommended ? <Text style={styles.recommendedLabel}>Suggested from your check-in</Text> : null}</View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? COLORS.brand : COLORS.hairline} />
    </Pressable>
  );
}

function ChoiceChip({ label, selected, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='radio' accessibilityState={{ checked: selected }} style={({ pressed, hovered, focused }) => [styles.choiceChip, selected && styles.choiceChipSelected, hovered && styles.optionHovered, focused && styles.focusedControl, pressed && styles.pressed]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

function BackButton({ onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel='Go back' style={({ pressed, hovered, focused }) => [styles.backButton, hovered && styles.backButtonHovered, focused && styles.backButtonFocused, pressed && styles.pressed]}><Ionicons name='chevron-back' size={20} color={COLORS.ink} /><Text style={styles.backText}>Back</Text></Pressable>;
}

function MovementHistoryCard({ entry, confirming, onEdit, onDelete, onCancelDelete, onConfirmDelete }) {
  const activity = activityById(movementActivityId(entry));
  const status = STATUSES.find((item) => item.id === entry.status) || STATUSES[0];
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View style={styles.historyIcon}><Ionicons name={activity.icon} size={20} color={COLORS.brand} /></View>
        <View style={styles.flex}><Text style={styles.historyName}>{movementLabel(entry)}</Text><Text style={styles.historyMeta}>{dateLabel(entry.date)}{numeric(entry.duration) ? ` / ${entry.duration} min` : ''}</Text></View>
        <View style={[styles.statusBadge, entry.status === 'not_today' && styles.statusBadgeMuted]}><Ionicons name={status.icon} size={14} color={entry.status === 'not_today' ? COLORS.muted : COLORS.sage} /><Text style={[styles.statusBadgeText, entry.status === 'not_today' && styles.statusBadgeTextMuted]}>{status.label}</Text></View>
      </View>
      {entry.notes ? <Text style={styles.historyNotes}>{entry.notes}</Text> : null}
      {confirming ? (
        <View style={styles.deleteConfirm}><Text style={styles.deleteText}>Delete this activity entry?</Text><View style={styles.inlineActions}><ActionButton label='Keep' onPress={onCancelDelete} /><ActionButton label='Delete' danger onPress={onConfirmDelete} /></View></View>
      ) : <View style={styles.inlineActions}><ActionButton label='Edit or replace' icon='create-outline' onPress={onEdit} /><ActionButton label='Delete' icon='trash-outline' danger onPress={onDelete} /></View>}
    </View>
  );
}

function ActionButton({ label, icon, danger, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel={label} style={({ pressed, hovered, focused }) => [styles.actionButton, hovered && styles.actionButtonHovered, focused && styles.actionButtonFocused, pressed && styles.pressed]}>{icon ? <Ionicons name={icon} size={16} color={danger ? COLORS.error : COLORS.body} /> : null}<Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text></Pressable>;
}

const styles = createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  content: { width: '100%', maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingTop: 10 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: COLORS.muted },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, marginBottom: 8, paddingHorizontal: 6 },
  backText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  dateBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, backgroundColor: COLORS.brandSoft, paddingHorizontal: 11 },
  dateBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.brand },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginBottom: 20, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.brandSoft },
  noticeSuccess: { backgroundColor: COLORS.sageLight },
  noticeError: { backgroundColor: '#FCEDEB' },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.body },
  recommendationCard: { padding: 20, marginBottom: 28, borderWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 13 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: COLORS.sage },
  recommendationMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  recommendationIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  recommendationTitle: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: COLORS.ink },
  recommendationReason: { marginTop: 5, fontSize: 14, lineHeight: 20, color: COLORS.body },
  recommendationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  primarySmallAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 22, backgroundColor: COLORS.sage },
  primarySmallHovered: { backgroundColor: '#50664D' },
  primarySmallFocused: { borderWidth: 2, borderColor: COLORS.ink },
  primarySmallText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  secondarySmallAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: '#CBD5C8', backgroundColor: COLORS.canvas },
  secondarySmallHovered: { borderColor: COLORS.sage, backgroundColor: COLORS.surfaceSoft },
  secondarySmallText: { fontSize: 13, fontWeight: '700', color: COLORS.body },
  disclaimer: { marginTop: 13, fontSize: 11, lineHeight: 16, color: COLORS.muted },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: COLORS.ink },
  sectionSubtitle: { marginTop: 3, fontSize: 14, lineHeight: 20, color: COLORS.muted },
  activityGrid: { marginTop: 14, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.cardRadius },
  activityOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, backgroundColor: COLORS.canvas },
  activityOptionDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  activityOptionSelected: { backgroundColor: COLORS.brandSoft },
  optionHovered: { backgroundColor: COLORS.surfaceWarm, borderColor: '#D7B1A5' },
  focusedRow: { backgroundColor: COLORS.brandSoft },
  focusedControl: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  activityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  activityIconSage: { backgroundColor: COLORS.sageLight },
  activityLabel: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.ink },
  activityLabelSelected: { color: COLORS.brand },
  recommendedLabel: { marginTop: 2, fontSize: 11, lineHeight: 15, color: COLORS.sage },
  formCard: { padding: 20, marginBottom: 30, borderWidth: 0, ...Platform.select({ web: ELEVATION.web, ios: ELEVATION.ios, android: ELEVATION.android, default: {} }) },
  formHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  formIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: COLORS.ink },
  cardSubtitle: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.muted },
  field: { marginBottom: 20 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: COLORS.ink },
  optional: { fontWeight: '400', color: COLORS.muted },
  input: { minHeight: 52, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, paddingHorizontal: 14, marginTop: 8, fontSize: 15, color: COLORS.ink, backgroundColor: COLORS.canvas },
  notesInput: { minHeight: 92, paddingTop: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  choiceChip: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 22, backgroundColor: COLORS.canvas },
  choiceChipSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  choiceText: { fontSize: 13, fontWeight: '600', color: COLORS.body },
  choiceTextSelected: { color: COLORS.brand },
  statusList: { gap: 8, marginTop: 10 },
  statusOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.canvas },
  statusOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  statusText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.body },
  statusTextSelected: { color: COLORS.brand },
  reassurance: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 18, padding: 13, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.sageLight },
  reassuranceText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.body },
  cancelButton: { marginTop: 4 },
  emptyCard: { alignItems: 'center', paddingVertical: 36, marginTop: 14 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: COLORS.brandSoft },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.ink, textAlign: 'center' },
  emptyText: { maxWidth: 390, marginTop: 6, fontSize: 14, lineHeight: 20, color: COLORS.muted, textAlign: 'center' },
  historyCard: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  historyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  historyName: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: COLORS.ink },
  historyMeta: { marginTop: 2, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  statusBadge: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 15, backgroundColor: COLORS.sageLight },
  statusBadgeMuted: { backgroundColor: COLORS.surfaceSoft },
  statusBadgeText: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: COLORS.sage },
  statusBadgeTextMuted: { color: COLORS.muted },
  historyNotes: { marginTop: 12, fontSize: 13, lineHeight: 19, color: COLORS.body },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  actionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  actionButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 9 },
  actionButtonFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 9 },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.body },
  dangerText: { color: COLORS.error },
  deleteConfirm: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  deleteText: { fontSize: 13, lineHeight: 18, color: COLORS.body },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  backButtonFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 10 },
});
