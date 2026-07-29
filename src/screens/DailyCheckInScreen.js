import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import { useApp } from '../context/AppContext';
import { COLORS, FLOW_LEVELS, LAYOUT, MOODS, SYMPTOMS } from '../utils/constants';
import { getCycleDay } from '../utils/helpers';
import { localDateKey } from '../utils/dateKey';
import Button from '../components/Button';
import Card from '../components/Card';
import { Entrance } from '../components/Motion';

const FLOW_SPECS = [
  { ids: ['none'], label: 'No bleeding', icon: 'remove-outline' },
  { ids: ['spotting'], label: 'Spotting', icon: 'water-outline' },
  { ids: ['light'], label: 'Light', icon: 'water-outline' },
  { ids: ['medium'], label: 'Medium', icon: 'water' },
  { ids: ['heavy'], label: 'Heavy', icon: 'water' },
];

const MOOD_SPECS = [
  { ids: ['calm'], label: 'Calm', icon: 'leaf-outline' },
  { ids: ['happy', 'joyful'], label: 'Happy', icon: 'sunny-outline' },
  { ids: ['low'], label: 'Low', icon: 'cloud-outline' },
  { ids: ['anxious', 'anxiety'], label: 'Anxious', icon: 'rainy-outline' },
  { ids: ['irritated', 'irritable'], label: 'Irritated', icon: 'flash-outline' },
  { ids: ['overwhelmed'], label: 'Overwhelmed', icon: 'layers-outline' },
  { ids: ['emotionally_sensitive', 'tender'], label: 'Emotionally sensitive', icon: 'flower-outline' },
];

const SYMPTOM_SPECS = [
  { ids: ['cramps'], label: 'Cramps', icon: 'pulse-outline' },
  { ids: ['bloating'], label: 'Bloating', icon: 'ellipse-outline' },
  { ids: ['headache'], label: 'Headache', icon: 'medical-outline' },
  { ids: ['back_pain'], label: 'Back pain', icon: 'body-outline' },
  { ids: ['breast_tenderness'], label: 'Breast tenderness', icon: 'heart-outline' },
  { ids: ['acne'], label: 'Acne', icon: 'sparkles-outline' },
  { ids: ['hair_fall'], label: 'Hair fall', icon: 'leaf-outline' },
  { ids: ['fatigue'], label: 'Fatigue', icon: 'battery-dead-outline' },
  { ids: ['nausea'], label: 'Nausea', icon: 'fitness-outline' },
  { ids: ['pelvic_discomfort'], label: 'Pelvic discomfort', icon: 'medkit-outline' },
  { ids: ['cravings'], label: 'Food cravings', icon: 'restaurant-outline' },
  { ids: ['mood_swings'], label: 'Mood swings', icon: 'swap-horizontal-outline' },
  { ids: ['insomnia'], label: 'Insomnia', icon: 'moon-outline' },
  { ids: ['constipation'], label: 'Constipation', icon: 'body-outline' },
  { ids: ['diarrhea'], label: 'Diarrhea', icon: 'water-outline' },
  { ids: ['hot_flashes'], label: 'Hot flashes', icon: 'thermometer-outline' },
  { ids: ['dizziness'], label: 'Dizziness', icon: 'sync-outline' },
  { ids: ['lower_back_pain'], label: 'Lower back pain', icon: 'body-outline' },
  { ids: ['muscle_aches'], label: 'Muscle aches', icon: 'fitness-outline' },
  { ids: ['appetite_changes'], label: 'Appetite changes', icon: 'restaurant-outline' },
  { ids: ['tearfulness'], label: 'Tearfulness', icon: 'rainy-outline' },
  { ids: ['irritability'], label: 'Irritability', icon: 'flash-outline' },
];

const ENERGY_OPTIONS = [
  { id: 1, label: 'Very low' },
  { id: 3, label: 'Low' },
  { id: 5, label: 'Steady' },
  { id: 7, label: 'Good' },
  { id: 10, label: 'High' },
];

