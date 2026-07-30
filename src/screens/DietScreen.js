import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import {
  INGREDIENT_CATALOG,
  DEFAULT_DIET_PROFILE,
  normalizeDietProfile,
  buildDietSuggestions,
  buildDietObservations,
} from '../services/dietSuggestions';
import { localDateKey } from '../utils/dateKey';
import { COLORS, LAYOUT, TYPOGRAPHY, WEB_FOCUS } from '../utils/constants';
import Button from '../components/Button';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';

const EATING_OPTIONS = [
  { id: 'no_preference', label: 'No preference' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'egg_inclusive_vegetarian', label: 'Egg-inclusive vegetarian' },
  { id: 'non_vegetarian', label: 'Non-vegetarian' },
  { id: 'vegan', label: 'Vegan where practical' },
];

const COOKING_OPTIONS = [
  { id: 'no_cooking', label: 'No cooking' },
  { id: 'hostel_basic', label: 'Hostel / basic setup' },
  { id: 'kettle_only', label: 'Kettle only' },
  { id: 'basic_kitchen', label: 'Basic kitchen' },
  { id: 'full_kitchen', label: 'Full kitchen' },
];

const TIME_OPTIONS = [
  { id: 'under_5_minutes', label: 'Under 5 minutes' },
  { id: 'under_15_minutes', label: 'Under 15 minutes' },
  { id: 'under_30_minutes', label: 'Under 30 minutes' },
];

const BUDGET_OPTIONS = [
  { id: 'low_cost', label: 'Low-cost' },
  { id: 'regular', label: 'Regular' },
  { id: 'flexible', label: 'Flexible' },
];

const GOAL_OPTIONS = [
  { id: 'steadier_energy', label: 'Steadier energy' },
  { id: 'feel_full_longer', label: 'Feel full longer' },
  { id: 'reduce_skipped_meals', label: 'Reduce skipped meals' },
  { id: 'support_regular_eating', label: 'Support regular eating' },
  { id: 'notice_digestive_comfort', label: 'Notice digestive comfort' },
  { id: 'build_balanced_meals', label: 'Build balanced meals' },
];

const REFLECTION_OPTIONS = [
  { id: 'steady_energy', label: 'Energy felt steady' },
  { id: 'hungry_quickly', label: 'Became hungry quickly' },
  { id: 'comfortably_full', label: 'Felt comfortably full' },
  { id: 'sleepy', label: 'Felt sleepy' },
  { id: 'bloating', label: 'Experienced bloating' },
  { id: 'cravings', label: 'Experienced cravings' },
  { id: 'comfortable', label: 'Felt comfortable' },
  { id: 'prefer_not_to_answer', label: 'Prefer not to answer' },
];

const PROFILE_LIST_FIELDS = [
  { key: 'allergies', label: 'Allergies', placeholder: 'For example, peanuts, milk' },
  { key: 'intolerances', label: 'Intolerances', placeholder: 'For example, lactose' },
  { key: 'dislikedFoods', label: 'Foods you dislike', placeholder: 'Add any foods you avoid' },
  { key: 'religiousExclusions', label: 'Religious exclusions', placeholder: 'Optional' },
  { key: 'culturalExclusions', label: 'Other cultural preferences', placeholder: 'Optional' },
];

