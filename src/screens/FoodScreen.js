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

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

const FOOD_TEMPLATES = [
  { id: 'roti-dal', name: 'Roti and dal', protein: true, fibre: true, produce: false, tags: ['Vegetarian', 'Affordable'] },
  { id: 'idli-sambar', name: 'Idli and sambar', protein: true, fibre: true, produce: true, tags: ['Vegetarian', 'Hostel-friendly'] },
  { id: 'rice-rajma', name: 'Rice and rajma', protein: true, fibre: true, produce: false, tags: ['Vegetarian', 'Affordable'] },
  { id: 'curd-rice', name: 'Curd rice', protein: true, fibre: false, produce: false, tags: ['Vegetarian', 'Hostel-friendly'] },
  { id: 'egg-roti', name: 'Eggs and roti', protein: true, fibre: true, produce: false, tags: ['Affordable', 'Hostel-friendly'] },
  { id: 'veg-thali', name: 'Vegetable thali', protein: true, fibre: true, produce: true, tags: ['Vegetarian'] },
  { id: 'poha', name: 'Poha', protein: false, fibre: true, produce: false, tags: ['Vegetarian', 'Affordable'] },
  { id: 'upma', name: 'Upma', protein: false, fibre: true, produce: false, tags: ['Vegetarian', 'Affordable'] },
  { id: 'dosa', name: 'Dosa', protein: false, fibre: false, produce: false, tags: ['Vegetarian', 'Affordable'] },
  { id: 'paneer-roti', name: 'Paneer and roti', protein: true, fibre: true, produce: false, tags: ['Vegetarian'] },
  { id: 'chana-salad', name: 'Chana salad', protein: true, fibre: true, produce: true, tags: ['Vegetarian', 'Affordable'] },
  { id: 'chicken-rice', name: 'Chicken and rice', protein: true, fibre: false, produce: false, tags: [] },
  { id: 'fish-rice', name: 'Fish and rice', protein: true, fibre: false, produce: false, tags: [] },
  { id: 'vegetable-curry', name: 'Roti and vegetable curry', protein: false, fibre: true, produce: true, tags: ['Vegetarian', 'Affordable'] },
  { id: 'fruit-nuts', name: 'Fruit and nuts', protein: true, fibre: true, produce: true, tags: ['Vegetarian', 'Hostel-friendly'] },
  { id: 'canteen-meal', name: 'Hostel or canteen meal', protein: false, fibre: false, produce: false, tags: ['Hostel-friendly'] },
];

function todayKey(route) {
  return localDateKey(route?.params?.date);
}

