import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { useApp } from '../context/AppContext';
import { localDateKey } from '../utils/dateKey';
import {
  CRAVING_TYPES,
  DEFAULT_KIT_IDS,
  RESCUE_BY_ID,
  RESCUE_CATALOG,
  getRescuesForCraving,
  kitEstimate,
  rotatingRescue,
} from '../services/dietRescue';
import { COLORS, createThemedStyles, LAYOUT, TYPOGRAPHY, WEB_FOCUS } from '../utils/constants';
import Button from '../components/Button';
import { useReducedMotion } from '../components/Motion';

const SECTION_KEYS = ['sos', 'forecast', 'kit', 'water', 'learn'];
const CHECKS = [
  { id: 'ate_regularly', label: 'Ate regularly' },
  { id: 'felt_satisfied', label: 'Felt satisfied' },
  { id: 'gentle_choice', label: 'Kept it gentle' },
];
const QUIZZES = [
  { id: 'protein-pair', question: 'Which pairing may feel more satisfying for longer?', options: ['Fruit alone', 'Fruit with curd or nuts'], answer: 1, explanation: 'Adding protein or fat can make a snack feel more substantial. Your own comfort matters most.' },
  { id: 'craving-rule', question: 'Does having a craving mean you failed at eating well?', options: ['Yes', 'No'], answer: 1, explanation: 'Cravings are information, not a score. Hunger, sleep, stress and cycle shifts can all play a part.' },
  { id: 'hydration', question: 'What is the gentlest way to build a water habit?', options: ['Catch up all at once', 'Sip across the day'], answer: 1, explanation: 'Small, regular sips are often easier than forcing a large amount at once.' },
];
const SWAPS = [
  ['Want something sweet?', 'Try banana with peanut butter or fruit with curd.'],
  ['Want a strong crunch?', 'Try roasted chana, makhana or a quick murmura bhel.'],
  ['Need a proper mini-meal?', 'Try a small dal-rice bowl or paneer roti roll.'],
];
const MYTHS = [
  ['Cravings show weak willpower.', 'Cravings can reflect hunger, sleep, stress, habits or cycle changes. They are not a character test.'],
  ['One food can balance hormones.', 'No single food can do that. Regular meals and varied nourishment can support general wellbeing.'],
  ['You must ignore a craving.', 'You can answer a craving with something satisfying and still care for your wider eating pattern.'],
];

function normalizeDietUi(value, today) {
  const source = value && typeof value === 'object' ? value : {};
  const daily = source.daily?.date === today ? source.daily : { date: today, water: 0, checks: [] };
  return {
    kitIds: Array.isArray(source.kitIds) ? source.kitIds.filter((id) => RESCUE_BY_ID.has(id)) : [],
    pendingRescue: source.pendingRescue?.date === today ? source.pendingRescue : null,
    outcomes: Array.isArray(source.outcomes) ? source.outcomes.slice(-100) : [],
    quizAnswers: source.quizAnswers && typeof source.quizAnswers === 'object' ? source.quizAnswers : {},
    daily: { date: today, water: Math.max(0, Number(daily.water) || 0), checks: Array.isArray(daily.checks) ? daily.checks : [] },
  };
}