const SLEEP_OPTIONS = [
  { id: 4, label: '4h or less' },
  { id: 5, label: '5h' },
  { id: 6, label: '6h' },
  { id: 7, label: '7h' },
  { id: 8, label: '8h' },
  { id: 9, label: '9h+' },
];

const SLEEP_QUALITY_OPTIONS = [
  { id: 'poor', label: 'Poor' },
  { id: 'fair', label: 'Fair' },
  { id: 'okay', label: 'Okay' },
  { id: 'good', label: 'Good' },
  { id: 'restful', label: 'Restful' },
];

const CRAVING_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'mild', label: 'Mild' },
  { id: 'noticeable', label: 'Noticeable' },
  { id: 'strong', label: 'Strong' },
];

const WATER_OPTIONS = [
  { id: 0, label: 'None yet' },
  { id: 2, label: '1-2 glasses' },
  { id: 4, label: '3-4 glasses' },
  { id: 6, label: '5-6 glasses' },
  { id: 8, label: '7+ glasses' },
];

const STRESS_OPTIONS = [
  { id: 1, label: 'Very low' },
  { id: 3, label: 'Low' },
  { id: 5, label: 'Moderate' },
  { id: 7, label: 'High' },
  { id: 10, label: 'Very high' },
];

const SEVERITY_OPTIONS = [
  { id: 'mild', label: 'Mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'severe', label: 'Severe' },
];

const MEDICATION_OPTIONS = [
  { id: true, label: 'Taken' },
  { id: false, label: 'Not today' },
];

function resolveOptions(specs, source) {
  const available = Array.isArray(source) ? source : [];
  return specs.map((spec) => {
    const match = available.find((item) => spec.ids.includes(item.id));
    return {
      id: match?.id || spec.ids[0],
      label: spec.label,
      icon: match?.icon || spec.icon,
    };
  });
}

const FLOW_OPTIONS = resolveOptions(FLOW_SPECS, FLOW_LEVELS);
const MOOD_OPTIONS = resolveOptions(MOOD_SPECS, MOODS);
const SYMPTOM_OPTIONS = resolveOptions(SYMPTOM_SPECS, SYMPTOMS);

function ChoiceChip({
  option,
  selected,
  onPress,
  multiple = false,
  compact = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={option.label}
      accessibilityState={{ checked: selected, selected }}
      style={({ pressed, hovered, focused }) => [
        styles.choice,
        compact && styles.choiceCompact,
        selected && styles.choiceSelected,
        hovered && !selected && styles.choiceHovered,
        focused && styles.interactiveFocused,
        pressed && styles.pressed,
      ]}
    >
      {option.icon ? (
        <Ionicons
          name={option.icon}
          size={18}
          color={selected ? COLORS.brand : COLORS.body}
        />
      ) : null}
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {option.label}
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

function Field({ title, description, children, last = false }) {
  return (
    <View style={[styles.field, last && styles.fieldLast]}>
      <View style={styles.fieldHeading}>
        <Text style={styles.fieldTitle}>{title}</Text>
        <Text style={styles.optional}>Optional</Text>
      </View>
      {description ? <Text style={styles.fieldDescription}>{description}</Text> : null}
      <View style={styles.fieldControl}>{children}</View>
    </View>
  );
}

function SingleChoiceGroup({ options, value, onChange, label, compact = false }) {
  return (
    <View style={styles.choiceGrid} accessibilityRole='radiogroup' accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <ChoiceChip
            key={String(option.id)}
            option={option}
            selected={selected}
            compact={compact}
            onPress={() => onChange(selected ? null : option.id)}
          />
        );
      })}
    </View>
  );
}

