import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import {
  COLORS,
  DIETARY_PREFERENCES,
  LANGUAGES,
  LAYOUT,
  MOVEMENT_PREFERENCES,
  SYMPTOMS,
  TONE_PREFERENCES,
  TRACKING_GOALS,
} from '../utils/constants';
import Button from '../components/Button';
import ScreenHeader from '../components/ScreenHeader';

const TRACKING_MODES = [
  {
    id: 'cycle',
    title: 'Basic cycle mode',
    description: 'Cycle dates, symptoms, mood, reminders and essential insights',
    icon: 'calendar-outline',
  },
  {
    id: 'pcos',
    title: 'PCOS support mode',
    description: 'Deeper tracking, daily guidance, Meg and care preparation',
    icon: 'flower-outline',
  },
];

function toggleValue(values, id) {
  return values.includes(id) ? values.filter((item) => item !== id) : [...values, id];
}

function SelectionChip({ item, selected, onPress, multiple = false, wide = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={item.label || item.title}
      accessibilityState={{ checked: selected, selected }}
      style={({ pressed, hovered, focused }) => [
        styles.choice,
        wide && styles.choiceWide,
        selected && styles.choiceSelected,
        hovered && styles.choiceHovered,
        focused && styles.focusedControl,
        pressed && styles.pressed,
      ]}
    >
      {item.icon ? (
        <Ionicons name={item.icon} size={18} color={selected ? COLORS.brand : COLORS.body} />
      ) : null}
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {item.label || item.title}
      </Text>
      {multiple ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={selected ? COLORS.brand : COLORS.hairline}
        />
      ) : null}
    </Pressable>
  );
}