function createId() {
  return `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mealName(meal) {
  return meal?.name || meal?.mealName || 'Meal';
}

function hasIndicator(meal, key) {
  const aliases = {
    protein: ['protein', 'proteinIncluded'],
    fibre: ['fibre', 'fiber', 'fibreIncluded'],
    produce: ['produce', 'fruitOrVegetables', 'produceIncluded'],
  };
  return aliases[key].some((field) => Boolean(meal?.[field]));
}

function isFavourite(meal) {
  return Boolean(meal?.favourite || meal?.favorite || meal?.isFavourite);
}

function observationFor({ skipped, protein, fibre, produce }) {
  if (skipped) return 'Missing a meal can happen. Notice what would feel manageable next, without judging yourself.';
  if (protein && (fibre || produce)) return 'This meal brings together a protein source and foods that may help it feel more filling.';
  if (protein) return 'This meal includes a useful protein source.';
  if (fibre || produce) return 'This meal includes fruit, vegetables, or another fibre source.';
  return 'You do not need to make every meal perfect. Pairing it with protein or fruit when available may help it feel more filling.';
}

function dateLabel(value) {
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'd MMM yyyy') : value;
}

function ToggleChip({ label, selected, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='checkbox'
      accessibilityState={{ checked: selected }}
      style={({ pressed, hovered, focused }) => [styles.toggleChip, selected && styles.toggleChipSelected, hovered && styles.choiceHovered, focused && styles.focusedControl, pressed && styles.pressed]}
    >
      <Ionicons name={selected ? 'checkmark-circle' : icon} size={18} color={selected ? COLORS.brand : COLORS.muted} />
      <Text style={[styles.toggleChipText, selected && styles.toggleChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function FoodScreen({ navigation, route }) {
  const { state, saveMeal, deleteMeal } = useApp();
  const date = todayKey(route);
  const meals = Array.isArray(state.meals) ? state.meals : [];
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('Lunch');
  const [protein, setProtein] = useState(false);
  const [fibre, setFibre] = useState(false);
  const [produce, setProduce] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [favourite, setFavourite] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const selectedDateMeals = useMemo(
    () => meals.filter((meal) => meal.date === date).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [date, meals]
  );
  const history = useMemo(
    () => [...meals].sort((a, b) => `${b.date || ''}${b.updatedAt || ''}`.localeCompare(`${a.date || ''}${a.updatedAt || ''}`)),
    [meals]
  );
  const favourites = useMemo(() => history.filter(isFavourite).slice(0, 4), [history]);
  const recent = useMemo(() => {
    const seen = new Set();
    return history.filter((meal) => {
      const key = mealName(meal).toLowerCase();
      if (seen.has(key) || meal.skipped) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }, [history]);
  const templates = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? FOOD_TEMPLATES.filter((item) => `${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(term))
      : FOOD_TEMPLATES.slice(0, 8);
    return matches;
  }, [query]);

  const observation = observationFor({ skipped, protein, fibre, produce });

  function resetForm() {
    setEditingId(null);
    setName('');
    setProtein(false);
    setFibre(false);
    setProduce(false);
    setSkipped(false);
    setFavourite(false);
    setSelectedTags([]);
  }

  function chooseTemplate(template) {
    setEditingId(null);
    setName(template.name);
    setProtein(template.protein);
    setFibre(template.fibre);
    setProduce(template.produce);
    setSkipped(false);
    setSelectedTags(template.tags || []);
    setNotice(null);
  }

  function populateFromMeal(meal, edit = false) {
    setEditingId(edit ? meal.id : null);
    setName(meal.skipped ? '' : mealName(meal));
    setMealType(meal.mealType || 'Lunch');
    setProtein(hasIndicator(meal, 'protein'));
    setFibre(hasIndicator(meal, 'fibre'));
    setProduce(hasIndicator(meal, 'produce'));
    setSkipped(Boolean(meal.skipped));
    setFavourite(isFavourite(meal));
    setSelectedTags(meal.tags || []);
    setNotice(edit ? { type: 'info', text: 'Editing this meal. Save when it looks right.' } : null);
  }

  async function handleSave() {
    if ((!name.trim() && !skipped) || saving) return;
    const existing = editingId ? meals.find((meal) => meal.id === editingId) : null;
    const now = new Date().toISOString();
    setSaving(true);
    setNotice(null);
    try {
      await saveMeal({
        ...existing,
        id: editingId || createId(),
        date,
        mealType,
        name: skipped ? 'Meal skipped' : name.trim(),
        protein,
        fibre,
        produce,
        skipped,
        favourite,
        tags: selectedTags,
        observation,
        source: selectedTags.length ? 'template' : 'manual',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
      setNotice({ type: 'success', text: editingId ? 'Meal updated.' : 'Meal saved on this device.' });
      resetForm();
    } catch (error) {
      setNotice({ type: 'error', text: 'This meal could not be saved. Your form is still here so you can try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    setNotice(null);
    try {
      await deleteMeal(id);
      if (editingId === id) resetForm();
      setDeletingId(null);
      setNotice({ type: 'success', text: 'Meal deleted.' });
    } catch (error) {
      setNotice({ type: 'error', text: 'This meal could not be deleted. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (state.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}><Text style={styles.loadingText}>Loading your meals...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <MotionScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
        <View style={styles.content}>
          {navigation?.canGoBack?.() ? <BackButton onPress={() => navigation.goBack()} /> : null}
          <ScreenHeader
            title='Food support'
            subtitle='Notice what helps you feel nourished, without calories or food rules.'
            action={<View style={styles.dateBadge}><Ionicons name='calendar-clear-outline' size={15} color={COLORS.brand} /><Text style={styles.dateBadgeText}>{dateLabel(date)}</Text></View>}
          />

          {notice ? (
            <View style={[styles.notice, notice.type === 'success' && styles.noticeSuccess, notice.type === 'error' && styles.noticeError]} accessibilityLiveRegion='polite'>
              <Ionicons name={notice.type === 'error' ? 'alert-circle-outline' : notice.type === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'} size={20} color={notice.type === 'error' ? COLORS.error : notice.type === 'success' ? COLORS.sage : COLORS.brand} />
              <Text style={styles.noticeText}>{notice.text}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Find a familiar meal</Text>
            <Text style={styles.sectionSubtitle}>Search Indian staples or start with a quick template.</Text>
            <View style={styles.searchBox}>
              <Ionicons name='search-outline' size={20} color={COLORS.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder='Rice, roti, dal, idli, canteen meal...'
                placeholderTextColor={COLORS.muted}
                style={styles.searchInput}
                accessibilityLabel='Search familiar foods'
                returnKeyType='search'
              />
              {query ? <Pressable onPress={() => setQuery('')} accessibilityRole='button' accessibilityLabel='Clear search' style={({ pressed, hovered, focused }) => [styles.clearButton, hovered && styles.clearButtonHovered, focused && styles.clearButtonFocused, pressed && styles.pressed]}><Ionicons name='close-circle' size={21} color={COLORS.muted} /></Pressable> : null}
            </View>
            {templates.length ? (
              <View style={styles.templateList}>
                {templates.map((template, index) => (
                  <Pressable key={template.id} onPress={() => chooseTemplate(template)} accessibilityRole='button' accessibilityLabel={`Choose ${template.name}`} style={({ pressed, hovered, focused }) => [styles.templateCard, index === templates.length - 1 && styles.templateCardLast, name === template.name && styles.templateCardSelected, hovered && styles.templateCardHovered, focused && styles.focusedControl, pressed && styles.pressed]}>
                    <View style={styles.templateIcon}><Ionicons name='restaurant-outline' size={18} color={COLORS.brand} /></View>
                    <View style={styles.templateCopy}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      {template.tags.length ? <Text numberOfLines={1} style={styles.templateMeta}>{template.tags.join(' / ')}</Text> : null}
                    </View>
                    <Ionicons name={name === template.name ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={name === template.name ? COLORS.brand : COLORS.muted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.smallEmpty}><Text style={styles.smallEmptyText}>No template matches yet. You can type the meal name below.</Text></View>
            )}
          </View>

          {(favourites.length > 0 || recent.length > 0) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{favourites.length ? 'Favourites and recent' : 'Recent meals'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.repeatRow}>
                {[...favourites, ...recent.filter((meal) => !favourites.some((item) => item.id === meal.id))].slice(0, 6).map((meal) => (
                  <Pressable key={meal.id} onPress={() => populateFromMeal(meal)} accessibilityRole='button' accessibilityLabel={`Repeat ${mealName(meal)}`} style={({ pressed, hovered, focused }) => [styles.repeatCard, hovered && styles.repeatCardHovered, focused && styles.focusedControl, pressed && styles.pressed]}>
                    <Ionicons name={isFavourite(meal) ? 'heart' : 'time-outline'} size={18} color={isFavourite(meal) ? COLORS.brand : COLORS.sage} />
                    <Text numberOfLines={2} style={styles.repeatName}>{mealName(meal)}</Text>
                    <Text style={styles.repeatAction}>Quick repeat</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Card style={styles.formCard}>
            <View style={styles.formHeading}>
              <View style={styles.formIcon}><Ionicons name={editingId ? 'create-outline' : 'add-outline'} size={21} color={COLORS.brand} /></View>
              <View style={styles.flex}><Text style={styles.cardTitle}>{editingId ? 'Edit meal' : 'Log a meal'}</Text><Text style={styles.cardSubtitle}>Skip any detail you did not notice.</Text></View>
            </View>

            <Text style={styles.label}>Meal type</Text>
            <View style={styles.chipRow} accessibilityRole='radiogroup'>
              {MEAL_TYPES.map((type) => <ChoiceChip key={type} label={type} selected={mealType === type} onPress={() => setMealType(type)} />)}
            </View>

            <Text style={[styles.label, styles.fieldSpacing]}>Meal name</Text>
            <TextInput
              value={name}
              onChangeText={(value) => { setName(value); setSkipped(false); setSelectedTags([]); }}
              placeholder='For example, rice and dal'
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              accessibilityLabel='Meal name'
              maxLength={80}
            />

            <View style={styles.fieldSpacing}>
              <Text style={styles.label}>What was included?</Text>
              <Text style={styles.helper}>These are simple notes, not a score.</Text>
              <View style={styles.chipRow}>
                <ToggleChip label='Protein source' icon='ellipse-outline' selected={protein} onPress={() => setProtein((value) => !value)} />
                <ToggleChip label='Fibre source' icon='leaf-outline' selected={fibre} onPress={() => setFibre((value) => !value)} />
                <ToggleChip label='Fruit or vegetables' icon='nutrition-outline' selected={produce} onPress={() => setProduce((value) => !value)} />
                <ToggleChip label='Meal skipped' icon='remove-circle-outline' selected={skipped} onPress={() => setSkipped((value) => !value)} />
                <ToggleChip label='Save as favourite' icon='heart-outline' selected={favourite} onPress={() => setFavourite((value) => !value)} />
              </View>
            </View>

            <View style={styles.observation}>
              <Ionicons name='sparkles-outline' size={19} color={COLORS.sage} />
              <View style={styles.flex}><Text style={styles.observationLabel}>A gentle observation</Text><Text style={styles.observationText}>{observation}</Text></View>
            </View>

            <Button title={editingId ? 'Save changes' : 'Save meal'} icon='checkmark-circle-outline' onPress={handleSave} disabled={!skipped && !name.trim()} loading={saving} />
            {(editingId || name || skipped) ? <Button title='Clear form' variant='ghost' onPress={resetForm} style={styles.secondaryButton} /> : null}
          </Card>

          <ScrollReveal style={styles.section}>
            <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Meal history</Text><Text style={styles.sectionSubtitle}>{selectedDateMeals.length} on this date / {history.length} total</Text></View></View>
            {history.length === 0 ? (
              <Card variant='cream' style={styles.emptyCard}>
                <View style={styles.emptyIcon}><Ionicons name='restaurant-outline' size={25} color={COLORS.brand} /></View>
                <Text style={styles.emptyTitle}>No meals logged yet</Text>
                <Text style={styles.emptyText}>Choose a familiar meal above or add your own. One entry is enough to begin.</Text>
              </Card>
            ) : history.map((meal) => (
              <MealHistoryCard
                key={meal.id}
                meal={meal}
                confirming={deletingId === meal.id}
                onRepeat={() => populateFromMeal(meal)}
                onEdit={() => populateFromMeal(meal, true)}
                onDelete={() => setDeletingId(meal.id)}
                onCancelDelete={() => setDeletingId(null)}
                onConfirmDelete={() => handleDelete(meal.id)}
              />
            ))}
          </ScrollReveal>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

function ChoiceChip({ label, selected, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='radio' accessibilityState={{ checked: selected }} style={({ pressed, hovered, focused }) => [styles.choiceChip, selected && styles.choiceChipSelected, hovered && styles.choiceHovered, focused && styles.focusedControl, pressed && styles.pressed]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

function BackButton({ onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel='Go back' style={({ pressed, hovered, focused }) => [styles.backButton, hovered && styles.backButtonHovered, focused && styles.backButtonFocused, pressed && styles.pressed]}><Ionicons name='chevron-back' size={20} color={COLORS.ink} /><Text style={styles.backText}>Back</Text></Pressable>;
}

function MealHistoryCard({ meal, confirming, onRepeat, onEdit, onDelete, onCancelDelete, onConfirmDelete }) {
  const indicators = [hasIndicator(meal, 'protein') && 'Protein', hasIndicator(meal, 'fibre') && 'Fibre', hasIndicator(meal, 'produce') && 'Fruit / veg'].filter(Boolean);
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View style={styles.historyIcon}><Ionicons name={meal.skipped ? 'remove-outline' : 'restaurant-outline'} size={19} color={COLORS.brand} /></View>
        <View style={styles.flex}><View style={styles.nameRow}><Text style={styles.historyName}>{mealName(meal)}</Text>{isFavourite(meal) ? <Ionicons name='heart' size={16} color={COLORS.brand} /> : null}</View><Text style={styles.historyMeta}>{meal.mealType || 'Meal'} / {dateLabel(meal.date)}</Text></View>
      </View>
      {(indicators.length > 0 || meal.tags?.length > 0) ? <View style={styles.miniChipRow}>{[...indicators, ...(meal.tags || [])].map((label) => <View key={label} style={styles.miniChip}><Text style={styles.miniChipText}>{label}</Text></View>)}</View> : null}
      {meal.observation ? <Text style={styles.historyObservation}>{meal.observation}</Text> : null}
      {confirming ? (
        <View style={styles.deleteConfirm}><Text style={styles.deleteText}>Delete this meal entry?</Text><View style={styles.inlineActions}><ActionButton label='Keep' onPress={onCancelDelete} /><ActionButton label='Delete' danger onPress={onConfirmDelete} /></View></View>
      ) : (
        <View style={styles.inlineActions}><ActionButton label='Repeat' icon='repeat-outline' onPress={onRepeat} /><ActionButton label='Edit' icon='create-outline' onPress={onEdit} /><ActionButton label='Delete' icon='trash-outline' danger onPress={onDelete} /></View>
      )}
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
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  loadingText: { fontSize: 15, color: COLORS.muted },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, marginBottom: 8, paddingHorizontal: 6 },
  backText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  dateBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, backgroundColor: COLORS.brandSoft, paddingHorizontal: 11 },
  dateBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.brand },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginBottom: 20, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.brandSoft },
  noticeSuccess: { backgroundColor: COLORS.sageLight },
  noticeError: { backgroundColor: '#FCEDEB' },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.body },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: COLORS.ink },
  sectionSubtitle: { marginTop: 3, fontSize: 14, lineHeight: 20, color: COLORS.muted },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.canvas, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 50, fontSize: 15, color: COLORS.ink },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  clearButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 22 },
  clearButtonFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 22 },
  templateList: { marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  templateCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: COLORS.hairline, backgroundColor: COLORS.canvas, paddingHorizontal: 4, paddingVertical: 10 },
  templateCardLast: { borderBottomWidth: 0 },
  templateCardSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  templateCardHovered: { backgroundColor: COLORS.surfaceWarm },
  templateIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceWarm },
  templateCopy: { flex: 1 },
  templateName: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.ink },
  templateMeta: { marginTop: 3, fontSize: 11, lineHeight: 15, color: COLORS.muted },
  smallEmpty: { marginTop: 12, padding: 16, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.surfaceSoft },
  smallEmptyText: { fontSize: 14, lineHeight: 20, color: COLORS.body },
  repeatRow: { gap: 10, paddingTop: 12, paddingRight: 20 },
  repeatCard: { width: 150, minHeight: 108, justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, padding: 14, backgroundColor: COLORS.canvas },
  repeatCardHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  repeatName: { marginVertical: 8, fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.ink },
  repeatAction: { fontSize: 12, fontWeight: '700', color: COLORS.brand },
  formCard: { marginBottom: 30, padding: 20, borderWidth: 0, ...Platform.select({ web: ELEVATION.web, ios: ELEVATION.ios, android: ELEVATION.android, default: {} }) },
  formHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  formIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: COLORS.ink },
  cardSubtitle: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.muted },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: COLORS.ink },
  helper: { marginTop: 2, marginBottom: 10, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  fieldSpacing: { marginTop: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  choiceChip: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 22, backgroundColor: COLORS.canvas },
  choiceChipSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  choiceHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  focusedControl: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  choiceText: { fontSize: 13, fontWeight: '600', color: COLORS.body },
  choiceTextSelected: { color: COLORS.brand },
  toggleChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 22, backgroundColor: COLORS.canvas },
  toggleChipSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  toggleChipText: { fontSize: 13, fontWeight: '600', color: COLORS.body },
  toggleChipTextSelected: { color: COLORS.brand },
  input: { minHeight: 52, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, paddingHorizontal: 14, marginTop: 8, fontSize: 15, color: COLORS.ink, backgroundColor: COLORS.canvas },
  observation: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginVertical: 20, padding: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.sageLight },
  observationLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: COLORS.sage },
  observationText: { marginTop: 3, fontSize: 14, lineHeight: 20, color: COLORS.body },
  secondaryButton: { marginTop: 4 },
  emptyCard: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: COLORS.brandSoft },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.ink, textAlign: 'center' },
  emptyText: { maxWidth: 390, marginTop: 6, fontSize: 14, lineHeight: 20, color: COLORS.muted, textAlign: 'center' },
  historyCard: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  historyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyName: { flexShrink: 1, fontSize: 16, lineHeight: 21, fontWeight: '600', color: COLORS.ink },
  historyMeta: { marginTop: 2, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  miniChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  miniChip: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 14, backgroundColor: COLORS.surfaceSoft },
  miniChipText: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: COLORS.body },
  historyObservation: { marginTop: 12, fontSize: 13, lineHeight: 19, color: COLORS.body },
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