function asList(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function titleCase(value) {
  return String(value || '')
    .replace(/^custom:/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CATALOG = (Array.isArray(INGREDIENT_CATALOG)
  ? INGREDIENT_CATALOG
  : Object.values(INGREDIENT_CATALOG || {}))
  .map((item) => {
    const source = typeof item === 'string' ? { id: item, label: titleCase(item) } : item;
    const id = String(source.id || source.key || source.label || source.name || '').trim();
    return { ...source, id, label: String(source.label || source.name || titleCase(id)) };
  })
  .filter((item) => item.id);
const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));

function normalizeScreenProfile(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  let safetyProfile;
  try {
    safetyProfile = normalizeDietProfile({ ...DEFAULT_DIET_PROFILE, ...source });
  } catch {
    safetyProfile = { ...DEFAULT_DIET_PROFILE, ...source };
  }
  return {
    ...safetyProfile,
    recentIngredients: asList(source.recentIngredients),
    favouriteIngredients: asList(source.favouriteIngredients || source.favoriteIngredients),
    savedSuggestions: Array.isArray(source.savedSuggestions) ? source.savedSuggestions.filter(Boolean) : [],
    dismissedObservationIds: asList(source.dismissedObservationIds),
    deletedMealIds: asList(source.deletedMealIds).slice(0, 100),
  };
}

function toProfileDraft(profile) {
  return {
    ...profile,
    eatingPreference: profile.eatingPreference || 'vegetarian',
    cookingSetup: profile.cookingSetup || 'hostel_basic',
    timeAvailable: profile.timeAvailable || 'under_15_minutes',
    budget: profile.budget || 'regular',
    goals: asList(profile.goals),
    ...Object.fromEntries(PROFILE_LIST_FIELDS.map(({ key }) => [
      `${key}Text`,
      asList(profile[key]).join(', '),
    ])),
  };
}

function fromProfileDraft(draft, currentProfile) {
  return normalizeScreenProfile({
    ...currentProfile,
    eatingPreference: draft.eatingPreference,
    cookingSetup: draft.cookingSetup,
    timeAvailable: draft.timeAvailable,
    budget: draft.budget,
    goals: asList(draft.goals),
    ...Object.fromEntries(PROFILE_LIST_FIELDS.map(({ key }) => [key, asList(draft[`${key}Text`])])),
  });
}

function ingredientLabel(value) {
  return CATALOG_BY_ID.get(String(value || ''))?.label || titleCase(value);
}

function suggestionName(value) {
  return value?.name || value?.mealName || value?.title || 'Meal idea';
}

function suggestionId(value) {
  return value?.id || `${value?.type || 'meal'}-${suggestionName(value).toLowerCase().replace(/\W+/g, '-')}`;
}

function suggestionUsedIngredients(value) {
  return asList(value?.usedIngredients || value?.selectedIngredientsUsed || value?.ingredientsUsed || value?.ingredients);
}

function suggestionMissingIngredients(value) {
  return asList(value?.optionalMissingIngredient || value?.missingIngredient || value?.missingIngredients);
}

function suggestionSubstitutions(value) {
  const raw = value?.substitutions;
  if (!Array.isArray(raw)) return asList(raw);
  return raw.map((item) => {
    if (typeof item === 'string') return item;
    if (item?.from && item?.to) return `${item.from}: ${item.to}`;
    return item?.label || item?.text || '';
  }).filter(Boolean);
}

function suggestionSteps(value) {
  return asList(value?.steps || value?.preparationSteps);
}

function suggestionTypeLabel(value) {
  const type = value?.label || value?.type || value?.suggestionType;
  const labels = {
    quickest: 'Quickest',
    most_filling: 'Most filling',
    lowest_effort_cost: 'Lowest effort / cost',
    lowest_effort: 'Lowest effort / cost',
    lowest_cost: 'Lowest effort / cost',
  };
  return labels[type] || titleCase(type || 'Meal idea');
}

function suggestionTime(value) {
  const minutes = Number(value?.prepMinutes ?? value?.timeMinutes);
  if (Number.isFinite(minutes) && minutes > 0) return `About ${minutes} min`;
  return value?.preparationTime || value?.time || 'A few minutes';
}

function mealName(meal) {
  return meal?.name || meal?.mealName || 'Meal';
}

function dateLabel(value) {
  const parsed = parseISO(value || '');
  return isValid(parsed) ? format(parsed, 'd MMM yyyy') : value || 'Date unavailable';
}

function createMealId() {
  return `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getMealReflection(meal) {
  return meal?.reflection?.outcome || meal?.afterMealReflection || meal?.reflectionOutcome || null;
}

function reflectionLabel(value) {
  return REFLECTION_OPTIONS.find((item) => item.id === value)?.label || titleCase(value);
}

function asObservationResult(value) {
  if (!value || typeof value !== 'object') {
    return {
      status: 'insufficient_data',
      sampleSize: 0,
      minimumSampleSize: 5,
      observations: [],
      message: 'Log and reflect on a few meals to begin noticing descriptive patterns.',
    };
  }
  return {
    status: value.status || (value.observations?.length ? 'ready' : 'insufficient_data'),
    sampleSize: Number(value.sampleSize) || 0,
    minimumSampleSize: Number(value.minimumSampleSize) || 5,
    observations: Array.isArray(value.observations) ? value.observations : [],
    message: value.message || 'Log and reflect on a few meals to begin noticing descriptive patterns.',
  };
}

function ChoiceChip({ label, selected, onPress, role = 'radio' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={({ pressed, hovered, focused }) => [
        styles.choiceChip,
        selected && styles.choiceChipSelected,
        hovered && !selected && styles.controlHovered,
        focused && styles.focusedControl,
        pressed && styles.pressed,
      ]}
    >
      {selected ? <Ionicons name='checkmark' size={16} color={COLORS.brand} /> : null}
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Notice({ notice }) {
  if (!notice) return null;
  const icon = notice.type === 'error' ? 'alert-circle-outline' : notice.type === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  const color = notice.type === 'error' ? COLORS.error : notice.type === 'success' ? COLORS.sage : COLORS.brand;
  return (
    <View accessibilityLiveRegion='polite' style={[styles.notice, notice.type === 'error' && styles.noticeError, notice.type === 'success' && styles.noticeSuccess]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.noticeText, notice.type === 'error' && styles.noticeErrorText]}>{notice.text}</Text>
    </View>
  );
}

function LoadingDiet() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.loading} accessibilityLabel='Loading Diet' accessibilityRole='progressbar'>
        <View style={[styles.skeleton, styles.skeletonTitle]} />
        <View style={[styles.skeleton, styles.skeletonIntro]} />
        <View style={[styles.skeleton, styles.skeletonCard]} />
        <Text style={styles.loadingText}>Loading your Diet space…</Text>
      </View>
    </SafeAreaView>
  );
}

export default function DietScreen() {
  const { state, saveMeal, deleteMeal, saveSettings } = useApp();
  const initialProfile = normalizeScreenProfile(DEFAULT_DIET_PROFILE);
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(() => toProfileDraft(initialProfile));
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [reflectionMealId, setReflectionMealId] = useState(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);

  useEffect(() => {
    if (!state.isLoading) return;
    const emptyProfile = normalizeScreenProfile(DEFAULT_DIET_PROFILE);
    setProfile(emptyProfile);
    setDraft(toProfileDraft(emptyProfile));
    setSelectedIngredients([]);
    setQuery('');
    setSuggestions([]);
    setNotice(null);
    setReflectionMealId(null);
    setDeleteCandidateId(null);
  }, [state.isLoading]);

  useEffect(() => {
    if (state.isLoading) return;
    const stored = state.settings?.dietProfile || {};
    const compatiblePreference = stored.eatingPreference
      || state.settings?.dietaryPreference
      || DEFAULT_DIET_PROFILE.eatingPreference;
    const next = normalizeScreenProfile({ ...stored, eatingPreference: compatiblePreference });
    setProfile(next);
    if (!profileOpen) setDraft(toProfileDraft(next));
  }, [
    profileOpen,
    state.isLoading,
    state.settings?.dietProfile,
    state.settings?.dietaryPreference,
  ]);

  const filteredIngredients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return CATALOG.slice(0, 18);
    return CATALOG.filter((item) => (
      `${item.label} ${(item.aliases || []).join(' ')}`.toLowerCase().includes(term)
    )).slice(0, 18);
  }, [query]);

  const recentIngredients = useMemo(
    () => asList(profile.recentIngredients).filter((item) => !selectedIngredients.includes(item)).slice(0, 10),
    [profile.recentIngredients, selectedIngredients]
  );

  const favouriteIngredients = useMemo(
    () => asList(profile.favouriteIngredients).slice(0, 12),
    [profile.favouriteIngredients]
  );

  const history = useMemo(
    () => [...(Array.isArray(state.meals) ? state.meals : [])]
      .sort((a, b) => `${b.date || ''}${b.updatedAt || b.timestamp || ''}`.localeCompare(
        `${a.date || ''}${a.updatedAt || a.timestamp || ''}`
      )),
    [state.meals]
  );

  const reflections = useMemo(
    () => history.map((meal) => {
      const outcome = getMealReflection(meal);
      if (!outcome) return null;
      return {
        id: `reflection-${meal.id}`,
        mealId: meal.id,
        outcome,
        createdAt: meal.reflection?.recordedAt || meal.reflectionUpdatedAt || meal.updatedAt,
      };
    }).filter(Boolean),
    [history]
  );

  const observationResult = useMemo(() => {
    try {
      return asObservationResult(buildDietObservations(
        history,
        reflections,
        { dismissedObservationIds: profile.dismissedObservationIds }
      ));
    } catch {
      return asObservationResult(null);
    }
  }, [history, profile.dismissedObservationIds, reflections]);

  const visibleObservations = observationResult.observations.filter(
    (item) => !profile.dismissedObservationIds.includes(item.id)
  );

  async function persistProfile(nextProfile, successText) {
    const previous = profile;
    const normalized = normalizeScreenProfile(nextProfile);
    setProfile(normalized);
    try {
      await saveSettings({ dietProfile: normalized });
      if (successText) setNotice({ type: 'success', text: successText });
      return normalized;
    } catch {
      setProfile(previous);
      setNotice({
        type: 'error',
        text: 'This Diet preference could not be saved. Your choices are still visible so you can try again.',
      });
      throw new Error('Diet profile save failed.');
    }
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleDraftGoal(id) {
    setDraft((current) => {
      const goals = asList(current.goals);
      return {
        ...current,
        goals: goals.includes(id) ? goals.filter((item) => item !== id) : [...goals, id],
      };
    });
  }

  async function savePreferences() {
    if (busyAction) return;
    setBusyAction('preferences');
    setNotice(null);
    try {
      const next = fromProfileDraft(draft, profile);
      await persistProfile(next, 'Diet preferences saved on this device.');
      setDraft(toProfileDraft(next));
      setProfileOpen(false);
    } catch {
      // The inline notice retains the draft for another attempt.
    } finally {
      setBusyAction(null);
    }
  }

  function toggleIngredient(id) {
    setSelectedIngredients((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
    setSuggestions([]);
    setNotice(null);
  }

  function addFreeTextIngredient() {
    const value = query.trim().toLowerCase();
    if (!value) return;
    const exact = CATALOG.find((item) => (
      item.id.toLowerCase() === value || item.label.toLowerCase() === value
    ));
    const id = exact?.id || value;
    setSelectedIngredients((current) => current.includes(id) ? current : [...current, id]);
    setQuery('');
    setSuggestions([]);
    setNotice(null);
  }

  async function toggleFavouriteIngredient(id) {
    if (busyAction) return;
    const previous = profile;
    const favourites = asList(profile.favouriteIngredients);
    const next = normalizeScreenProfile({
      ...profile,
      favouriteIngredients: favourites.includes(id)
        ? favourites.filter((item) => item !== id)
        : [id, ...favourites].slice(0, 20),
    });
    setBusyAction(`favourite-${id}`);
    try {
      await persistProfile(next);
    } catch {
      setProfile(previous);
    } finally {
      setBusyAction(null);
    }
  }

  async function generateSuggestions() {
    if (!selectedIngredients.length || busyAction) {
      if (!selectedIngredients.length) {
        setNotice({ type: 'error', text: 'Choose at least one available ingredient first.' });
      }
      return;
    }
    setBusyAction('suggestions');
    setNotice(null);
    try {
      const catalogIngredients = selectedIngredients.filter((item) => CATALOG_BY_ID.has(item));
      const customIngredients = selectedIngredients.filter((item) => !CATALOG_BY_ID.has(item));
      const result = buildDietSuggestions({ ingredients: catalogIngredients, customIngredients, profile });
      const nextSuggestions = Array.isArray(result) ? result : result?.suggestions;
      if (!Array.isArray(nextSuggestions) || nextSuggestions.length !== 3) {
        throw new Error('Bloom could not build all three meal ideas.');
      }
      setSuggestions(nextSuggestions);
      const nextProfile = normalizeScreenProfile({
        ...profile,
        recentIngredients: [
          ...selectedIngredients,
          ...asList(profile.recentIngredients).filter((item) => !selectedIngredients.includes(item)),
        ].slice(0, 20),
      });
      try {
        await persistProfile(nextProfile);
      } catch {
        setNotice({
          type: 'info',
          text: 'Your three ideas are ready. Bloom could not update recent ingredients this time.',
        });
      }
    } catch {
      setSuggestions([]);
      setNotice({
        type: 'error',
        text: 'Bloom could not prepare meal ideas just now. Your selected ingredients are still here.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveSuggestion(suggestion) {
    if (busyAction) return;
    const id = suggestionId(suggestion);
    const saved = { ...suggestion, id, savedAt: new Date().toISOString() };
    const current = Array.isArray(profile.savedSuggestions) ? profile.savedSuggestions : [];
    const next = normalizeScreenProfile({
      ...profile,
      savedSuggestions: [saved, ...current.filter((item) => suggestionId(item) !== id)].slice(0, 20),
    });
    setBusyAction(`save-${id}`);
    setNotice(null);
    try {
      await persistProfile(next, `${suggestionName(suggestion)} saved for later.`);
    } catch {
      // persistProfile provides the error state.
    } finally {
      setBusyAction(null);
    }
  }

  async function removeSavedSuggestion(suggestion) {
    if (busyAction) return;
    const id = suggestionId(suggestion);
    const next = normalizeScreenProfile({
      ...profile,
      savedSuggestions: profile.savedSuggestions.filter((item) => suggestionId(item) !== id),
    });
    setBusyAction(`remove-${id}`);
    try {
      await persistProfile(next, 'Saved meal idea removed.');
    } catch {
      // persistProfile provides the error state.
    } finally {
      setBusyAction(null);
    }
  }

  async function logSuggestion(suggestion) {
    if (busyAction) return;
    const now = new Date().toISOString();
    const id = createMealId();
    const meal = {
      id,
      mealId: id,
      timestamp: now,
      date: localDateKey(),
      name: suggestionName(suggestion),
      ingredients: suggestionUsedIngredients(suggestion),
      selectedSuggestionType: suggestion.type || null,
      suggestionType: suggestion.type || null,
      suggestionSource: suggestion.source || 'local',
      source: 'diet_suggestion',
      hungerBefore: null,
      symptoms: [],
      notes: '',
      cycleContextReference: {
        cycleDay: state.currentCycleDay || null,
        phase: state.currentPhase?.label || state.currentPhase?.phase || null,
      },
      creationPlatform: Platform.OS,
      schemaVersion: 1,
      createdAt: now,
    };
    setBusyAction(`eat-${suggestionId(suggestion)}`);
    setNotice(null);
    try {
      await saveMeal(meal);
      setReflectionMealId(id);
      setNotice({
        type: 'success',
        text: `${meal.name} was added to meal history. The reflection below is optional.`,
      });
    } catch {
      setNotice({
        type: 'error',
        text: 'This meal could not be saved. The suggestion is still here so you can try again.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveReflection(mealId, outcome) {
    if (busyAction) return;
    const meal = history.find((item) => item.id === mealId);
    if (!meal) {
      setNotice({ type: 'error', text: 'Bloom could not find that meal. Please reopen Diet and try again.' });
      return;
    }
    const now = new Date().toISOString();
    setBusyAction(`reflection-${mealId}`);
    setNotice(null);
    try {
      await saveMeal({
        ...meal,
        afterMealReflection: outcome,
        reflection: { outcome, recordedAt: now },
        reflectionUpdatedAt: now,
      });
      setReflectionMealId(null);
      setNotice({
        type: 'success',
        text: outcome === 'prefer_not_to_answer' ? 'No reflection added.' : 'Reflection saved.',
      });
    } catch {
      setNotice({
        type: 'error',
        text: 'This reflection could not be saved. You can choose it again when ready.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteMeal(id) {
    if (busyAction) return;
    setBusyAction(`delete-${id}`);
    setNotice(null);
    try {
      await deleteMeal(id);
      setDeleteCandidateId(null);
      if (reflectionMealId === id) setReflectionMealId(null);
      setNotice({ type: 'success', text: 'Meal deleted. Diet observations have been recalculated.' });
    } catch {
      setNotice({ type: 'error', text: 'This meal could not be deleted. Please try again.' });
    } finally {
      setBusyAction(null);
    }
  }

  function requestDeleteMeal(meal) {
    const label = mealName(meal);
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(`Delete ${label} from meal history?`)) handleDeleteMeal(meal.id);
      return;
    }
    if (Platform.OS === 'web') {
      setDeleteCandidateId(meal.id);
      return;
    }
    Alert.alert(
      'Delete meal?',
      `${label} will be removed from this device. Related observations will be recalculated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteMeal(meal.id) },
      ]
    );
  }

  async function dismissObservation(id) {
    if (!id || busyAction) return;
    const next = normalizeScreenProfile({
      ...profile,
      dismissedObservationIds: [...new Set([...profile.dismissedObservationIds, id])],
    });
    setBusyAction(`observation-${id}`);
    try {
      await persistProfile(next, 'Observation dismissed.');
    } catch {
      // persistProfile provides the error state.
    } finally {
      setBusyAction(null);
    }
  }

  if (state.isLoading) return <LoadingDiet />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator
        >
          <View style={styles.content}>
            <ScreenHeader
              title='Diet'
              subtitle='Practical meal ideas from what you already have.'
              animated={false}
              style={styles.header}
            />

            <View style={styles.warmIntro}>
              <View style={styles.introIcon} accessibilityElementsHidden>
                <Ionicons name='nutrition-outline' size={24} color={COLORS.brand} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.introTitle}>Use what is available</Text>
                <Text style={styles.introText}>
                  Choose a few foods and Bloom will make three affordable, Indian-context friendly ideas.
                  No calories, food scores, or pressure.
                </Text>
              </View>
            </View>

            <Notice notice={notice || (state.lastError ? { type: 'error', text: state.lastError } : null)} />

            <View style={styles.section}>
              <Card style={styles.availableCard}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.flex}>
                    <Text accessibilityRole='header' style={styles.sectionTitle}>What food is available?</Text>
                    <Text style={styles.sectionSubtitle}>You do not need to add spices or every condiment.</Text>
                  </View>
                  <Pressable
                    onPress={() => setProfileOpen((value) => !value)}
                    accessibilityRole='button'
                    accessibilityLabel={profileOpen ? 'Close Diet preferences' : 'Open Diet preferences'}
                    accessibilityState={{ expanded: profileOpen }}
                    style={({ pressed, hovered, focused }) => [
                      styles.preferenceButton,
                      hovered && styles.controlHovered,
                      focused && styles.focusedControl,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name='options-outline' size={18} color={COLORS.brand} />
                    <Text style={styles.preferenceButtonText}>Preferences</Text>
                  </Pressable>
                </View>

                {profileOpen ? (
                  <View style={styles.preferences} accessibilityLabel='Optional Diet preferences'>
                    <Text style={styles.preferenceIntro}>
                      Everything here is optional. Bloom uses these choices only to filter practical ideas.
                    </Text>
                    <PreferenceGroup
                      title='Eating preference'
                      options={EATING_OPTIONS}
                      selected={draft.eatingPreference}
                      onSelect={(value) => updateDraft('eatingPreference', value)}
                    />
                    <PreferenceGroup
                      title='Cooking setup'
                      options={COOKING_OPTIONS}
                      selected={draft.cookingSetup}
                      onSelect={(value) => updateDraft('cookingSetup', value)}
                    />
                    <PreferenceGroup
                      title='Time available'
                      options={TIME_OPTIONS}
                      selected={draft.timeAvailable}
                      onSelect={(value) => updateDraft('timeAvailable', value)}
                    />
                    <PreferenceGroup
                      title='Budget'
                      options={BUDGET_OPTIONS}
                      selected={draft.budget}
                      onSelect={(value) => updateDraft('budget', value)}
                    />

                    <View style={styles.preferenceGroup}>
                      <Text style={styles.fieldLabel}>What would you like meals to support?</Text>
                      <View style={styles.chipWrap}>
                        {GOAL_OPTIONS.map((option) => (
                          <ChoiceChip
                            key={option.id}
                            label={option.label}
                            role='checkbox'
                            selected={draft.goals.includes(option.id)}
                            onPress={() => toggleDraftGoal(option.id)}
                          />
                        ))}
                      </View>
                    </View>

                    {PROFILE_LIST_FIELDS.map((field) => (
                      <View key={field.key} style={styles.textField}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <TextInput
                          value={draft[`${field.key}Text`]}
                          onChangeText={(value) => updateDraft(`${field.key}Text`, value)}
                          placeholder={field.placeholder}
                          placeholderTextColor={COLORS.muted}
                          accessibilityLabel={`${field.label}, separated by commas`}
                          autoCapitalize='sentences'
                          maxLength={180}
                          style={styles.input}
                        />
                      </View>
                    ))}

                    <View style={styles.profileActions}>
                      <Button
                        title='Save preferences'
                        onPress={savePreferences}
                        loading={busyAction === 'preferences'}
                        style={styles.flexButton}
                      />
                      <Button
                        title='Cancel'
                        variant='secondary'
                        onPress={() => {
                          setDraft(toProfileDraft(profile));
                          setProfileOpen(false);
                        }}
                        disabled={busyAction === 'preferences'}
                        style={styles.flexButton}
                      />
                    </View>
                  </View>
                ) : null}

                <View style={styles.searchBox}>
                  <Ionicons name='search-outline' size={20} color={COLORS.muted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={addFreeTextIngredient}
                    placeholder='Search rice, dal, eggs, fruit…'
                    placeholderTextColor={COLORS.muted}
                    accessibilityLabel='Search or add an available ingredient'
                    returnKeyType='done'
                    maxLength={50}
                    style={styles.searchInput}
                  />
                  {query ? (
                    <Pressable
                      onPress={() => setQuery('')}
                      accessibilityRole='button'
                      accessibilityLabel='Clear ingredient search'
                      hitSlop={4}
                      style={({ pressed, focused }) => [
                        styles.iconButton,
                        focused && styles.focusedControl,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons name='close' size={20} color={COLORS.muted} />
                    </Pressable>
                  ) : null}
                </View>

                {query.trim() ? (
                  <Pressable
                    onPress={addFreeTextIngredient}
                    accessibilityRole='button'
                    accessibilityLabel={`Add ${query.trim()} as an ingredient`}
                    style={({ pressed, hovered, focused }) => [
                      styles.addCustom,
                      hovered && styles.controlHovered,
                      focused && styles.focusedControl,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name='add-circle-outline' size={20} color={COLORS.brand} />
                    <Text numberOfLines={2} style={styles.addCustomText}>
                      Add “{query.trim()}” {filteredIngredients.length ? 'or choose a match below' : ''}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.ingredientGrid} accessibilityLabel='Ingredient choices'>
                  {filteredIngredients.map((ingredient) => (
                    <ChoiceChip
                      key={ingredient.id}
                      label={ingredient.label}
                      role='checkbox'
                      selected={selectedIngredients.includes(ingredient.id)}
                      onPress={() => toggleIngredient(ingredient.id)}
                    />
                  ))}
                </View>

                {favouriteIngredients.length ? (
                  <IngredientShortcuts
                    title='Favourites'
                    icon='heart'
                    ingredients={favouriteIngredients}
                    onSelect={toggleIngredient}
                    selected={selectedIngredients}
                  />
                ) : null}

                {recentIngredients.length ? (
                  <IngredientShortcuts
                    title='Recent'
                    icon='time-outline'
                    ingredients={recentIngredients}
                    onSelect={toggleIngredient}
                    selected={selectedIngredients}
                  />
                ) : null}

                <View style={styles.selectedHeader}>
                  <Text style={styles.fieldLabel}>Selected ({selectedIngredients.length})</Text>
                  {selectedIngredients.length ? (
                    <Pressable
                      onPress={() => {
                        setSelectedIngredients([]);
                        setSuggestions([]);
                        setNotice(null);
                      }}
                      accessibilityRole='button'
                      accessibilityLabel='Clear all selected ingredients'
                      style={({ pressed, hovered, focused }) => [
                        styles.textButton,
                        hovered && styles.controlHovered,
                        focused && styles.focusedControl,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.textButtonLabel}>Clear all</Text>
                    </Pressable>
                  ) : null}
                </View>

                {selectedIngredients.length ? (
                  <View style={styles.selectedList}>
                    {selectedIngredients.map((id) => {
                      const favourite = favouriteIngredients.includes(id);
                      return (
                        <View key={id} style={styles.selectedPill}>
                          <Text numberOfLines={2} style={styles.selectedPillText}>{ingredientLabel(id)}</Text>
                          <Pressable
                            onPress={() => toggleFavouriteIngredient(id)}
                            disabled={busyAction === `favourite-${id}`}
                            accessibilityRole='button'
                            accessibilityLabel={favourite ? `Remove ${ingredientLabel(id)} from favourites` : `Save ${ingredientLabel(id)} as a favourite`}
                            accessibilityState={{ disabled: busyAction === `favourite-${id}` }}
                            style={({ pressed, focused }) => [
                              styles.selectedIconButton,
                              focused && styles.focusedControl,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Ionicons name={favourite ? 'heart' : 'heart-outline'} size={18} color={favourite ? COLORS.brand : COLORS.muted} />
                          </Pressable>
                          <Pressable
                            onPress={() => toggleIngredient(id)}
                            accessibilityRole='button'
                            accessibilityLabel={`Remove ${ingredientLabel(id)}`}
                            style={({ pressed, focused }) => [styles.selectedIconButton, focused && styles.focusedControl, pressed && styles.pressed]}
                          >
                            <Ionicons name='close' size={19} color={COLORS.ink} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.ingredientEmpty}>
                    <Ionicons name='basket-outline' size={22} color={COLORS.sage} />
                    <Text style={styles.ingredientEmptyText}>
                      Start with one food. Bloom can still make a simple suggestion.
                    </Text>
                  </View>
                )}

                <Button
                  title='Show 3 meal ideas'
                  icon='sparkles-outline'
                  onPress={generateSuggestions}
                  disabled={!selectedIngredients.length}
                  loading={busyAction === 'suggestions'}
                  loadingLabel='Preparing ideas…'
                  style={styles.generateButton}
                />
              </Card>
            </View>

            <View style={styles.section}>
              <Text accessibilityRole='header' style={styles.sectionTitle}>Three practical options</Text>
              <Text style={styles.sectionSubtitle}>
                Built on this device, so suggestions still work when Meg or the Diet backend is unavailable.
              </Text>

              {suggestions.length === 3 ? suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestionId(suggestion)}
                  suggestion={suggestion}
                  isSaved={profile.savedSuggestions.some((item) => suggestionId(item) === suggestionId(suggestion))}
                  saving={busyAction === `save-${suggestionId(suggestion)}`}
                  logging={busyAction === `eat-${suggestionId(suggestion)}`}
                  onSave={() => saveSuggestion(suggestion)}
                  onEat={() => logSuggestion(suggestion)}
                />
              )) : (
                <View style={styles.suggestionEmpty}>
                  <Ionicons name='restaurant-outline' size={26} color={COLORS.brand} />
                  <Text style={styles.emptyTitle}>Your three ideas will appear here</Text>
                  <Text style={styles.emptyText}>
                    Choose what is available, then tap “Show 3 meal ideas”. There is no perfect selection.
                  </Text>
                </View>
              )}

              <View style={styles.allergyNote}>
                <Ionicons name='shield-checkmark-outline' size={19} color={COLORS.warning} />
                <Text style={styles.allergyNoteText}>
                  Always check labels and preparation for your own allergies or intolerances. Bloom cannot verify ingredients or cross-contact.
                </Text>
              </View>
            </View>

            {reflectionMealId ? (
              <ReflectionSection
                meal={history.find((item) => item.id === reflectionMealId)}
                busy={busyAction === `reflection-${reflectionMealId}`}
                onChoose={(outcome) => saveReflection(reflectionMealId, outcome)}
                onClose={() => setReflectionMealId(null)}
              />
            ) : null}

            <View style={styles.section}>
              <Text accessibilityRole='header' style={styles.sectionTitle}>Saved meal ideas</Text>
              <Text style={styles.sectionSubtitle}>Keep useful combinations nearby for another day.</Text>
              {profile.savedSuggestions.length ? (
                <View style={styles.openList}>
                  {profile.savedSuggestions.map((suggestion, index) => (
                    <View key={suggestionId(suggestion)} style={[styles.savedRow, index === profile.savedSuggestions.length - 1 && styles.openListLast]}>
                      <View style={styles.flex}>
                        <Text style={styles.savedName}>{suggestionName(suggestion)}</Text>
                        <Text style={styles.savedMeta}>{suggestionTypeLabel(suggestion)} · {suggestionTime(suggestion)}</Text>
                      </View>
                      <View style={styles.rowActions}>
                        <Pressable
                          onPress={() => logSuggestion(suggestion)}
                          accessibilityRole='button'
                          accessibilityLabel={`Log ${suggestionName(suggestion)} as eaten`}
                          style={({ pressed, hovered, focused }) => [styles.rowAction, hovered && styles.controlHovered, focused && styles.focusedControl, pressed && styles.pressed]}
                        >
                          <Ionicons name='checkmark-circle-outline' size={19} color={COLORS.sage} />
                        </Pressable>
                        <Pressable
                          onPress={() => removeSavedSuggestion(suggestion)}
                          accessibilityRole='button'
                          accessibilityLabel={`Remove saved idea ${suggestionName(suggestion)}`}
                          style={({ pressed, hovered, focused }) => [styles.rowAction, hovered && styles.controlHovered, focused && styles.focusedControl, pressed && styles.pressed]}
                        >
                          <Ionicons name='trash-outline' size={18} color={COLORS.muted} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.compactEmpty}>
                  <Text style={styles.compactEmptyText}>No saved ideas yet. Save any suggestion you may want to repeat.</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text accessibilityRole='header' style={styles.sectionTitle}>Meal history and reflections</Text>
              <Text style={styles.sectionSubtitle}>
                Optional records can help you notice what felt practical and comfortable.
              </Text>
              {history.length ? (
                <View style={styles.openList}>
                  {history.map((meal, index) => (
                    <MealHistoryRow
                      key={meal.id}
                      meal={meal}
                      last={index === history.length - 1}
                      confirmingDelete={deleteCandidateId === meal.id}
                      deleting={busyAction === `delete-${meal.id}`}
                      onReflect={() => setReflectionMealId(meal.id)}
                      onDelete={() => requestDeleteMeal(meal)}
                      onConfirmDelete={() => handleDeleteMeal(meal.id)}
                      onCancelDelete={() => setDeleteCandidateId(null)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.suggestionEmpty}>
                  <Ionicons name='time-outline' size={25} color={COLORS.sage} />
                  <Text style={styles.emptyTitle}>No meals logged yet</Text>
                  <Text style={styles.emptyText}>
                    When you tap “I ate this”, the meal will appear here. Reflections are always optional.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text accessibilityRole='header' style={styles.sectionTitle}>Personal observations</Text>
              <Text style={styles.sectionSubtitle}>
                Descriptive patterns from your own records—not causes, conclusions, or a diagnosis.
              </Text>
              {visibleObservations.length ? (
                visibleObservations.map((observation) => (
                  <View key={observation.id} style={styles.observationCard}>
                    <View style={styles.observationTop}>
                      <Ionicons name='analytics-outline' size={21} color={COLORS.sage} />
                      <Text style={styles.observationLabel}>Observation, not a conclusion</Text>
                    </View>
                    <Text style={styles.observationText}>{observation.text}</Text>
                    <Text style={styles.observationSample}>
                      Based on {observation.sampleSize || observationResult.sampleSize} reflected meal{(observation.sampleSize || observationResult.sampleSize) === 1 ? '' : 's'}.
                    </Text>
                    <Pressable
                      onPress={() => dismissObservation(observation.id)}
                      accessibilityRole='button'
                      accessibilityLabel='Dismiss this Diet observation'
                      style={({ pressed, hovered, focused }) => [styles.dismissButton, hovered && styles.controlHovered, focused && styles.focusedControl, pressed && styles.pressed]}
                    >
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.insufficientCard}>
                  <Ionicons name='leaf-outline' size={22} color={COLORS.sage} />
                  <View style={styles.flex}>
                    <Text style={styles.insufficientTitle}>More reflections are needed</Text>
                    <Text style={styles.insufficientText}>{observationResult.message}</Text>
                    <Text style={styles.observationSample}>
                      {observationResult.sampleSize} of {observationResult.minimumSampleSize} reflected meals so far.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.localNote}>
              <Ionicons name='phone-portrait-outline' size={18} color={COLORS.muted} />
              <Text style={styles.localNoteText}>
                Diet suggestions, saved ideas, and meal records work locally and remain scoped to this signed-in Bloom account on this device.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreferenceGroup({ title, options, selected, onSelect }) {
  return (
    <View style={styles.preferenceGroup}>
      <Text style={styles.fieldLabel}>{title}</Text>
      <View style={styles.chipWrap} accessibilityRole='radiogroup'>
        {options.map((option) => (
          <ChoiceChip key={option.id} label={option.label} selected={selected === option.id} onPress={() => onSelect(option.id)} />
        ))}
      </View>
    </View>
  );
}

function IngredientShortcuts({ title, icon, ingredients, onSelect, selected }) {
  return (
    <View style={styles.shortcuts}>
      <View style={styles.shortcutHeading}>
        <Ionicons name={icon} size={16} color={COLORS.brand} />
        <Text style={styles.shortcutTitle}>{title}</Text>
      </View>
      <View style={styles.chipWrap}>
        {ingredients.map((id) => (
          <ChoiceChip key={id} label={ingredientLabel(id)} role='checkbox' selected={selected.includes(id)} onPress={() => onSelect(id)} />
        ))}
      </View>
    </View>
  );
}

function SuggestionCard({ suggestion, isSaved, saving, logging, onSave, onEat }) {
  const used = suggestionUsedIngredients(suggestion);
  const missing = suggestionMissingIngredients(suggestion);
  const substitutions = suggestionSubstitutions(suggestion);
  const steps = suggestionSteps(suggestion);
  return (
    <Card style={styles.suggestionCard}>
      <View style={styles.suggestionHeader}>
        <View style={styles.flex}>
          <Text style={styles.suggestionType}>{suggestionTypeLabel(suggestion)}</Text>
          <Text style={styles.suggestionName}>{suggestionName(suggestion)}</Text>
        </View>
        <View style={styles.timeBadge}>
          <Ionicons name='time-outline' size={15} color={COLORS.body} />
          <Text style={styles.timeBadgeText}>{suggestionTime(suggestion)}</Text>
        </View>
      </View>

      {used.length ? (
        <View style={styles.suggestionPart}>
          <Text style={styles.partLabel}>Uses what you selected</Text>
          <Text style={styles.partText}>{used.map(ingredientLabel).join(', ')}</Text>
        </View>
      ) : null}

      {missing.length ? (
        <View style={styles.suggestionPart}>
          <Text style={styles.partLabel}>Optional missing ingredient</Text>
          <Text style={styles.partText}>{missing.map(ingredientLabel).join(', ')}</Text>
        </View>
      ) : null}

      {substitutions.length ? (
        <View style={styles.suggestionPart}>
          <Text style={styles.partLabel}>Easy substitutions</Text>
          {substitutions.map((substitution) => (
            <Text key={substitution} style={styles.bulletText}>• {substitution}</Text>
          ))}
        </View>
      ) : null}

      <View style={styles.suggestionPart}>
        <Text style={styles.partLabel}>How to prepare it</Text>
        {steps.length ? steps.map((step, index) => (
          <View key={`${step}-${index}`} style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        )) : <Text style={styles.partText}>Combine the selected foods in the simplest way available to you.</Text>}
      </View>

      <View style={styles.explanation}>
        <Ionicons name='information-circle-outline' size={18} color={COLORS.sage} />
        <Text style={styles.explanationText}>
          {suggestion.explanation || suggestion.practicalExplanation || 'One practical option based on what you selected.'}
        </Text>
      </View>

      <View style={styles.warningRow}>
        <Ionicons name='warning-outline' size={18} color={COLORS.warning} />
        <Text style={styles.warningText}>
          {suggestion.allergyWarning || 'Check every ingredient and label against your own allergies and intolerances.'}
        </Text>
      </View>

      <View style={styles.suggestionActions}>
        <Button
          title={isSaved ? 'Saved' : 'Save'}
          icon={isSaved ? 'bookmark' : 'bookmark-outline'}
          variant='secondary'
          onPress={onSave}
          loading={saving}
          disabled={isSaved}
          style={styles.suggestionButton}
        />
        <Button
          title='I ate this'
          icon='checkmark-circle-outline'
          onPress={onEat}
          loading={logging}
          style={styles.suggestionButton}
        />
      </View>
    </Card>
  );
}

function ReflectionSection({ meal, busy, onChoose, onClose }) {
  if (!meal) return null;
  return (
    <View style={styles.section}>
      <View style={styles.reflectionCard}>
        <View style={styles.reflectionHeading}>
          <View style={styles.flex}>
            <Text accessibilityRole='header' style={styles.sectionTitle}>How did you feel after this meal?</Text>
            <Text style={styles.sectionSubtitle}>{mealName(meal)} · optional</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Close after-meal reflection'
            style={({ pressed, focused }) => [styles.iconButton, focused && styles.focusedControl, pressed && styles.pressed]}
          >
            <Ionicons name='close' size={20} color={COLORS.ink} />
          </Pressable>
        </View>
        <View style={styles.reflectionOptions}>
          {REFLECTION_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => onChoose(option.id)}
              disabled={busy}
              accessibilityRole='button'
              accessibilityLabel={`${option.label} after ${mealName(meal)}`}
              accessibilityState={{ disabled: busy }}
              style={({ pressed, hovered, focused }) => [
                styles.reflectionOption,
                hovered && styles.controlHovered,
                focused && styles.focusedControl,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.reflectionOptionText}>{option.label}</Text>
              <Ionicons name='chevron-forward' size={17} color={COLORS.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function MealHistoryRow({
  meal,
  last,
  confirmingDelete,
  deleting,
  onReflect,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const reflection = getMealReflection(meal);
  const ingredients = asList(meal.ingredients);
  return (
    <View style={[styles.historyRow, last && styles.openListLast]}>
      <View style={styles.historyTop}>
        <View style={styles.flex}>
          <Text style={styles.historyName}>{mealName(meal)}</Text>
          <Text style={styles.historyMeta}>
            {dateLabel(meal.date)}{meal.suggestionType ? ` · ${suggestionTypeLabel({ type: meal.suggestionType })}` : ''}
          </Text>
          {ingredients.length ? (
            <Text numberOfLines={2} style={styles.historyIngredients}>{ingredients.map(ingredientLabel).join(', ')}</Text>
          ) : null}
          {reflection ? (
            <View style={styles.reflectionBadge}>
              <Ionicons name='leaf-outline' size={14} color={COLORS.sage} />
              <Text style={styles.reflectionBadgeText}>{reflectionLabel(reflection)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {confirmingDelete ? (
        <View style={styles.inlineConfirm}>
          <Text style={styles.inlineConfirmText}>Delete this meal and recalculate observations?</Text>
          <View style={styles.inlineConfirmActions}>
            <Button title='Cancel' variant='secondary' onPress={onCancelDelete} style={styles.compactButton} />
            <Button title='Delete' variant='danger' onPress={onConfirmDelete} loading={deleting} style={styles.compactButton} />
          </View>
        </View>
      ) : (
        <View style={styles.historyActions}>
          <Pressable
            onPress={onReflect}
            accessibilityRole='button'
            accessibilityLabel={`${reflection ? 'Edit' : 'Add'} reflection for ${mealName(meal)}`}
            style={({ pressed, hovered, focused }) => [styles.historyAction, hovered && styles.controlHovered, focused && styles.focusedControl, pressed && styles.pressed]}
          >
            <Ionicons name='chatbubble-outline' size={17} color={COLORS.brand} />
            <Text style={styles.historyActionText}>{reflection ? 'Edit reflection' : 'Add reflection'}</Text>
          </Pressable>
          <Pressable
            onPress={onDelete}
            accessibilityRole='button'
            accessibilityLabel={`Delete ${mealName(meal)} from meal history`}
            style={({ pressed, hovered, focused }) => [styles.historyAction, hovered && styles.controlHovered, focused && styles.focusedControl, pressed && styles.pressed]}
          >
            <Ionicons name='trash-outline' size={17} color={COLORS.error} />
            <Text style={[styles.historyActionText, styles.deleteText]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  keyboard: { flex: 1 },
  scroll: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { paddingBottom: 48 },
  content: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  flex: { flex: 1, minWidth: 0 },
  header: { paddingTop: 12, marginBottom: 18 },
  warmIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    padding: 18,
    marginBottom: 24,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.surfaceWarm,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  introTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  introText: { ...TYPOGRAPHY.supporting, marginTop: 3, color: COLORS.body },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    marginBottom: 20,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.brandSoft,
  },
  noticeSuccess: { backgroundColor: COLORS.sageLight },
  noticeError: { backgroundColor: COLORS.surfaceWarm },
  noticeText: { ...TYPOGRAPHY.supporting, flex: 1, color: COLORS.body },
  noticeErrorText: { color: COLORS.error },
  section: { marginBottom: 32 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  sectionSubtitle: { ...TYPOGRAPHY.supporting, marginTop: 3, color: COLORS.muted },
  availableCard: { padding: 16 },
  preferenceButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.brandSoft,
  },
  preferenceButtonText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.brand },
  preferences: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  preferenceIntro: { ...TYPOGRAPHY.supporting, color: COLORS.body },
  preferenceGroup: { marginTop: 18 },
  fieldLabel: { ...TYPOGRAPHY.supporting, fontWeight: '600', color: COLORS.ink },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choiceChip: {
    minHeight: 44,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.surfaceSoft,
    ...Platform.select({ web: { cursor: 'pointer', outlineStyle: 'none' } }),
  },
  choiceChipSelected: { backgroundColor: COLORS.brandSoft, borderColor: COLORS.brand },
  choiceChipText: { flexShrink: 1, fontSize: 13, lineHeight: 18, color: COLORS.body },
  choiceChipTextSelected: { fontWeight: '600', color: COLORS.brand },
  textField: { marginTop: 16 },
  input: {
    minHeight: 52,
    marginTop: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.ink,
  },
  profileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  flexButton: { flexGrow: 1, flexBasis: 180 },
  searchBox: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingLeft: 14,
    paddingRight: 5,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    fontSize: 15,
    color: COLORS.ink,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  addCustom: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 11,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.brandSoft,
  },
  addCustomText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.brand },
  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  shortcuts: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
  },
  shortcutHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shortcutTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.ink },
  selectedHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 8 },
  textButtonLabel: { fontSize: 13, fontWeight: '600', color: COLORS.brand },
  selectedList: { gap: 8, marginTop: 4 },
  selectedPill: {
    minHeight: 48,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 2,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSoft,
  },
  selectedPillText: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 19,
    color: COLORS.ink,
  },
  selectedIconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  ingredientEmpty: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    marginTop: 4,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.sageLight,
  },
  ingredientEmptyText: { ...TYPOGRAPHY.supporting, flex: 1, color: COLORS.body },
  generateButton: { marginTop: 18 },
  suggestionCard: { padding: 17, marginTop: 14 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  suggestionType: { ...TYPOGRAPHY.caption, color: COLORS.brand },
  suggestionName: { ...TYPOGRAPHY.componentTitle, marginTop: 2, color: COLORS.ink },
  timeBadge: {
    minHeight: 32,
    maxWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
  },
  timeBadgeText: { flexShrink: 1, fontSize: 11, lineHeight: 15, fontWeight: '600', color: COLORS.body },
  suggestionPart: { marginTop: 16 },
  partLabel: { ...TYPOGRAPHY.caption, color: COLORS.muted },
  partText: { ...TYPOGRAPHY.supporting, marginTop: 3, color: COLORS.body },
  bulletText: { ...TYPOGRAPHY.supporting, marginTop: 4, color: COLORS.body },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 8 },
  stepNumber: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSoft,
  },
  stepNumberText: { fontSize: 12, fontWeight: '600', color: COLORS.ink },
  stepText: { ...TYPOGRAPHY.supporting, flex: 1, color: COLORS.body },
  explanation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginTop: 16,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.sageLight,
  },
  explanationText: { ...TYPOGRAPHY.supporting, flex: 1, color: COLORS.body },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 13 },
  warningText: { fontSize: 12, lineHeight: 18, flex: 1, color: COLORS.body },
  suggestionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  suggestionButton: { flexGrow: 1, flexBasis: 132 },
  suggestionEmpty: {
    alignItems: 'center',
    padding: 24,
    marginTop: 14,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  emptyTitle: { ...TYPOGRAPHY.componentTitle, marginTop: 10, color: COLORS.ink, textAlign: 'center' },
  emptyText: {
    ...TYPOGRAPHY.supporting,
    maxWidth: 420,
    marginTop: 4,
    color: COLORS.body,
    textAlign: 'center',
  },
  allergyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 },
  allergyNoteText: { fontSize: 12, lineHeight: 18, flex: 1, color: COLORS.body },
  reflectionCard: { padding: 18, borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surfaceWarm },
  reflectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reflectionOptions: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  reflectionOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
    borderRadius: 8,
  },
  reflectionOptionText: { ...TYPOGRAPHY.supporting, flex: 1, color: COLORS.ink },
  openList: { marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  savedRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  openListLast: { borderBottomWidth: 0 },
  savedName: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  savedMeta: { ...TYPOGRAPHY.caption, marginTop: 3, color: COLORS.muted },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  compactEmpty: {
    padding: 16,
    marginTop: 12,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  compactEmptyText: { ...TYPOGRAPHY.supporting, color: COLORS.body },
  historyRow: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start' },
  historyName: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  historyMeta: { ...TYPOGRAPHY.caption, marginTop: 2, color: COLORS.muted },
  historyIngredients: { ...TYPOGRAPHY.supporting, marginTop: 5, color: COLORS.body },
  reflectionBadge: {
    alignSelf: 'flex-start',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: COLORS.sageLight,
  },
  reflectionBadgeText: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: COLORS.sage },
  historyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  historyAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  historyActionText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: COLORS.brand },
  deleteText: { color: COLORS.error },
  inlineConfirm: {
    padding: 12,
    marginTop: 10,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceWarm,
  },
  inlineConfirmText: { ...TYPOGRAPHY.supporting, color: COLORS.body },
  inlineConfirmActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  compactButton: { minHeight: 48, flexGrow: 1, flexBasis: 120 },
  observationCard: {
    padding: 17,
    marginTop: 12,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.sageLight,
  },
  observationTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  observationLabel: { ...TYPOGRAPHY.caption, color: COLORS.sage },
  observationText: { ...TYPOGRAPHY.body, marginTop: 10, color: COLORS.ink },
  observationSample: { ...TYPOGRAPHY.caption, marginTop: 7, color: COLORS.muted },
  dismissButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  dismissButtonText: { fontSize: 12, fontWeight: '600', color: COLORS.sage },
  insufficientCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 17,
    marginTop: 12,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.sageLight,
  },
  insufficientTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  insufficientText: { ...TYPOGRAPHY.supporting, marginTop: 3, color: COLORS.body },
  localNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  localNoteText: { fontSize: 12, lineHeight: 18, flex: 1, color: COLORS.muted },
  controlHovered: { backgroundColor: COLORS.surfaceStrong },
  focusedControl: Platform.select({ web: WEB_FOCUS, default: {} }),
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  loading: {
    flex: 1,
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: 28,
  },
  skeleton: { borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.surfaceSoft },
  skeletonTitle: { width: '36%', height: 34 },
  skeletonIntro: { width: '84%', height: 20, marginTop: 12 },
  skeletonCard: { width: '100%', height: 180, marginTop: 28 },
  loadingText: { ...TYPOGRAPHY.supporting, marginTop: 14, color: COLORS.muted },
});