function SettingToggle({ title, description, value, onChange, icon, last = false }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole='switch'
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      style={({ pressed, hovered, focused }) => [
        styles.toggleRow,
        last && styles.toggleRowLast,
        hovered && styles.toggleHovered,
        focused && styles.toggleFocused,
        pressed && styles.togglePressed,
      ]}
    >
      <View style={styles.toggleIcon}>
        <Ionicons name={icon} size={19} color={COLORS.brand} />
      </View>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackActive]}>
        <View style={[styles.switchKnob, value && styles.switchKnobActive]}>
          {value ? <Ionicons name='checkmark' size={12} color={COLORS.brand} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function SectionHeading({ icon, title, description }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color={COLORS.brand} />
      </View>
      <View style={styles.headingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
      </View>
    </View>
  );
}

export default function PreferencesScreen({ navigation }) {
  const { state, saveProfile, saveSettings } = useApp();
  const profile = state.profile || {};
  const current = state.settings || {};
  const [name, setName] = useState(profile.preferredName || profile.name || '');
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [trackingMode, setTrackingMode] = useState(
    current.trackingMode || profile.trackingMode || 'cycle'
  );
  const [goals, setGoals] = useState(() => (
    Array.isArray(current.goals) ? current.goals : profile.goals || ['track_cycle']
  ));
  const [symptomsToTrack, setSymptomsToTrack] = useState(() => (
    Array.isArray(current.symptomsToTrack)
      ? current.symptomsToTrack
      : profile.trackedSymptoms || []
  ));
  const [dietaryPreference, setDietaryPreference] = useState(
    current.dietaryPreference || 'no_preference'
  );
  const [movementPreferences, setMovementPreferences] = useState(() => (
    Array.isArray(current.movementPreferences) ? current.movementPreferences : ['walking']
  ));
  const [language, setLanguage] = useState(current.language || profile.language || 'en');
  const [tone, setTone] = useState(current.tone || 'gentle');
  const [megMemory, setMegMemory] = useState(Boolean(current.megMemory));
  const [cyclePredictions, setCyclePredictions] = useState(current.cyclePredictions !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await saveProfile({
        ...profile,
        preferredName: name.trim(),
        name: profile.name || name.trim(),
        age: age ? parseInt(age, 10) : null,
        language,
        trackingMode,
        goals,
        trackedSymptoms: symptomsToTrack,
      });
      await saveSettings({
        trackingMode,
        goals,
        symptomsToTrack,
        dietaryPreference,
        movementPreferences,
        language,
        tone,
        megMemory,
        cyclePredictions,
      });
      navigation.goBack();
    } catch (saveError) {
      setError('Bloom could not save these preferences. Your choices are still here, so you can try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <BackButton onPress={() => navigation.goBack()} />
          <ScreenHeader
            title='Personalisation'
            subtitle='Choose what Bloom focuses on. Nothing here is used to diagnose you.'
          />

          <View style={styles.section}>
            <SectionHeading icon='person-outline' title='About you' />
            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.label}>Preferred name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  maxLength={64}
                  placeholder='What should Bloom call you?'
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize='words'
                  textContentType='name'
                  accessibilityLabel='Preferred name'
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Age <Text style={styles.optional}>optional</Text></Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={(value) => setAge(value.replace(/\D/g, ''))}
                  placeholder='Your age'
                  placeholderTextColor={COLORS.muted}
                  keyboardType='number-pad'
                  maxLength={3}
                  accessibilityLabel='Age, optional'
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon='options-outline'
              title='Tracking mode'
              description='Both modes include cycle tracking. You can switch at any time.'
            />
            <View style={styles.modeList} accessibilityRole='radiogroup'>
              {TRACKING_MODES.map((item) => {
                const selected = trackingMode === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setTrackingMode(item.id)}
                    accessibilityRole='radio'
                    accessibilityLabel={item.title}
                    accessibilityHint={item.description}
                    accessibilityState={{ checked: selected, selected }}
                    style={({ pressed, hovered, focused }) => [
                      styles.modeOption,
                      selected && styles.modeOptionSelected,
                      hovered && styles.modeOptionHovered,
                      focused && styles.focusedControl,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.modeIcon, selected && styles.modeIconSelected]}>
                      <Ionicons name={item.icon} size={21} color={COLORS.brand} />
                    </View>
                    <View style={styles.modeCopy}>
                      <Text style={[styles.modeTitle, selected && styles.choiceTextSelected]}>{item.title}</Text>
                      <Text style={styles.modeDescription}>{item.description}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={21}
                      color={selected ? COLORS.brand : COLORS.hairline}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon='compass-outline'
              title='What should Bloom help with?'
              description='Choose as many goals as you like.'
            />
            <View style={styles.choiceGrid} accessibilityRole='group' accessibilityLabel='Bloom goals'>
              {TRACKING_GOALS.map((item) => (
                <SelectionChip
                  key={item.id}
                  item={item}
                  selected={goals.includes(item.id)}
                  multiple
                  wide
                  onPress={() => setGoals((values) => toggleValue(values, item.id))}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon='pulse-outline'
              title='Symptoms to track'
              description='These stay easy to reach in your daily check-in.'
            />
            <View style={styles.choiceGrid} accessibilityRole='group' accessibilityLabel='Symptoms to track'>
              {SYMPTOMS.map((item) => (
                <SelectionChip
                  key={item.id}
                  item={item}
                  selected={symptomsToTrack.includes(item.id)}
                  multiple
                  onPress={() => setSymptomsToTrack((values) => toggleValue(values, item.id))}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon='restaurant-outline'
              title='Food preferences'
              description='Used only to make meal ideas more relevant.'
            />
            <View style={styles.choiceGrid} accessibilityRole='radiogroup'>
              {DIETARY_PREFERENCES.map((item) => (
                <SelectionChip
                  key={item.id}
                  item={item}
                  selected={dietaryPreference === item.id}
                  onPress={() => setDietaryPreference(item.id)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon='walk-outline'
              title='Movement preferences'
              description='Choose realistic options Bloom can suggest.'
            />
            <View style={styles.choiceGrid} accessibilityRole='group' accessibilityLabel='Movement preferences'>
              {MOVEMENT_PREFERENCES.map((item) => (
                <SelectionChip
                  key={item.id}
                  item={item}
                  selected={movementPreferences.includes(item.id)}
                  multiple
                  onPress={() => setMovementPreferences((values) => toggleValue(values, item.id))}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading icon='language-outline' title='Language and tone' />
            <Text style={styles.groupLabel}>Preferred language</Text>
            <View style={styles.choiceGrid} accessibilityRole='radiogroup'>
              {LANGUAGES.map((item) => (
                <SelectionChip
                  key={item.id}
                  item={item}
                  selected={language === item.id}
                  onPress={() => setLanguage(item.id)}
                />
              ))}
            </View>
            <View style={styles.groupDivider} />
            <Text style={styles.groupLabel}>Bloom's voice</Text>
            <View style={styles.choiceGrid} accessibilityRole='radiogroup'>
              {TONE_PREFERENCES.map((item) => (
                <SelectionChip
                  key={item.id}
                  item={item}
                  selected={tone === item.id}
                  onPress={() => setTone(item.id)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon='shield-checkmark-outline'
              title='Memory and estimates'
              description='You stay in control of what Bloom remembers and predicts.'
            />
            <View style={styles.toggleGroup}>
              <SettingToggle
                title='Meg memory'
                description='Allow prior conversations to inform Meg replies; chats still save securely'
                value={megMemory}
                onChange={setMegMemory}
                icon='chatbubbles-outline'
              />
              <SettingToggle
                title='Cycle predictions'
                description='Show careful estimates based on your logged cycles'
                value={cyclePredictions}
                onChange={setCyclePredictions}
                icon='calendar-number-outline'
                last
              />
            </View>
            <Text style={styles.estimateNote}>
              Predictions are estimates, not contraception guidance or medical certainty.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorState} accessibilityRole='alert' accessibilityLiveRegion='assertive'>
              <Ionicons name='alert-circle-outline' size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button title='Save changes' onPress={handleSave} loading={saving} style={styles.saveButton} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel='Go back'
      hitSlop={8}
      style={({ pressed, hovered, focused }) => [
        styles.backButton,
        hovered && styles.backButtonHovered,
        focused && styles.backButtonFocused,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name='chevron-back' size={20} color={COLORS.ink} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  content: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: 12,
  },
  backButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -6,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  backText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
  section: {
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  headingCopy: { flex: 1, paddingTop: 1 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: COLORS.ink },
  sectionDesc: { marginTop: 3, fontSize: 13, lineHeight: 19, color: COLORS.muted },
  fields: { gap: 14 },
  field: { gap: 7 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.ink },
  optional: { fontWeight: '400', color: COLORS.muted },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    paddingHorizontal: 14,
    backgroundColor: COLORS.canvas,
    color: COLORS.ink,
    fontSize: 15,
  },
  modeList: { gap: 8 },
  modeOption: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
  },
  modeOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  modeOptionHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  modeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  modeIconSelected: { backgroundColor: COLORS.canvas },
  modeCopy: { flex: 1 },
  modeTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: COLORS.ink },
  modeDescription: { marginTop: 3, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minWidth: 116,
    minHeight: 48,
    flexGrow: 1,
    flexBasis: '28%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
  },
  choiceWide: { minWidth: 210, flexBasis: '46%' },
  choiceSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  choiceHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  focusedControl: { borderColor: COLORS.brand },
  choiceText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.body,
    textAlign: 'center',
  },
  choiceTextSelected: { color: COLORS.brand },
  groupLabel: { marginBottom: 10, fontSize: 13, lineHeight: 18, fontWeight: '700', color: COLORS.body },
  groupDivider: { height: 1, marginVertical: 18, backgroundColor: COLORS.hairline },
  toggleGroup: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, overflow: 'hidden' },
  toggleRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  toggleRowLast: { borderBottomWidth: 0 },
  togglePressed: { backgroundColor: COLORS.surfaceSoft },
  toggleHovered: { backgroundColor: COLORS.surfaceWarm },
  toggleFocused: { backgroundColor: COLORS.brandSoft },
  toggleIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  toggleCopy: { flex: 1 },
  toggleTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.ink },
  toggleDescription: { marginTop: 2, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  switchTrack: { width: 50, height: 28, justifyContent: 'center', paddingHorizontal: 2, borderRadius: 14, backgroundColor: COLORS.hairline },
  switchTrackActive: { backgroundColor: COLORS.brand },
  switchKnob: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  switchKnobActive: { transform: [{ translateX: 22 }] },
  estimateNote: { marginTop: 12, fontSize: 12, lineHeight: 18, color: COLORS.muted },
  errorState: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginVertical: 8, padding: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: '#FFF7F6' },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.error },
  saveButton: { marginTop: 8 },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  backButtonFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 10 },
});