function SymptomSeverityPicker({ symptom, value, onChange }) {
  const symptomLabel = optionLabel(SYMPTOM_OPTIONS, symptom);
  return (
    <View style={styles.severityBlock}>
      <Text style={styles.severityTitle}>How strong are the {symptomLabel.toLowerCase()}?</Text>
      <View style={styles.severityOptions} accessibilityRole='radiogroup' accessibilityLabel={`${symptomLabel} severity`}>
        {SEVERITY_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(selected ? null : option.id)}
              accessibilityRole='radio'
              accessibilityState={{ checked: selected }}
              style={({ pressed, focused }) => [
                styles.severityOption,
                selected && styles.severityOptionSelected,
                focused && styles.interactiveFocused,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.severityOptionText, selected && styles.severityOptionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ReviewRow({ label, value, last = false }) {
  return (
    <View style={[styles.reviewRow, last && styles.reviewRowLast]}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, value === 'Not added' && styles.reviewValueEmpty]}>
        {value}
      </Text>
    </View>
  );
}

function optionLabel(options, value) {
  if (value === null || value === undefined || value === '') return 'Not added';
  return options.find((option) => option.id === value)?.label || String(value);
}

function safeDateKey(value) {
  return localDateKey(value);
}

export default function DailyCheckInScreen({ route, navigation }) {
  const { state, saveCheckin } = useApp();
  const date = safeDateKey(route?.params?.date);
  const existingCheckin = useMemo(
    () => state.checkins.find((item) => item.date === date) || null,
    [date, state.checkins]
  );

  const [step, setStep] = useState(0);
  const [hasChangedStep, setHasChangedStep] = useState(false);
  const [flow, setFlow] = useState(existingCheckin?.flow ?? null);
  const [symptoms, setSymptoms] = useState(existingCheckin?.symptoms || []);
  const [symptomSeverity, setSymptomSeverity] = useState(existingCheckin?.symptomSeverity || {});
  const [mood, setMood] = useState(existingCheckin?.mood ?? null);
  const [energy, setEnergy] = useState(existingCheckin?.energy ?? null);
  const [sleepDuration, setSleepDuration] = useState(
    existingCheckin?.sleepDuration ?? existingCheckin?.sleep ?? null
  );
  const [sleepQuality, setSleepQuality] = useState(existingCheckin?.sleepQuality ?? null);
  const [cravings, setCravings] = useState(existingCheckin?.cravings ?? null);
  const [water, setWater] = useState(existingCheckin?.water ?? null);
  const [stress, setStress] = useState(existingCheckin?.stress ?? null);
  const [movement, setMovement] = useState(() => {
    if (typeof existingCheckin?.movementNote === 'string') return existingCheckin.movementNote;
    if (typeof existingCheckin?.movement === 'string') return existingCheckin.movement;
    return existingCheckin?.movement?.note || '';
  });
  const [medicationTaken, setMedicationTaken] = useState(() => {
    if (typeof existingCheckin?.medicationTaken === 'boolean') {
      return existingCheckin.medicationTaken;
    }
    if (typeof existingCheckin?.medication?.taken === 'boolean') {
      return existingCheckin.medication.taken;
    }
    return null;
  });
  const [medicationName, setMedicationName] = useState(
    existingCheckin?.medicationName || existingCheckin?.medication?.name || ''
  );
  const [notes, setNotes] = useState(existingCheckin?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);

  const targetDate = parseISO(date);
  const dateLabel = format(targetDate, 'EEEE, d MMMM yyyy');
  const cycleDay = useMemo(() => {
    const latestPeriod = [...(state.periods || [])]
      .filter((period) => {
        const start = parseISO(period.startDate);
        return isValid(start) && start <= targetDate;
      })
      .sort((a, b) => parseISO(b.startDate) - parseISO(a.startDate))[0];
    return latestPeriod ? getCycleDay(latestPeriod.startDate, targetDate) : null;
  }, [state.periods, date]);

  function toggleSymptom(id) {
    setSymptoms((current) => {
      if (!current.includes(id)) return [...current, id];
      setSymptomSeverity((severity) => {
        const next = { ...severity };
        delete next[id];
        return next;
      });
      return current.filter((item) => item !== id);
    });
  }

  function handleBack() {
    setError('');
    if (step === 0) navigation.goBack();
    else {
      setHasChangedStep(true);
      setStep((current) => current - 1);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError('');

    const movementValue = movement.trim();
    const medicationValue = medicationName.trim();
    const now = new Date().toISOString();

    try {
      await saveCheckin({
        ...(existingCheckin || {}),
        date,
        flow: flow ?? null,
        symptoms,
        symptomSeverity,
        mood: mood ?? null,
        energy: energy ?? null,
        sleep: sleepDuration ?? null,
        sleepDuration: sleepDuration ?? null,
        sleepQuality: sleepQuality ?? null,
        cravings: cravings ?? null,
        water: water ?? null,
        stress: stress ?? null,
        movement: movementValue || null,
        movementNote: movementValue || null,
        medicationTaken,
        medicationName: medicationTaken === true && medicationValue ? medicationValue : null,
        notes: notes.trim(),
        cycleDay,
        createdAt: existingCheckin?.createdAt || now,
        updatedAt: now,
      });
      navigation.goBack();
    } catch (saveError) {
      setError('Bloom could not save this check-in. Your choices are still here, so you can try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headerOuter}>
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              accessibilityRole='button'
              accessibilityLabel={step === 0 ? 'Close check-in' : 'Go to previous step'}
              style={({ pressed, hovered, focused }) => [
                styles.backButton,
                hovered && styles.iconButtonHovered,
                focused && styles.iconButtonFocused,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={22} color={COLORS.ink} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Daily check-in</Text>
              <Text style={styles.headerDate}>{dateLabel}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View
            style={styles.progress}
            accessible
            accessibilityRole='progressbar'
            accessibilityLabel={`Step ${step + 1} of 3`}
            accessibilityValue={{ min: 1, max: 3, now: step + 1 }}
          >
            {[0, 1, 2].map((item) => (
              <View
                key={item}
                style={[styles.progressSegment, item <= step && styles.progressSegmentActive]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {step === 0 ? (
              <Entrance key='checkin-step-1' duration={220} distance={8} disabled={!hasChangedStep}>
                <View style={styles.intro}>
                  <Text style={styles.stepMeta}>Step 1 of 3</Text>
                  <Text style={styles.title}>How is your body today?</Text>
                  <Text style={styles.subtitle}>
                    Add only what feels useful. Every question can be skipped.
                  </Text>
                </View>

                <Card style={styles.formCard}>
                  <Field title='Bleeding'>
                    <SingleChoiceGroup
                      options={FLOW_OPTIONS}
                      value={flow}
                      onChange={setFlow}
                      label='Bleeding level'
                    />
                  </Field>

                  <Field
                    title='Physical symptoms'
                    description='Choose as many as you want.'
                  >
                    <View
                      style={styles.choiceGrid}
                      accessibilityRole='group'
                      accessibilityLabel='Physical symptoms'
                    >
                      {SYMPTOM_OPTIONS.map((option) => (
                        <ChoiceChip
                          key={option.id}
                          option={option}
                          selected={symptoms.includes(option.id)}
                          multiple
                          onPress={() => toggleSymptom(option.id)}
                        />
                      ))}
                    </View>
                    {['cramps', 'bloating'].filter((id) => symptoms.includes(id)).map((id) => (
                      <SymptomSeverityPicker
                        key={id}
                        symptom={id}
                        value={symptomSeverity[id] || null}
                        onChange={(value) => setSymptomSeverity((current) => ({ ...current, [id]: value }))}
                      />
                    ))}
                  </Field>

                  <Field title='Mood' last>
                    <SingleChoiceGroup
                      options={MOOD_OPTIONS}
                      value={mood}
                      onChange={setMood}
                      label='Mood'
                    />
                  </Field>
                </Card>
              </Entrance>
            ) : null}

            {step === 1 ? (
              <Entrance key='checkin-step-2' duration={220} distance={8} disabled={!hasChangedStep}>
                <View style={styles.intro}>
                  <Text style={styles.stepMeta}>Step 2 of 3</Text>
                  <Text style={styles.title}>Your daily rhythm</Text>
                  <Text style={styles.subtitle}>
                    A few details can help Bloom notice patterns over time.
                  </Text>
                </View>

                <Card style={styles.formCard}>
                  <Field title='Energy' description='From very low to high.'>
                    <SingleChoiceGroup
                      options={ENERGY_OPTIONS}
                      value={energy}
                      onChange={setEnergy}
                      label='Energy level'
                      compact
                    />
                  </Field>

                  <Field title='Sleep duration'>
                    <SingleChoiceGroup
                      options={SLEEP_OPTIONS}
                      value={sleepDuration}
                      onChange={setSleepDuration}
                      label='Sleep duration'
                      compact
                    />
                  </Field>

                  <Field title='Sleep quality'>
                    <SingleChoiceGroup
                      options={SLEEP_QUALITY_OPTIONS}
                      value={sleepQuality}
                      onChange={setSleepQuality}
                      label='Sleep quality'
                      compact
                    />
                  </Field>

                  <Field title='Cravings'>
                    <SingleChoiceGroup
                      options={CRAVING_OPTIONS}
                      value={cravings}
                      onChange={setCravings}
                      label='Cravings'
                      compact
                    />
                  </Field>

                  <Field title='Water'>
                    <SingleChoiceGroup
                      options={WATER_OPTIONS}
                      value={water}
                      onChange={setWater}
                      label='Water today'
                      compact
                    />
                  </Field>

                  <Field title='Stress' description='From very low to very high.'>
                    <SingleChoiceGroup
                      options={STRESS_OPTIONS}
                      value={stress}
                      onChange={setStress}
                      label='Stress level'
                      compact
                    />
                  </Field>

                  <Field title='Movement'>
                    <TextInput
                      style={[
                        styles.textArea,
                        focusedInput === 'movement' && styles.inputFocused,
                      ]}
                      value={movement}
                      onChangeText={setMovement}
                      onFocus={() => setFocusedInput('movement')}
                      onBlur={() => setFocusedInput(null)}
                      multiline
                      maxLength={160}
                      placeholder='A short walk, stretching, rest, or your own activity'
                      placeholderTextColor={COLORS.muted}
                      textAlignVertical='top'
                      accessibilityLabel='Optional movement note'
                    />
                    <Text style={styles.characterCount}>{movement.length}/160</Text>
                  </Field>

                  <Field title='Medicine or supplement taken'>
                    <SingleChoiceGroup
                      options={MEDICATION_OPTIONS}
                      value={medicationTaken}
                      onChange={setMedicationTaken}
                      label='Medicine or supplement taken'
                      compact
                    />
                    {medicationTaken === true ? (
                      <TextInput
                        style={[
                          styles.input,
                          focusedInput === 'medication' && styles.inputFocused,
                        ]}
                        value={medicationName}
                        onChangeText={setMedicationName}
                        onFocus={() => setFocusedInput('medication')}
                        onBlur={() => setFocusedInput(null)}
                        maxLength={80}
                        placeholder='Name, if you want to add it'
                        placeholderTextColor={COLORS.muted}
                        accessibilityLabel='Optional medicine or supplement name'
                      />
                    ) : null}
                  </Field>

                  <Field title='Notes' last>
                    <TextInput
                      style={[
                        styles.textArea,
                        styles.notesArea,
                        focusedInput === 'notes' && styles.inputFocused,
                      ]}
                      value={notes}
                      onChangeText={setNotes}
                      onFocus={() => setFocusedInput('notes')}
                      onBlur={() => setFocusedInput(null)}
                      multiline
                      maxLength={500}
                      placeholder='Anything else you want to remember'
                      placeholderTextColor={COLORS.muted}
                      textAlignVertical='top'
                      accessibilityLabel='Optional check-in notes'
                    />
                    <Text style={styles.characterCount}>{notes.length}/500</Text>
                  </Field>
                </Card>
              </Entrance>
            ) : null}

            {step === 2 ? (
              <Entrance key='checkin-step-3' duration={220} distance={8} disabled={!hasChangedStep}>
                <View style={styles.intro}>
                  <Text style={styles.stepMeta}>Step 3 of 3</Text>
                  <Text style={styles.title}>Review your check-in</Text>
                  <Text style={styles.subtitle}>
                    It is okay to leave things blank. You can edit this day later.
                  </Text>
                </View>

                <Card style={styles.reviewCard}>
                  <View style={styles.reviewHeading}>
                    <View style={styles.reviewIcon}>
                      <Ionicons name='body-outline' size={20} color={COLORS.brand} />
                    </View>
                    <Text style={styles.reviewTitle}>Body and mood</Text>
                  </View>
                  <ReviewRow label='Bleeding' value={optionLabel(FLOW_OPTIONS, flow)} />
                  <ReviewRow
                    label='Symptoms'
                    value={symptoms.length
                      ? symptoms.map((id) => {
                        const severity = symptomSeverity[id];
                        return `${optionLabel(SYMPTOM_OPTIONS, id)}${severity ? ` (${severity})` : ''}`;
                      }).join(', ')
                      : 'Not added'}
                  />
                  <ReviewRow label='Mood' value={optionLabel(MOOD_OPTIONS, mood)} last />
                </Card>

                <Card style={styles.reviewCard}>
                  <View style={styles.reviewHeading}>
                    <View style={[styles.reviewIcon, styles.reviewIconSage]}>
                      <Ionicons name='moon-outline' size={20} color={COLORS.sage} />
                    </View>
                    <Text style={styles.reviewTitle}>Daily rhythm</Text>
                  </View>
                  <ReviewRow
                    label='Energy'
                    value={energy === null ? 'Not added' : `${optionLabel(ENERGY_OPTIONS, energy)} (${energy}/10)`}
                  />
                  <ReviewRow
                    label='Sleep'
                    value={sleepDuration === null ? 'Not added' : optionLabel(SLEEP_OPTIONS, sleepDuration)}
                  />
                  <ReviewRow
                    label='Sleep quality'
                    value={optionLabel(SLEEP_QUALITY_OPTIONS, sleepQuality)}
                  />
                  <ReviewRow label='Cravings' value={optionLabel(CRAVING_OPTIONS, cravings)} />
                  <ReviewRow label='Water' value={optionLabel(WATER_OPTIONS, water)} />
                  <ReviewRow
                    label='Stress'
                    value={stress === null ? 'Not added' : `${optionLabel(STRESS_OPTIONS, stress)} (${stress}/10)`}
                    last
                  />
                </Card>

                <Card style={styles.reviewCard}>
                  <View style={styles.reviewHeading}>
                    <View style={styles.reviewIcon}>
                      <Ionicons name='create-outline' size={20} color={COLORS.brand} />
                    </View>
                    <Text style={styles.reviewTitle}>Your notes</Text>
                  </View>
                  <ReviewRow label='Movement' value={movement.trim() || 'Not added'} />
                  <ReviewRow
                    label='Medicine or supplement'
                    value={
                      medicationTaken === null
                        ? 'Not added'
                        : medicationTaken
                          ? medicationName.trim() || 'Taken'
                          : 'Not today'
                    }
                  />
                  <ReviewRow label='Notes' value={notes.trim() || 'Not added'} last />
                </Card>

                <View style={styles.privateNote}>
                  <Ionicons name='lock-closed-outline' size={18} color={COLORS.sage} />
                  <Text style={styles.privateNoteText}>
                    This check-in is stored in your Bloom account. Bloom uses it for personal
                    observations, not diagnosis.
                  </Text>
                </View>
              </Entrance>
            ) : null}

            {error ? (
              <Entrance duration={180} distance={6}>
                <View style={styles.error} accessibilityRole='alert' accessibilityLiveRegion='assertive'>
                  <Ionicons name='alert-circle-outline' size={20} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </Entrance>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footerOuter}>
          <View style={styles.footer}>
            {step < 2 ? (
              <Button
                title='Continue'
                icon='arrow-forward'
                onPress={() => {
                  setError('');
                  setHasChangedStep(true);
                  setStep((current) => current + 1);
                }}
              />
            ) : (
              <Button
                title={existingCheckin ? 'Save changes' : 'Save check-in'}
                icon='checkmark-circle-outline'
                onPress={handleSave}
                loading={saving}
              />
            )}
            <Button
              title={step === 0 ? 'Cancel' : 'Back'}
              variant='ghost'
              onPress={handleBack}
              disabled={saving}
              style={styles.secondaryAction}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
  },
  keyboardView: {
    flex: 1,
    minHeight: 0,
  },
  headerOuter: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
    backgroundColor: COLORS.canvas,
  },
  header: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    minHeight: 66,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  backButton: {
    width: 48,
    height: 48,
    marginLeft: -8,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: COLORS.ink,
  },
  headerDate: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  progress: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: 12,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.hairline,
  },
  progressSegmentActive: {
    backgroundColor: COLORS.brand,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  intro: {
    paddingTop: 26,
    paddingBottom: 20,
  },
  stepMeta: {
    marginBottom: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    letterSpacing: -0.45,
    color: COLORS.ink,
  },
  subtitle: {
    maxWidth: 560,
    marginTop: 7,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
  },
  formCard: {
    padding: 20,
  },
  field: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  fieldLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  fieldHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
  },
  optional: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
  },
  fieldDescription: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  fieldControl: {
    marginTop: 13,
  },
  severityBlock: {
    marginTop: 14,
    padding: 14,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  severityTitle: {
    marginBottom: 9,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.body,
  },
  severityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  severityOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
  },
  severityOptionSelected: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
  },
  severityOptionText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: COLORS.body,
  },
  severityOptionTextSelected: {
    color: COLORS.brand,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minWidth: 138,
    minHeight: 48,
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
  },
  choiceCompact: {
    minWidth: 104,
    flexBasis: '20%',
  },
  choiceSelected: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
  },
  choiceHovered: {
    borderColor: '#D2D2CE',
    backgroundColor: COLORS.surfaceSoft,
  },
  interactiveFocused: {
    borderColor: COLORS.brand,
  },
  iconButtonHovered: {
    backgroundColor: COLORS.surfaceSoft,
  },
  iconButtonFocused: {
    backgroundColor: COLORS.brandSoft,
  },
  choiceText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.body,
    textAlign: 'center',
  },
  choiceTextSelected: {
    color: COLORS.brand,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.98 }],
  },
  input: {
    minHeight: 52,
    marginTop: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  inputFocused: {
    borderColor: COLORS.brand,
  },
  textArea: {
    minHeight: 94,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  notesArea: {
    minHeight: 116,
  },
  characterCount: {
    marginTop: 5,
    alignSelf: 'flex-end',
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.muted,
  },
  reviewCard: {
    marginBottom: 12,
  },
  reviewHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 8,
  },
  reviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  reviewIconSage: {
    backgroundColor: COLORS.sageLight,
  },
  reviewTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    color: COLORS.ink,
  },
  reviewRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  reviewRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  reviewLabel: {
    flex: 0.38,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  reviewValue: {
    flex: 0.62,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.ink,
    textAlign: 'right',
  },
  reviewValueEmpty: {
    fontWeight: '400',
    color: COLORS.muted,
  },
  privateNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  privateNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  error: {
    marginTop: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
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
  footerOuter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
    backgroundColor: COLORS.canvas,
  },
  footer: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: 12,
    paddingBottom: 8,
  },
  secondaryAction: {
    marginTop: 2,
  },
});