async function openSearch(term) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(term)}`;
  try {
    const supported = Platform.OS === 'web' || await Linking.canOpenURL(url);
    if (!supported) throw new Error('unsupported');
    await Linking.openURL(url);
  } catch {
    AccessibilityInfo.announceForAccessibility?.('The web search could not be opened. Please try again when you are online.');
    Alert.alert('Could not open the web search', 'Please check your connection and try again. Your Diet choices are still here.');
    return false;
  }
  return true;
}

function interactive(base, extra) {
  return ({ pressed, hovered, focused }) => [base, hovered && styles.hovered, focused && styles.focused, pressed && styles.pressed, extra];
}

function IconCircle({ name, tone = 'brand', size = 20 }) {
  const sage = tone === 'sage';
  return <View style={[styles.iconCircle, sage && styles.iconCircleSage]}><Ionicons name={name} size={size} color={sage ? COLORS.sage : COLORS.brand} /></View>;
}

function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}><Text accessibilityRole='header' style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>
      {action ? <Pressable onPress={onAction} accessibilityRole='button' style={interactive(styles.textAction)}><Text style={styles.textActionLabel}>{action}</Text><Ionicons name='arrow-forward' size={16} color={COLORS.brand} /></Pressable> : null}
    </View>
  );
}

function BottomSheet({ visible, title, subtitle, onClose, children }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dragY = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(null);
  const previousFocus = useRef(null);
  useEffect(() => { if (visible) dragY.setValue(0); }, [dragY, visible]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    if (visible) {
      previousFocus.current = document.activeElement;
      const timer = setTimeout(() => closeRef.current?.focus?.(), 0);
      const handleKey = (event) => { if (event.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handleKey);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKey);
        previousFocus.current?.focus?.();
      };
    }
    return undefined;
  }, [onClose, visible]);
  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_event, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 80 || gesture.vy > 1.1) { onClose(); return; }
      if (reduceMotion) dragY.setValue(0);
      else Animated.spring(dragY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', speed: 24, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => {
      if (reduceMotion) dragY.setValue(0);
      else Animated.spring(dragY, { toValue: 0, useNativeDriver: Platform.OS !== 'web', speed: 24, bounciness: 0 }).start();
    },
  }), [dragY, onClose, reduceMotion]);
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalLayer} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole='button' accessibilityLabel='Close sheet' />
        <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: dragY }] }]}>
          <View style={styles.sheetHandleTouch} {...dragResponder.panHandlers}><View style={styles.sheetHandle} accessibilityElementsHidden /></View>
          <View style={styles.sheetHeader}><View style={styles.flex}><Text accessibilityRole='header' style={styles.sheetTitle}>{title}</Text>{subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}</View><Pressable ref={closeRef} onPress={onClose} accessibilityRole='button' accessibilityLabel={`Close ${title}`} style={interactive(styles.closeButton)}><Ionicons name='close' size={24} color={COLORS.ink} /></Pressable></View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function QuickChips({ onJump }) {
  const icons = ['flash-outline', 'calendar-outline', 'bag-handle-outline', 'water-outline', 'bulb-outline'];
  return (
    <View style={styles.quickBar}><ScrollView horizontal contentContainerStyle={styles.quickBarContent} showsHorizontalScrollIndicator={false}>
      {SECTION_KEYS.map((key, index) => <Pressable key={key} onPress={() => onJump(key)} accessibilityRole='button' accessibilityLabel={`Jump to ${key === 'kit' ? 'Rescue Kit' : key} section`} style={interactive(styles.quickChip, index === 0 && styles.quickChipPrimary)}><Ionicons name={icons[index]} size={16} color={index === 0 ? COLORS.white : COLORS.body} /><Text style={[styles.quickChipText, index === 0 && styles.quickChipTextPrimary]}>{key === 'sos' ? 'SOS' : key[0].toUpperCase() + key.slice(1)}</Text></Pressable>)}
    </ScrollView></View>
  );
}

export default function DietScreen({ navigation, route }) {
  const { state, saveSettings } = useApp();
  const reduceMotion = useReducedMotion();
  const today = localDateKey();
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const lastTrigger = useRef({ key: '', time: 0 });
  const pulse = useRef(new Animated.Value(0)).current;
  const [sheet, setSheet] = useState(null);
  const [sosStep, setSosStep] = useState('choose');
  const [selectedCraving, setSelectedCraving] = useState(null);
  const [rescueResults, setRescueResults] = useState([]);
  const [showQuickChips, setShowQuickChips] = useState(false);
  const [notice, setNotice] = useState('');
  const [revealedMyth, setRevealedMyth] = useState(null);
  const [ui, setUi] = useState(() => normalizeDietUi(state.settings?.dietV31, today));
  const uiRef = useRef(ui);
  const committedUi = useRef(ui);
  const queuedUpdates = useRef([]);
  const pendingWrites = useRef(0);
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (!state.isLoading && pendingWrites.current === 0) {
      const next = normalizeDietUi(state.settings?.dietV31, today);
      committedUi.current = next;
      uiRef.current = next;
      setUi(next);
    }
  }, [state.isLoading, state.settings?.dietV31, today]);
  useEffect(() => { const requested = route?.params?.sheet; if (['sos', 'kit', 'learn', 'stats'].includes(requested)) setSheet(requested); }, [route?.params?.sheet]);

  const persist = useCallback((update, success) => {
    const updater = typeof update === 'function' ? update : () => update;
    const next = updater(uiRef.current);
    uiRef.current = next;
    setUi(next);
    if (success) setNotice(success);
    const entry = { updater };
    queuedUpdates.current.push(entry);
    pendingWrites.current += 1;
    writeQueue.current = writeQueue.current
      .then(async () => {
        const committedNext = updater(committedUi.current);
        await saveSettings({ dietV31: committedNext });
        committedUi.current = committedNext;
      })
      .catch(() => {
        setNotice('That change could not be saved. Your last change was restored so you can try again.');
      })
      .finally(() => {
        queuedUpdates.current = queuedUpdates.current.filter((item) => item !== entry);
        pendingWrites.current = Math.max(0, pendingWrites.current - 1);
        const reconciled = queuedUpdates.current.reduce((current, item) => item.updater(current), committedUi.current);
        uiRef.current = reconciled;
        setUi(reconciled);
      });
    return writeQueue.current;
  }, [saveSettings]);

  const openSheet = useCallback((target) => {
    const now = Date.now();
    if (lastTrigger.current.key === target && now - lastTrigger.current.time < 180) return;
    lastTrigger.current = { key: target, time: now };
    if (target === 'sos') { setSosStep('choose'); setSelectedCraving(null); setRescueResults([]); }
    setSheet(target);
  }, []);

  const scrollTo = useCallback((target) => {
    const y = sectionY.current[target] || 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - (target === 'sos' ? 16 : 72)), animated: !reduceMotion });
  }, [reduceMotion]);

  const pulseKit = useCallback(() => {
    scrollTo('kit'); pulse.setValue(0);
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [pulse, reduceMotion, scrollTo]);

  const chooseCraving = (id) => { setSelectedCraving(id); setRescueResults(getRescuesForCraving(id, { kitIds: ui.kitIds })); setSosStep('results'); };
  const openCravingResults = (id) => {
    chooseCraving(id);
    setSheet('sos');
  };
  const selectRescue = async (rescue) => {
    await persist((current) => ({ ...current, pendingRescue: { id: rescue.id, craving: selectedCraving || rescue.category, date: today, selectedAt: new Date().toISOString() } }));
    setSheet(null); setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion }), reduceMotion ? 0 : 120);
  };
  const rateRescue = async (rating) => {
    const pending = ui.pendingRescue; if (!pending) return;
    await persist((current) => ({ ...current, pendingRescue: null, outcomes: [...current.outcomes, { ...pending, rating, ratedAt: new Date().toISOString() }].slice(-100) }), rating === 'yes' ? 'Saved. Keep what worked, without making it a rule.' : 'Saved. Your next rescue can be different.');
    if (rating === 'no') { setSelectedCraving(pending.craving); setRescueResults(getRescuesForCraving(pending.craving, { excludedIds: [pending.id], kitIds: ui.kitIds })); setSosStep('results'); setSheet('sos'); }
  };
  const updateKit = (ids) => persist((current) => ({ ...current, kitIds: typeof ids === 'function' ? ids(current.kitIds) : ids }), 'Kit updated');
  const updateWater = (amount) => persist((current) => ({ ...current, daily: { ...current.daily, water: Math.max(0, Math.min(12, current.daily.water + amount)) } }));
  const toggleCheck = (id) => persist((current) => ({ ...current, daily: { ...current.daily, checks: current.daily.checks.includes(id) ? current.daily.checks.filter((item) => item !== id) : [...current.daily.checks, id] } }));

  const quiz = QUIZZES[new Date().getDate() % QUIZZES.length];
  const quizChoice = ui.quizAnswers[quiz.id];
  const answerQuiz = (choice) => {
    if (quizChoice !== undefined) return;
    void persist((current) => ({ ...current, quizAnswers: { ...current.quizAnswers, [quiz.id]: choice } }));
    AccessibilityInfo.announceForAccessibility?.(choice === quiz.answer ? 'Correct. Explanation is now shown.' : 'Answer saved. Explanation is now shown.');
  };
  const todaysRescue = rotatingRescue(today);
  const suggestedRescues = [todaysRescue, ...getRescuesForCraving('not_sure', { kitIds: ui.kitIds })]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 2);
  const todaysMeals = (Array.isArray(state.meals) ? state.meals : [])
    .filter((meal) => meal?.date === today)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 2);
  const kitItems = ui.kitIds.map((id) => RESCUE_BY_ID.get(id)).filter(Boolean);
  const pendingItem = ui.pendingRescue ? RESCUE_BY_ID.get(ui.pendingRescue.id) : null;
  const favouriteId = useMemo(() => {
    const counts = ui.outcomes.reduce((map, item) => ({ ...map, [item.id]: (map[item.id] || 0) + (item.rating === 'yes' ? 1 : 0) }), {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [ui.outcomes]);
  const phaseLabel = state.currentPhase?.label || state.currentPhase?.phase || null;
  const forecast = useMemo(() => {
    if ((state.periods || []).length < 2) return { state: 'learning', title: 'Bloom is learning your pattern', body: 'Log at least two cycle starts to unlock a careful craving forecast.' };
    const raw = state.nextPeriodPrediction;
    const parsed = typeof raw === 'string' ? parseISO(raw) : raw;
    if (!parsed || !isValid(parsed)) return { state: 'learning', title: 'Your forecast is still taking shape', body: 'Keep logging cycle starts. Variation is expected, especially with PCOS.' };
    const days = differenceInCalendarDays(parsed, new Date());
    if (days <= 7 && days >= 2) return { state: 'upcoming', title: 'A craving window may be approaching', body: `Your next period is estimated around ${format(parsed, 'd MMM')}. A small kit can make busy moments easier.` };
    if (days < 2 && days >= -1) return { state: 'live', title: 'Keep rescue options close', body: 'If cravings feel stronger now, that can happen. Satisfaction matters more than a perfect choice.' };
    return { state: 'steady', title: 'Your kit can wait nearby', body: `Your next period is estimated around ${format(parsed, 'd MMM')}. Bloom will surface preparation closer to the time.` };
  }, [state.nextPeriodPrediction, state.periods]);

  if (state.isLoading) return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><Ionicons name='nutrition-outline' size={28} color={COLORS.brand} /><Text style={styles.loadingText}>Preparing Diet…</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.screen}>
          {showQuickChips ? <View style={styles.quickBarOverlay}><QuickChips onJump={scrollTo} /></View> : null}
          <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled' keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={Platform.OS === 'web'} onScroll={(event) => setShowQuickChips(event.nativeEvent.contentOffset.y > 250)} scrollEventThrottle={32}>
            <View style={styles.content}>
              <View style={styles.header}><View><Text accessibilityRole='header' style={styles.title}>Diet</Text><Text style={styles.subtitle}>Food that fits today.</Text></View></View>
              {notice ? <View style={styles.notice} accessibilityLiveRegion='polite'><Ionicons name='checkmark-circle-outline' size={19} color={COLORS.sage} /><Text style={styles.noticeText}>{notice}</Text><Pressable onPress={() => setNotice('')} accessibilityRole='button' accessibilityLabel='Dismiss notice' style={styles.noticeDismiss}><Ionicons name='close' size={18} color={COLORS.muted} /></Pressable></View> : null}
              {pendingItem ? <PendingCard item={pendingItem} onRate={rateRescue} /> : null}

              <View onLayout={(event) => { sectionY.current.sos = event.nativeEvent.layout.y; }} style={styles.homeSection}>
                <Text accessibilityRole='header' style={styles.homeSectionTitle}>What sounds doable?</Text>
                <View style={styles.actionGrid}>
                  <HomeAction icon='flash-outline' label='Quick & filling' onPress={() => openCravingResults('filling')} />
                  <HomeAction icon='leaf-outline' label='Something light' onPress={() => openSheet('sos')} />
                  <HomeAction icon='restaurant-outline' label='I’m craving something' onPress={() => openSheet('sos')} />
                  <HomeAction icon='file-tray-outline' label='Use what I have' onPress={() => openSheet('kit')} />
                </View>
              </View>

              <View style={styles.homeSection}>
                <Text accessibilityRole='header' style={styles.homeSectionTitle}>Suggested for you</Text>
                <View style={styles.suggestionList}>{suggestedRescues.map((item) => <SuggestedRescue key={item.id} item={item} onPress={() => selectRescue(item)} />)}</View>
              </View>

              <View style={styles.todayCard}>
                <View style={styles.todayHeader}><Text accessibilityRole='header' style={styles.homeSectionTitle}>Today</Text><Pressable onPress={() => navigation?.navigate?.('Food', { date: today })} accessibilityRole='button' accessibilityLabel='Open meal log' style={interactive(styles.viewLogButton)}><Text style={styles.viewLogText}>View meal log</Text></Pressable></View>
                {todaysMeals.length ? todaysMeals.map((meal, index) => <View key={meal.id || `${meal.mealType}-${index}`} style={[styles.todayMealRow, index > 0 && styles.todayMealDivider]}><View style={styles.todayMealIcon}><Ionicons name='restaurant-outline' size={16} color={COLORS.brand} /></View><View style={styles.flex}><Text style={styles.todayMealType}>{meal.mealType || 'Meal'}</Text><Text numberOfLines={1} style={styles.todayMealName}>{meal.name || meal.mealName || (meal.skipped ? 'Meal skipped' : 'Meal logged')}</Text></View></View>) : <View style={styles.todayMealRow}><View style={styles.todayMealIcon}><Ionicons name='restaurant-outline' size={16} color={COLORS.brand} /></View><View style={styles.flex}><Text style={styles.todayMealType}>Meals</Text><Text style={styles.todayMealName}>Nothing logged yet</Text></View></View>}
                <View style={styles.contextRow}><Ionicons name={phaseLabel ? 'flower-outline' : 'calendar-outline'} size={18} color={COLORS.sage} /><Text style={styles.contextText}>{phaseLabel ? `${phaseLabel} context: appetite can shift, and that is only context.` : forecast.title}</Text></View>
              </View>

              <View style={styles.moreSection}>
                <Text accessibilityRole='header' style={styles.homeSectionTitle}>More for today</Text>
                <View onLayout={(event) => { sectionY.current.forecast = event.nativeEvent.layout.y; }}><MoreRow icon='analytics-outline' label='Craving forecast' detail={forecast.title} onPress={() => setNotice(forecast.body)} /></View>

                <Animated.View onLayout={(event) => { sectionY.current.kit = event.nativeEvent.layout.y; }} style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) }] }}><MoreRow icon='bag-handle-outline' label='Rescue kit' detail={kitItems.length ? `${kitItems.length} ${kitItems.length === 1 ? 'item' : 'items'} ready` : 'Build a small backup plan'} onPress={() => openSheet('kit')} /></Animated.View>

                <View onLayout={(event) => { sectionY.current.water = event.nativeEvent.layout.y; }} style={styles.moreWaterRow}><View style={styles.moreIcon}><Ionicons name='water-outline' size={18} color={COLORS.sage} /></View><View style={styles.flex}><Text style={styles.moreLabel}>Water</Text><Text style={styles.moreDetail}>{ui.daily.water} {ui.daily.water === 1 ? 'glass' : 'glasses'} today</Text></View><CounterButton icon='remove' label='Remove one glass of water' disabled={!ui.daily.water} onPress={() => updateWater(-1)} /><Text style={styles.waterCount}>{ui.daily.water}</Text><CounterButton icon='add' label='Add one glass of water' onPress={() => updateWater(1)} /></View>
                <View style={styles.checkRow}>{CHECKS.map((item) => { const selected = ui.daily.checks.includes(item.id); return <Pressable key={item.id} onPress={() => toggleCheck(item.id)} accessibilityRole='checkbox' accessibilityState={{ checked: selected }} style={interactive(styles.checkChip, selected && styles.checkChipSelected)}><Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selected ? COLORS.brand : COLORS.muted} /><Text style={[styles.checkChipText, selected && styles.checkChipTextSelected]}>{item.label}</Text></Pressable>; })}</View>

                <View onLayout={(event) => { sectionY.current.learn = event.nativeEvent.layout.y; }}><MoreRow icon='book-outline' label='Learn' detail='Food context without rules' onPress={() => openSheet('learn')} /></View>
                <MoreRow icon='stats-chart-outline' label='Your rescue data' detail={`${ui.outcomes.length} optional check-in${ui.outcomes.length === 1 ? '' : 's'}`} onPress={() => openSheet('stats')} last />
              </View>

              <View style={styles.section}><SectionHeader title='A small thing to know' subtitle='One useful idea—then back to your day.' action='More in Learn' onAction={() => openSheet('learn')} /><QuizCard quiz={quiz} choice={quizChoice} onAnswer={answerQuiz} /></View>
              <View style={styles.footer}><Text style={styles.footerGoal}>Today’s goal: answer hunger with care, not perfection.</Text><Text style={styles.footerText}>Bloom offers general food ideas, not medical or nutritional treatment. Check ingredients for your allergies and needs.</Text></View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <SosSheet visible={sheet === 'sos'} step={sosStep} results={rescueResults} ui={ui} pending={ui.pendingRescue} onClose={() => setSheet(null)} onChooseCraving={chooseCraving} onSelect={selectRescue} onBack={() => setSosStep('choose')} />
      <KitSheet visible={sheet === 'kit'} ui={ui} items={kitItems} onClose={() => setSheet(null)} onUpdate={updateKit} />
      <LearnSheet visible={sheet === 'learn'} ui={ui} revealed={revealedMyth} onReveal={setRevealedMyth} onClose={() => setSheet(null)} />
      <StatsSheet visible={sheet === 'stats'} ui={ui} favouriteId={favouriteId} onClose={() => setSheet(null)} />
    </SafeAreaView>
  );
}

function InlineAction({ label, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' style={interactive(styles.inlineButton)}><Text style={styles.inlineButtonText}>{label}</Text><Ionicons name='arrow-forward' size={17} color={COLORS.brand} /></Pressable>;
}

function HomeAction({ icon, label, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel={label} style={interactive(styles.homeAction)}><View style={styles.homeActionIcon}><Ionicons name={icon} size={19} color={COLORS.brand} /></View><Text style={styles.homeActionLabel}>{label}</Text></Pressable>;
}

function SuggestedRescue({ item, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel={`Choose ${item.name}`} style={interactive(styles.suggestedCard)}><View style={styles.suggestedArtwork}><Ionicons name={item.icon} size={25} color={COLORS.brand} /></View><View style={styles.flex}><Text style={styles.cardTitle}>{item.name}</Text><Text numberOfLines={2} style={styles.cardBody}>{item.detail}</Text><Text style={styles.meta}>{item.time} · about ₹{item.price}</Text></View><Ionicons name='chevron-forward' size={18} color={COLORS.muted} /></Pressable>;
}

function MoreRow({ icon, label, detail, onPress, last = false }) {
  return <Pressable onPress={onPress} accessibilityRole='button' accessibilityLabel={label} accessibilityHint={detail} style={interactive(styles.moreRow, last && styles.moreRowLast)}><View style={styles.moreIcon}><Ionicons name={icon} size={18} color={COLORS.brand} /></View><View style={styles.flex}><Text style={styles.moreLabel}>{label}</Text>{detail ? <Text numberOfLines={1} style={styles.moreDetail}>{detail}</Text> : null}</View><Ionicons name='chevron-forward' size={18} color={COLORS.muted} /></Pressable>;
}

function PendingCard({ item, onRate }) {
  return <View style={styles.pendingCard}><IconCircle name='checkmark-done-outline' tone='sage' /><View style={styles.flex}><Text style={styles.cardTitle}>Did that hit the craving?</Text><Text style={styles.cardBody}>{item.name}</Text><View style={styles.ratingRow}>{[['yes', 'Yes'], ['almost', 'Almost'], ['no', 'Not this time']].map(([id, label]) => <Pressable key={id} onPress={() => onRate(id)} accessibilityRole='button' style={interactive(styles.ratingButton, id === 'yes' && styles.ratingButtonPrimary)}><Text style={[styles.ratingLabel, id === 'yes' && styles.ratingLabelPrimary]}>{label}</Text></Pressable>)}</View></View></View>;
}

function KitSummary({ items, ids, onPress }) {
  return <Pressable onPress={onPress} accessibilityRole='button' style={interactive(styles.kitSummary)}><View style={styles.kitIcons}>{items.slice(0, 3).map((item, index) => <View key={item.id} style={[styles.kitMiniIcon, index > 0 && styles.kitMiniOverlap]}><Ionicons name={item.icon} size={17} color={COLORS.brand} /></View>)}</View><View style={styles.flex}><Text style={styles.cardTitle}>{items.length} {items.length === 1 ? 'item' : 'items'} ready</Text><Text style={styles.meta}>Estimated total ≈ ₹{kitEstimate(ids)}</Text></View><Ionicons name='chevron-forward' size={20} color={COLORS.muted} /></Pressable>;
}

function CounterButton({ icon, label, onPress, disabled }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole='button' accessibilityLabel={label} style={interactive(styles.counterButton)}><Ionicons name={icon} size={20} color={disabled ? COLORS.muted : COLORS.ink} /></Pressable>;
}

function QuizCard({ quiz, choice, onAnswer }) {
  return <View style={styles.quizCard}><View style={styles.quizIcon}><Ionicons name='bulb-outline' size={22} color={COLORS.brand} /></View><Text style={styles.cardTitle}>{quiz.question}</Text><View style={styles.quizOptions} accessibilityRole='radiogroup'>{quiz.options.map((option, index) => { const answered = choice !== undefined; const selected = choice === index; const correct = answered && index === quiz.answer; return <Pressable key={option} onPress={() => onAnswer(index)} disabled={answered} accessibilityRole='radio' accessibilityState={{ checked: selected, disabled: answered }} style={interactive(styles.quizOption, (selected || correct) && styles.quizOptionSelected)}><Text style={[styles.cardBody, (selected || correct) && styles.quizOptionTextSelected]}>{option}</Text>{correct ? <Ionicons name='checkmark' size={18} color={COLORS.sage} /> : null}</Pressable>; })}</View>{choice !== undefined ? <Text style={styles.quizExplanation} accessibilityLiveRegion='polite'>{choice === quiz.answer ? 'That’s it. ' : 'Worth knowing: '}{quiz.explanation}</Text> : null}</View>;
}

function SosSheet({ visible, step, results, ui, pending, onClose, onChooseCraving, onSelect, onBack }) {
  return <BottomSheet visible={visible} title={step === 'choose' ? 'What are you craving right now?' : 'Here are three gentle options'} subtitle={step === 'choose' ? 'No judgement. Pick the feeling, not the perfect food.' : 'Choose what feels satisfying and possible today.'} onClose={onClose}><ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={Platform.OS === 'web'}>{step === 'choose' ? <View>{CRAVING_TYPES.map((item) => <Pressable key={item.id} onPress={() => onChooseCraving(item.id)} accessibilityRole='button' style={interactive(styles.cravingChoice)}><IconCircle name={item.icon} /><Text style={styles.cravingLabel}>{item.label}</Text><Ionicons name='arrow-forward' size={18} color={COLORS.muted} /></Pressable>)}</View> : <View>{pending ? <View style={styles.sheetPending}><Text style={styles.sheetPendingTitle}>A rescue is waiting for your rating</Text><Text style={styles.cardBody}>{RESCUE_BY_ID.get(pending.id)?.name}</Text></View> : null}<View style={styles.resultList}>{results.map((item, index) => <View key={item.id} style={[styles.resultRow, index < results.length - 1 && styles.rowDivider]}><IconCircle name={item.icon} tone={index ? 'sage' : 'brand'} /><View style={styles.flex}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardBody}>{item.detail}</Text><Text style={styles.meta}>{item.time} · about ₹{item.price}{ui.kitIds.includes(item.id) ? ' · In your kit' : ''}</Text><View style={styles.resultActions}><Pressable onPress={() => onSelect(item)} accessibilityRole='button' style={interactive(styles.chooseResult)}><Text style={styles.chooseResultText}>Choose this</Text></Pressable><Pressable onPress={() => openSearch(item.searchTerm)} accessibilityRole='link' style={interactive(styles.orderLink)}><Text style={styles.orderLinkText}>Search the web</Text></Pressable></View></View></View>)}</View><Pressable onPress={onBack} accessibilityRole='button' style={interactive(styles.backChoice)}><Ionicons name='arrow-back' size={18} color={COLORS.ink} /><Text style={styles.backChoiceText}>Choose another craving</Text></Pressable></View>}</ScrollView></BottomSheet>;
}

function KitSheet({ visible, ui, items, onClose, onUpdate }) {
  return <BottomSheet visible={visible} title='My rescue kit' subtitle='Simple, satisfying options for lower-energy moments.' onClose={onClose}><ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={Platform.OS === 'web'}>{!ui.kitIds.length ? <View style={styles.sheetEmpty}><IconCircle name='bag-add-outline' /><Text style={styles.cardTitle}>Build a small safety net</Text><Text style={styles.cardBody}>Bloom’s starter kit has one sweet, one salty and one crunchy option.</Text><Button title='Add Bloom starter kit' onPress={() => onUpdate(DEFAULT_KIT_IDS)} /></View> : null}<View style={styles.kitList}>{RESCUE_CATALOG.map((item) => { const selected = ui.kitIds.includes(item.id); return <Pressable key={item.id} onPress={() => onUpdate((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} accessibilityRole='checkbox' accessibilityState={{ checked: selected }} style={interactive(styles.kitRow)}><View style={[styles.kitCheck, selected && styles.kitCheckSelected]}><Ionicons name={selected ? 'checkmark' : item.icon} size={18} color={selected ? COLORS.onBrand : COLORS.brand} /></View><View style={styles.flex}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.meta}>{item.detail} · ~₹{item.price}</Text></View><Text style={styles.kitToggleLabel}>{selected ? 'Remove' : 'Add'}</Text></Pressable>; })}</View><View style={styles.kitTotal}><Text style={styles.cardTitle}>Estimated kit total</Text><Text style={styles.kitTotalValue}>≈ ₹{kitEstimate(ui.kitIds)}</Text></View><Button title='Search for my kit items' icon='search-outline' disabled={!ui.kitIds.length} onPress={() => openSearch(items.map((item) => item.searchTerm).join(' '))} />{ui.kitIds.length ? <Button title='Reset to Bloom default' variant='secondary' onPress={() => onUpdate(DEFAULT_KIT_IDS)} style={styles.secondaryButton} /> : null}<Text style={styles.finePrint}>Bloom opens a web search and keeps your list here. Availability and prices vary.</Text></ScrollView></BottomSheet>;
}

function LearnSheet({ visible, ui, revealed, onReveal, onClose }) {
  return <BottomSheet visible={visible} title='Learn' subtitle='Food context without rules, shame or miracle claims.' onClose={onClose}><ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={Platform.OS === 'web'}><Text style={styles.sheetSectionTitle}>Smart swaps</Text>{SWAPS.map(([title, body]) => <View key={title} style={styles.learnRow}><IconCircle name='swap-horizontal-outline' /><View style={styles.flex}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardBody}>{body}</Text></View><Pressable onPress={() => Share.share({ message: `${title} ${body} — Bloom` })} accessibilityRole='button' accessibilityLabel={`Share ${title}`} style={interactive(styles.shareButton)}><Ionicons name='share-outline' size={19} color={COLORS.brand} /></Pressable></View>)}<Text style={styles.sheetSectionTitle}>Myths, gently unpacked</Text>{MYTHS.map(([title, body], index) => <Pressable key={title} onPress={() => onReveal(revealed === index ? null : index)} accessibilityRole='button' accessibilityState={{ expanded: revealed === index }} style={interactive(styles.mythRow)}><View style={styles.flex}><Text style={styles.cardTitle}>{title}</Text>{revealed === index ? <Text style={styles.cardBody}>{body}</Text> : null}</View><Ionicons name={revealed === index ? 'remove' : 'add'} size={20} color={COLORS.brand} /></Pressable>)}<Text style={styles.sheetSectionTitle}>Daily quiz archive</Text>{QUIZZES.map((item) => <View key={item.id} style={styles.archiveRow}><Ionicons name={ui.quizAnswers[item.id] !== undefined ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ui.quizAnswers[item.id] !== undefined ? COLORS.sage : COLORS.muted} /><Text style={styles.archiveText}>{item.question}</Text></View>)}<View style={styles.megPlaceholder}><Ionicons name='chatbubbles-outline' size={21} color={COLORS.muted} /><View style={styles.flex}><Text style={styles.cardTitle}>Ask Meg about this</Text><Text style={styles.cardBody}>Coming later. Meg will keep Diet questions private and grounded in reviewed content.</Text></View></View><Text style={styles.finePrint}>Educational content is general information. It does not diagnose, cure or replace care from a qualified professional.</Text></ScrollView></BottomSheet>;
}

function StatsSheet({ visible, ui, favouriteId, onClose }) {
  return <BottomSheet visible={visible} title='Your Rescue Data' subtitle='A private look at what has helped—not a score.' onClose={onClose}><ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={Platform.OS === 'web'}><View style={styles.statsGrid}><View style={styles.statCell}><Text style={styles.statValue}>{ui.outcomes.length}</Text><Text style={styles.statLabel}>Check-ins</Text></View><View style={styles.statCell}><Text style={styles.statValue}>{ui.outcomes.filter((item) => item.rating === 'yes').length}</Text><Text style={styles.statLabel}>Hit the spot</Text></View><View style={styles.statCell}><Text style={styles.statValue}>{new Set(ui.outcomes.map((item) => item.date)).size}</Text><Text style={styles.statLabel}>Days noticed</Text></View></View><Text style={styles.sheetSectionTitle}>Top rescues</Text>{favouriteId ? <View style={styles.topRescue}><IconCircle name={RESCUE_BY_ID.get(favouriteId)?.icon || 'restaurant-outline'} /><View style={styles.flex}><Text style={styles.cardTitle}>{RESCUE_BY_ID.get(favouriteId)?.name}</Text><Text style={styles.meta}>Based only on your optional ratings.</Text></View></View> : <View style={styles.sheetEmpty}><Text style={styles.cardTitle}>No pattern yet</Text><Text style={styles.cardBody}>After a few rescue ratings, Bloom can show what you tend to choose and enjoy.</Text></View>}<Text style={styles.finePrint}>Bloom describes your participation and choices. It never turns food into a streak you can fail.</Text></ScrollView></BottomSheet>;
}

const styles = createThemedStyles({
  safeArea: { flex: 1, minHeight: 0, backgroundColor: COLORS.canvas, ...Platform.select({ web: { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } }) },
  keyboard: { flex: 1, minHeight: 0 }, screen: { flex: 1, minHeight: 0, position: 'relative' },
  scroll: { flex: 1, minHeight: 0, ...Platform.select({ web: { height: '100%', maxHeight: '100%', overflowY: 'auto', overscrollBehaviorY: 'contain' } }) },
  scrollContent: { flexGrow: 1, paddingBottom: 40 }, content: { width: '100%', maxWidth: LAYOUT.phoneMaxWidth || 430, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14 }, flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }, title: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink }, subtitle: { ...TYPOGRAPHY.body, color: COLORS.body, marginTop: 2 },
  privateBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 18, backgroundColor: COLORS.sageLight }, privateBadgeText: { ...TYPOGRAPHY.caption, color: COLORS.body, fontWeight: '600' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 14, paddingRight: 4, marginBottom: 16, backgroundColor: COLORS.sageLight, borderRadius: 12 }, noticeText: { ...TYPOGRAPHY.supporting, color: COLORS.body, flex: 1 }, noticeDismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  pendingCard: { flexDirection: 'row', gap: 14, padding: 18, marginBottom: 16, backgroundColor: COLORS.sageLight, borderRadius: 16 }, ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  ratingButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.hairline }, ratingButtonPrimary: { backgroundColor: COLORS.brand, borderColor: COLORS.brand }, ratingLabel: { ...TYPOGRAPHY.supporting, fontWeight: '600', color: COLORS.ink }, ratingLabelPrimary: { color: COLORS.white },
  phaseBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, marginBottom: 16, borderRadius: 16, backgroundColor: COLORS.surfaceSoft }, phaseTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink }, phaseText: { ...TYPOGRAPHY.supporting, color: COLORS.body, marginTop: 2 },
  homeSection: { marginBottom: 24 }, homeSectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: COLORS.ink },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, homeAction: { flexGrow: 1, flexBasis: '47%', minHeight: 72, justifyContent: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, backgroundColor: COLORS.surfaceSoft }, homeActionIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, homeActionLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.ink },
  suggestionList: { gap: 8, marginTop: 10 }, suggestedCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, backgroundColor: COLORS.canvas }, suggestedArtwork: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.surfaceWarm },
  todayCard: { marginBottom: 24, padding: 14, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, backgroundColor: COLORS.canvas }, todayHeader: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, viewLogButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 10 }, viewLogText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: COLORS.brand }, todayMealRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, todayMealDivider: { borderTopWidth: 1, borderTopColor: COLORS.hairline }, todayMealIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: COLORS.brandSoft }, todayMealType: { fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', color: COLORS.muted }, todayMealName: { marginTop: 1, fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.ink }, contextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, paddingTop: 11, borderTopWidth: 1, borderTopColor: COLORS.hairline }, contextText: { flex: 1, fontSize: 12, lineHeight: 17, color: COLORS.body },
  moreSection: { marginBottom: 28 }, moreRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: COLORS.hairline, paddingVertical: 8 }, moreRowLast: { borderBottomWidth: 0 }, moreIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.surfaceSoft }, moreLabel: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: COLORS.ink }, moreDetail: { marginTop: 1, fontSize: 11, lineHeight: 15, color: COLORS.muted }, moreWaterRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: COLORS.hairline, paddingVertical: 8 },
  sosHero: { minHeight: 264, justifyContent: 'space-between', padding: 24, borderRadius: 16, backgroundColor: COLORS.brandSoft, marginBottom: 32, overflow: 'hidden' }, sosTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5, color: COLORS.ink }, sosBody: { ...TYPOGRAPHY.body, color: COLORS.body, marginTop: 10, maxWidth: 500 },
  sosButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingLeft: 20, paddingRight: 7, borderRadius: 14, backgroundColor: COLORS.brand }, sosButtonText: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: COLORS.white }, sosArrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white }, sosPromise: { ...TYPOGRAPHY.caption, color: COLORS.body, textAlign: 'center', marginTop: 10 },
  section: { marginBottom: 32 }, sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginBottom: 12 }, sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink }, sectionSubtitle: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginTop: 3 },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 10 }, textActionLabel: { ...TYPOGRAPHY.supporting, fontWeight: '600', color: COLORS.brand }, iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft }, iconCircleSage: { backgroundColor: COLORS.sageLight },
  forecastCard: { padding: 20, borderRadius: 16, backgroundColor: COLORS.surfaceWarm }, rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 }, cardTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink }, cardBody: { ...TYPOGRAPHY.supporting, color: COLORS.body, marginTop: 3 }, meta: { ...TYPOGRAPHY.caption, color: COLORS.muted, marginTop: 5 },
  inlineButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 2, borderRadius: 10 }, inlineButtonText: { ...TYPOGRAPHY.supporting, fontWeight: '700', color: COLORS.brand },
  rescueRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 104, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline }, chooseBadge: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: COLORS.brandSoft }, chooseBadgeText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  kitSummary: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: COLORS.surfaceSoft }, kitIcons: { flexDirection: 'row', paddingLeft: 5 }, kitMiniIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.surfaceSoft }, kitMiniOverlap: { marginLeft: -10 }, kitEmpty: { flexDirection: 'row', gap: 14, padding: 20, borderRadius: 16, backgroundColor: COLORS.surfaceSoft },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 82, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline }, counterButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.surfaceSoft }, waterCount: { minWidth: 24, textAlign: 'center', fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  checkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, checkChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 22, backgroundColor: COLORS.surfaceSoft }, checkChipSelected: { backgroundColor: COLORS.brandSoft }, checkChipText: { ...TYPOGRAPHY.supporting, color: COLORS.body }, checkChipTextSelected: { color: COLORS.brand, fontWeight: '600' },
  quizCard: { padding: 20, borderRadius: 16, backgroundColor: COLORS.surfaceSoft }, quizIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft, marginBottom: 14 }, quizOptions: { gap: 8, marginTop: 14 }, quizOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.hairline }, quizOptionSelected: { backgroundColor: COLORS.sageLight, borderColor: COLORS.sage }, quizOptionTextSelected: { color: COLORS.ink, fontWeight: '600' }, quizExplanation: { ...TYPOGRAPHY.supporting, color: COLORS.body, marginTop: 14 },
  statsStrip: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, marginBottom: 28, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline }, statsAction: { flexDirection: 'row', alignItems: 'center', gap: 4 }, statsActionText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' }, footer: { paddingBottom: 20 }, footerGoal: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink, marginBottom: 8 }, footerText: { ...TYPOGRAPHY.caption, color: COLORS.muted, maxWidth: 600 },
  quickBarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }, quickBar: { backgroundColor: COLORS.canvas, borderBottomWidth: 1, borderBottomColor: COLORS.hairline, ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } }) }, quickBarContent: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7 }, quickChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 22, backgroundColor: COLORS.surfaceSoft }, quickChipPrimary: { backgroundColor: COLORS.brand }, quickChipText: { ...TYPOGRAPHY.caption, color: COLORS.body, fontWeight: '600' }, quickChipTextPrimary: { color: COLORS.white },
  modalLayer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(18,17,19,0.48)' }, sheet: { width: '100%', maxWidth: 720, maxHeight: '92%', minHeight: 320, backgroundColor: COLORS.canvas, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden', ...Platform.select({ web: { boxShadow: '0 -2px 18px rgba(0,0,0,0.16)' } }) }, sheetHandleTouch: { minHeight: 28, alignItems: 'center', justifyContent: 'center', ...Platform.select({ web: { cursor: 'grab' } }) }, sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.hairline }, sheetTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: COLORS.ink }, sheetSubtitle: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginTop: 3 }, closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: COLORS.surfaceSoft }, sheetScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0, ...Platform.select({ web: { overflowY: 'auto' } }) }, sheetContent: { padding: 20, paddingBottom: 36 },
  cravingChoice: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.hairline }, cravingLabel: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink, flex: 1 }, sheetPending: { padding: 14, marginBottom: 12, borderRadius: 12, backgroundColor: COLORS.sageLight }, sheetPendingTitle: { ...TYPOGRAPHY.caption, color: COLORS.body, fontWeight: '700' }, resultList: { gap: 10 }, resultRow: { flexDirection: 'row', gap: 14, padding: 16, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 14, backgroundColor: COLORS.canvas }, rowDivider: {}, resultActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, chooseResult: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.brand }, chooseResultText: { ...TYPOGRAPHY.supporting, color: COLORS.onBrand, fontWeight: '700' }, orderLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.surfaceSoft }, orderLinkText: { ...TYPOGRAPHY.supporting, color: COLORS.ink, fontWeight: '600' }, backChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12 }, backChoiceText: { ...TYPOGRAPHY.supporting, color: COLORS.ink, fontWeight: '600' },
  sheetEmpty: { gap: 10, padding: 20, marginBottom: 16, borderRadius: 16, backgroundColor: COLORS.surfaceSoft }, kitList: { gap: 10 }, kitRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 14, backgroundColor: COLORS.canvas }, kitCheck: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft }, kitCheckSelected: { backgroundColor: COLORS.brand }, kitToggleLabel: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' }, kitTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 }, kitTotalValue: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] }, secondaryButton: { marginTop: 10 }, finePrint: { ...TYPOGRAPHY.caption, color: COLORS.muted, marginTop: 16 },
  sheetSectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, marginTop: 18, marginBottom: 10 }, learnRow: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.hairline }, shareButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, mythRow: { minHeight: 60, flexDirection: 'row', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.hairline }, archiveRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 }, archiveText: { ...TYPOGRAPHY.supporting, color: COLORS.body, flex: 1 }, megPlaceholder: { flexDirection: 'row', gap: 12, padding: 16, marginTop: 24, borderRadius: 16, backgroundColor: COLORS.surfaceSoft },
  statsGrid: { flexDirection: 'row', backgroundColor: COLORS.surfaceSoft, borderRadius: 16, overflow: 'hidden' }, statCell: { flex: 1, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 6 }, statValue: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] }, statLabel: { ...TYPOGRAPHY.caption, color: COLORS.muted, textAlign: 'center', marginTop: 2 }, topRescue: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { ...TYPOGRAPHY.body, color: COLORS.body }, hovered: { opacity: 0.88 }, focused: Platform.select({ web: WEB_FOCUS, default: {} }), pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
