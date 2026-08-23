import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eachDayOfInterval, format, isValid, parseISO, subDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { buildPersonalInsights } from '../services/insights';
import { ARTICLES } from '../data/content';
import { COLORS, createThemedStyles, LAYOUT } from '../utils/constants';
import ArticleCard from '../components/ArticleCard';
import Button from '../components/Button';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import { MotionScrollView, ScrollReveal, useReducedMotion } from '../components/Motion';

const TABS = ['My patterns', 'Learn'];
const MILESTONES = [1, 3, 7, 14];

function InsightTabs({ activeTab, onChange }) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useRef(new Animated.Value(activeTab === 'Learn' ? 1 : 0)).current;
  const optionWidth = width ? (width - 16) / 2 : 0;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: activeTab === 'Learn' ? 1 : 0,
      duration: reduceMotion ? 0 : 190,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeTab, progress, reduceMotion]);

  return (
    <View style={styles.tabs} accessibilityRole='tablist' onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {optionWidth ? (
        <Animated.View
          style={[
            styles.tabIndicator,
            styles.nonInteractive,
            { width: optionWidth, transform: [{ translateX: Animated.multiply(progress, optionWidth + 6) }] },
          ]}
        />
      ) : null}
      {TABS.map((tab) => {
        const selected = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            accessibilityRole='tab'
            accessibilityState={{ selected }}
            style={({ pressed, hovered, focused }) => [
              styles.tab,
              hovered && !selected && styles.tabHovered,
              focused && styles.tabFocused,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={tab === 'My patterns' ? 'analytics-outline' : 'book-outline'} size={18} color={selected ? COLORS.white : COLORS.body} />
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function topValue(values) {
  const counts = {};
  values.filter(Boolean).forEach((value) => { counts[value] = (counts[value] || 0) + 1; });
  const result = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return result ? { value: result[0].replace(/_/g, ' '), count: result[1] } : null;
}

function stageFor(count) {
  if (count === 0) return { title: 'Your first observation starts with one check-in', body: 'Log only what feels useful. Bloom will begin with a simple daily summary.', next: 1 };
  if (count < 3) return { title: 'Your daily summary is ready', body: 'At 3 check-ins, Bloom can begin showing frequent symptoms and moods.', next: 3 };
  if (count < 7) return { title: 'Early signals are taking shape', body: 'At 7 check-ins, Bloom can add a small weekly view of sleep and care habits.', next: 7 };
  if (count < 14) return { title: 'Weekly patterns are available', body: 'At 14 check-ins, Bloom can carefully compare entries that contain the same signals.', next: 14 };
  return { title: 'Your history supports deeper observations', body: 'Bloom will keep showing evidence and confidence without treating a pattern as a diagnosis.', next: null };
}

function articleRecommendation(state) {
  const checkins = safeArray(state.checkins).filter((item) => item?.date).sort((a, b) => b.date.localeCompare(a.date));
  const latest = checkins[0];
  const symptoms = safeArray(latest?.symptoms);
  const goals = [...safeArray(state.profile?.goals), ...safeArray(state.settings?.goals)].join(' ').toLowerCase();

  if (latest?.sleep != null && Number(latest.sleep) < 6) {
    return { id: 'rest-1', reason: 'Because you recently logged a shorter night of sleep' };
  }
  if (symptoms.includes('fatigue') || (latest?.energy != null && Number(latest.energy) <= 4)) {
    return { id: 'rest-1', reason: 'Because you recently logged fatigue or lower energy' };
  }
  if (['low', 'anxious', 'overwhelmed', 'emotionally_sensitive'].includes(latest?.mood)) {
    return { id: 'pcos-basics-2', reason: 'Because emotional wellbeing appeared in your recent check-in' };
  }
  if (symptoms.includes('cravings') || goals.includes('food') || goals.includes('nutrition')) {
    return { id: 'nutrition-1', reason: 'Relevant to the food-support goal you selected' };
  }
  if (goals.includes('irregular')) {
    return { id: 'understanding-2', reason: 'Relevant to your goal of understanding irregular cycles' };
  }
  if (goals.includes('movement') || safeArray(state.movements).length) {
    return { id: 'movement-1', reason: 'Relevant to movement you have chosen or logged' };
  }
  if (state.profile?.pcosStatus === 'diagnosed' || state.settings?.trackingMode === 'pcos' || goals.includes('pcos')) {
    return { id: 'pcos-basics-1', reason: 'Relevant to the deeper PCOS support you selected' };
  }
  if (safeArray(state.meals).length) {
    return { id: 'nutrition-1', reason: 'Because food support is part of your recent Bloom activity' };
  }
  return { id: 'understanding-1', reason: 'A useful starting point for noticing your own signals' };
}

export default function InsightsScreen({ navigation, route }) {
  const { state, toggleBookmark } = useApp();
  const requestedTab = String(route?.params?.tab || '').toLowerCase() === 'learn' ? 'Learn' : 'My patterns';
  const [activeTab, setActiveTab] = useState(requestedTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [learnNotice, setLearnNotice] = useState(null);

  useEffect(() => {
    if (route?.params?.tab) setActiveTab(requestedTab);
  }, [requestedTab, route?.params?.tab]);

  const checkins = safeArray(state.checkins).filter((item) => item?.date && isValid(parseISO(item.date)));
  const periods = safeArray(state.periods).filter((item) => item?.startDate && isValid(parseISO(item.startDate)));
  const meals = safeArray(state.meals);
  const movements = safeArray(state.movements);
  const bookmarks = safeArray(state.bookmarks);
  const insights = useMemo(
    () => buildPersonalInsights({ checkins, periods, meals, movements }),
    [checkins, periods, meals, movements]
  );
  const stage = stageFor(checkins.length);

  const weekly = useMemo(() => {
    const end = new Date();
    const days = eachDayOfInterval({ start: subDays(end, 6), end }).map((day) => {
      const date = format(day, 'yyyy-MM-dd');
      const checkin = checkins.find((item) => item.date === date);
      return {
        date,
        label: format(day, 'EEEEE'),
        spokenLabel: format(day, 'EEEE'),
        energy: checkin?.energy == null ? null : Number(checkin.energy),
        sleep: checkin?.sleep == null ? null : Number(checkin.sleep),
        hasCheckin: Boolean(checkin),
      };
    });
    const dates = new Set(days.map((day) => day.date));
    const weekCheckins = checkins.filter((item) => dates.has(item.date));
    const sleepEntries = weekCheckins.filter((item) => item.sleep != null && Number.isFinite(Number(item.sleep)));
    const mealDays = new Set(meals.filter((item) => dates.has(item.date)).map((item) => item.date));
    const movementDays = new Set(movements.filter((item) => dates.has(item.date) && item.status !== 'not_today').map((item) => item.date));
    const commonSymptom = topValue(weekCheckins.flatMap((item) => safeArray(item.symptoms)));
    return {
      days,
      checkins: weekCheckins.length,
      mealDays: mealDays.size,
      movementDays: movementDays.size,
      averageSleep: sleepEntries.length ? sleepEntries.reduce((sum, item) => sum + Number(item.sleep), 0) / sleepEntries.length : null,
      commonSymptom,
    };
  }, [checkins, meals, movements]);

  const categories = useMemo(() => ['All', 'Saved', ...new Set(ARTICLES.map((article) => article.category))], []);
  const recommendation = useMemo(() => articleRecommendation(state), [state]);
  const recommendedArticle = ARTICLES.find((article) => article.id === recommendation.id) || ARTICLES[0];
  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ARTICLES.filter((article) => {
      const categoryMatch = selectedCategory === 'All'
        || (selectedCategory === 'Saved' && bookmarks.includes(article.id))
        || article.category === selectedCategory;
      const searchMatch = !query
        || article.title.toLowerCase().includes(query)
        || article.category.toLowerCase().includes(query)
        || String(article.author || '').toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
  }, [bookmarks, searchQuery, selectedCategory]);
  const showingLearnDefault = !searchQuery.trim() && selectedCategory === 'All';
  const listArticles = showingLearnDefault
    ? filteredArticles.filter((article) => article.id !== recommendedArticle.id)
    : filteredArticles;

  function openArticle(article) {
    navigation.navigate('Article', { articleId: article.id });
  }

  async function handleBookmark(article) {
    setLearnNotice(null);
    try {
      const wasSaved = bookmarks.includes(article.id);
      await toggleBookmark(article.id);
      setLearnNotice(wasSaved ? 'Removed from saved articles.' : 'Saved locally for later.');
    } catch (error) {
      setLearnNotice('This article could not be updated. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <MotionScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
        <View style={styles.inner}>
          <ScreenHeader title='Insights' subtitle='Your patterns and trusted learning, kept in one place.' />

          <InsightTabs activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'My patterns' ? (
            <PatternsTab
              navigation={navigation}
              checkinCount={checkins.length}
              periodCount={periods.length}
              stage={stage}
              weekly={weekly}
              insights={insights}
            />
          ) : (
            <LearnTab
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              categories={categories}
              recommendation={recommendation}
              recommendedArticle={recommendedArticle}
              showingDefault={showingLearnDefault}
              articles={listArticles}
              bookmarks={bookmarks}
              notice={learnNotice}
              onOpen={openArticle}
              onBookmark={handleBookmark}
            />
          )}
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

function PatternsTab({ navigation, checkinCount, periodCount, stage, weekly, insights }) {
  if (checkinCount === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}><Ionicons name='analytics-outline' size={27} color={COLORS.brand} /></View>
        <Text style={styles.emptyTitle}>Your patterns begin with you</Text>
        <Text style={styles.emptyText}>A single check-in can create a useful daily summary. Bloom will not fill this space with guessed medical insights.</Text>
        <Button title='Start a check-in' icon='add-circle-outline' onPress={() => navigation.navigate('DailyCheckIn')} style={styles.emptyButton} />
      </View>
    );
  }

  return (
    <View>
      <Card variant={checkinCount >= 7 ? 'sage' : 'brandSoft'} style={styles.stageCard}>
        <View style={styles.stageTop}>
          <View style={styles.stageIcon}><Ionicons name={checkinCount >= 7 ? 'leaf-outline' : 'sparkles-outline'} size={21} color={checkinCount >= 7 ? COLORS.sage : COLORS.brand} /></View>
          <View style={styles.flex}><Text style={styles.stageTitle}>{stage.title}</Text><Text style={styles.stageBody}>{stage.body}</Text></View>
        </View>
        <View style={styles.milestones}>
          {MILESTONES.map((milestone) => (
            <View key={milestone} style={styles.milestoneItem}>
              <View style={[styles.milestoneDot, checkinCount >= milestone && styles.milestoneDotActive]}><Ionicons name={checkinCount >= milestone ? 'checkmark' : 'ellipse'} size={13} color={checkinCount >= milestone ? COLORS.white : COLORS.muted} /></View>
              <Text style={styles.milestoneText}>{milestone}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.stageMeta}>{checkinCount} {checkinCount === 1 ? 'check-in' : 'check-ins'} / {periodCount} {periodCount === 1 ? 'cycle start' : 'cycle starts'} logged</Text>
      </Card>

      <ScrollReveal style={styles.section}>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Your last 7 days</Text><Text style={styles.sectionSubtitle}>A compact view of what you chose to log.</Text></View></View>
        <View style={styles.statGrid}>
          <Stat label='Check-ins' value={weekly.checkins} />
          <Stat label='Meal days' value={weekly.mealDays} />
          <Stat label='Movement days' value={weekly.movementDays} />
          <Stat label='Sleep average' value={weekly.averageSleep == null ? '—' : `${weekly.averageSleep.toFixed(1)}h`} />
        </View>
        <Card variant='cream' style={styles.trendCard}>
          <TrendBars title='Energy' days={weekly.days} field='energy' max={10} color={COLORS.brand} />
          <View style={styles.trendDivider} />
          <TrendBars title='Sleep' days={weekly.days} field='sleep' max={9} color={COLORS.sage} suffix=' hours' />
          {weekly.commonSymptom ? <Text style={styles.commonSignal}>Most noted this week: {weekly.commonSymptom.value} ({weekly.commonSymptom.count})</Text> : null}
        </Card>
      </ScrollReveal>

      <ScrollReveal style={styles.section}>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>What Bloom noticed</Text><Text style={styles.sectionSubtitle}>Evidence comes first; every next step is optional.</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{insights.length}</Text></View></View>
        {insights.map((item) => <PersonalInsightCard key={item.id} insight={item} />)}
      </ScrollReveal>
    </View>
  );
}

function Stat({ label, value }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function TrendBars({ title, days, field, max, color, suffix = '' }) {
  return (
    <View style={styles.trendRow}>
      <Text style={styles.trendTitle}>{title}</Text>
      <View style={styles.barArea}>
        {days.map((day) => {
          const value = Number.isFinite(day[field]) ? day[field] : null;
          const height = value == null ? 3 : Math.max(6, Math.min(40, value / max * 40));
          return (
            <View key={day.date} style={styles.barColumn} accessible accessibilityLabel={`${day.spokenLabel}: ${value == null ? `${title} not logged` : `${value}${suffix}`}`}>
              <View style={styles.barTrack}><View style={[styles.bar, { height, backgroundColor: value == null ? COLORS.hairline : color }]} /></View>
              <Text style={styles.dayLabel}>{day.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PersonalInsightCard({ insight }) {
  const icons = { Symptoms: 'pulse-outline', Mood: 'heart-outline', Sleep: 'moon-outline', 'Cycle changes': 'calendar-outline', 'Food and movement': 'leaf-outline', 'Weekly progress': 'today-outline' };
  return (
    <Card style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <View style={styles.insightIcon}><Ionicons name={icons[insight.category] || 'analytics-outline'} size={20} color={COLORS.brand} /></View>
        <View style={styles.flex}><Text style={styles.insightCategory}>{insight.category}</Text><Text style={styles.insightTitle}>{insight.title}</Text></View>
        <View style={styles.confidenceBadge}><Text style={styles.confidenceText}>{insight.confidenceLabel}</Text></View>
      </View>
      <Text style={styles.observation}>{insight.observation}</Text>
      <View style={styles.evidenceRow}><Ionicons name='document-text-outline' size={16} color={COLORS.muted} /><View style={styles.flex}><Text style={styles.evidenceLabel}>Entries used</Text><Text style={styles.evidenceText}>{insight.evidence}</Text></View></View>
      {insight.nextStep ? <View style={styles.nextStep}><Ionicons name='arrow-forward-circle-outline' size={18} color={COLORS.sage} /><View style={styles.flex}><Text style={styles.nextStepLabel}>An optional next step</Text><Text style={styles.nextStepText}>{insight.nextStep}</Text></View></View> : null}
      <Text style={styles.disclaimer}>{insight.disclaimer || 'This is an observation, not a diagnosis.'}</Text>
    </Card>
  );
}

function LearnTab({ searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, categories, recommendation, recommendedArticle, showingDefault, articles, bookmarks, notice, onOpen, onBookmark }) {
  const [searchFocused, setSearchFocused] = useState(false);
  return (
    <View>
      {notice ? <View style={styles.learnNotice} accessibilityLiveRegion='polite'><Ionicons name='information-circle-outline' size={19} color={COLORS.brand} /><Text style={styles.learnNoticeText}>{notice}</Text></View> : null}
      <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
        <Ionicons name='search-outline' size={20} color={COLORS.muted} />
        <TextInput style={styles.searchInput} placeholder='Search by topic or author' placeholderTextColor={COLORS.muted} value={searchQuery} onChangeText={setSearchQuery} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} returnKeyType='search' accessibilityLabel='Search learning articles' />
        {searchQuery ? <Pressable onPress={() => setSearchQuery('')} accessibilityRole='button' accessibilityLabel='Clear search' style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}><Ionicons name='close-circle' size={21} color={COLORS.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
        {categories.map((category) => {
          const selected = selectedCategory === category;
          return <Pressable key={category} onPress={() => setSelectedCategory(category)} accessibilityRole='button' accessibilityState={{ selected }} style={({ pressed, hovered, focused }) => [styles.categoryChip, hovered && !selected && styles.categoryChipHovered, selected && styles.categoryChipSelected, focused && styles.tabFocused, pressed && styles.pressed]}><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category}</Text></Pressable>;
        })}
      </ScrollView>

      {showingDefault ? (
        <ScrollReveal style={styles.section}>
          <View style={styles.reasonCard}><Ionicons name='sparkles-outline' size={18} color={COLORS.brand} /><View style={styles.flex}><Text style={styles.reasonLabel}>Picked for you</Text><Text style={styles.reasonText}>{recommendation.reason}</Text></View></View>
          <ArticleCard article={recommendedArticle} featured bookmarked={bookmarks.includes(recommendedArticle.id)} onPress={() => onOpen(recommendedArticle)} onBookmark={() => onBookmark(recommendedArticle)} />
        </ScrollReveal>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{searchQuery.trim() ? 'Search results' : selectedCategory === 'All' ? 'Explore more' : selectedCategory}</Text><Text style={styles.resultCount}>{articles.length} {articles.length === 1 ? 'article' : 'articles'}</Text></View>
        {articles.map((article) => <ArticleCard key={article.id} article={article} bookmarked={bookmarks.includes(article.id)} onPress={() => onOpen(article)} onBookmark={() => onBookmark(article)} />)}
        {articles.length === 0 ? <View style={styles.learnEmpty}><View style={styles.emptyIconSmall}><Ionicons name={selectedCategory === 'Saved' ? 'bookmark-outline' : 'book-outline'} size={23} color={COLORS.brand} /></View><Text style={styles.emptyTitle}>{selectedCategory === 'Saved' ? 'No saved articles yet' : 'No close match yet'}</Text><Text style={styles.emptyText}>{selectedCategory === 'Saved' ? 'Use the bookmark on any article to keep it here.' : 'Try another phrase or choose a different topic.'}</Text></View> : null}
        <View style={styles.educationNote}><Ionicons name='shield-checkmark-outline' size={17} color={COLORS.sage} /><Text style={styles.educationText}>Articles offer general education and do not replace personal medical advice.</Text></View>
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { paddingBottom: 48 },
  inner: { width: '100%', maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.screenPadding, paddingTop: 24 },
  flex: { flex: 1 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.99 }] },
  tabs: { position: 'relative', flexDirection: 'row', gap: 6, padding: 5, marginBottom: 24, borderRadius: 14, backgroundColor: COLORS.surfaceSoft },
  tabIndicator: { position: 'absolute', top: 5, left: 5, height: 44, borderRadius: 10, backgroundColor: COLORS.ink },
  nonInteractive: { pointerEvents: 'none' },
  tab: { zIndex: 1, flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10, ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'background-color, opacity, transform', transitionDuration: '150ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)', outlineStyle: 'none' } }) },
  tabHovered: { backgroundColor: 'rgba(255,255,255,0.68)' },
  tabFocused: Platform.select({ web: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: COLORS.brand, outlineOffset: -2 }, default: {} }),
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.body },
  tabTextSelected: { color: COLORS.white },
  emptyState: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: COLORS.brandSoft },
  emptyTitle: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: COLORS.ink, textAlign: 'center' },
  emptyText: { maxWidth: 430, marginTop: 7, fontSize: 14, lineHeight: 21, color: COLORS.muted, textAlign: 'center' },
  emptyButton: { width: '100%', maxWidth: 300, marginTop: 20 },
  stageCard: { marginBottom: 28, padding: 18 },
  stageTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stageIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  stageTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: COLORS.ink },
  stageBody: { marginTop: 4, fontSize: 14, lineHeight: 20, color: COLORS.body },
  milestones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 4 },
  milestoneItem: { alignItems: 'center', gap: 4 },
  milestoneDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.hairline },
  milestoneDotActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  milestoneText: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: COLORS.muted },
  stageMeta: { marginTop: 12, fontSize: 11, lineHeight: 16, color: COLORS.muted, textAlign: 'center' },
  section: { marginBottom: 30 },
  sectionHeading: { minHeight: 32, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
  sectionTitle: { flexShrink: 1, fontSize: 20, lineHeight: 26, fontWeight: '700', color: COLORS.ink },
  sectionSubtitle: { marginTop: 3, fontSize: 13, lineHeight: 18, color: COLORS.muted },
  countBadge: { minWidth: 30, minHeight: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: COLORS.brandSoft },
  countText: { fontSize: 12, fontWeight: '800', color: COLORS.brand },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  stat: { width: '48%', flexGrow: 1, minHeight: 82, justifyContent: 'center', padding: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.surfaceSoft },
  statValue: { fontSize: 21, lineHeight: 26, fontWeight: '700', color: COLORS.ink },
  statLabel: { marginTop: 3, fontSize: 12, lineHeight: 16, color: COLORS.muted },
  trendCard: { padding: 16 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trendTitle: { width: 48, fontSize: 12, lineHeight: 16, fontWeight: '700', color: COLORS.body },
  barArea: { flex: 1, height: 62, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  barColumn: { flex: 1, height: 62, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { height: 42, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 9, borderRadius: 5 },
  dayLabel: { marginTop: 4, fontSize: 9, lineHeight: 12, fontWeight: '700', color: COLORS.muted },
  trendDivider: { height: 1, marginVertical: 13, backgroundColor: COLORS.hairline },
  commonSignal: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.hairline, fontSize: 12, lineHeight: 17, color: COLORS.body, textTransform: 'capitalize' },
  insightCard: { marginBottom: 10, padding: 18 },
  insightHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  insightIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandSoft },
  insightCategory: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: COLORS.brand },
  insightTitle: { marginTop: 2, fontSize: 16, lineHeight: 21, fontWeight: '700', color: COLORS.ink },
  confidenceBadge: { maxWidth: 112, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12, backgroundColor: COLORS.surfaceSoft },
  confidenceText: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: COLORS.body, textAlign: 'center' },
  observation: { marginTop: 14, fontSize: 15, lineHeight: 22, color: COLORS.body },
  evidenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  evidenceLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: COLORS.muted },
  evidenceText: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.body },
  nextStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 13, padding: 12, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.sageLight },
  nextStepLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: COLORS.sage },
  nextStepText: { marginTop: 2, fontSize: 13, lineHeight: 19, color: COLORS.body },
  disclaimer: { marginTop: 11, fontSize: 10, lineHeight: 15, color: COLORS.muted },
  learnNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14, padding: 12, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.brandSoft },
  learnNoticeText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.body },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 14, paddingRight: 5, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.white, ...Platform.select({ web: { transitionProperty: 'border-color, box-shadow', transitionDuration: '170ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' } }) },
  searchBoxFocused: { borderColor: COLORS.brand, ...Platform.select({ web: { boxShadow: `0 0 0 2px ${COLORS.brandSoft}` } }) },
  searchInput: { flex: 1, minWidth: 0, minHeight: 50, fontSize: 15, color: COLORS.ink },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  categories: { gap: 8, paddingTop: 13, paddingBottom: 5, paddingRight: 20 },
  categoryChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 22, backgroundColor: COLORS.white, ...Platform.select({ web: { cursor: 'pointer', transitionProperty: 'background-color, border-color, transform', transitionDuration: '150ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)', outlineStyle: 'none' } }) },
  categoryChipHovered: { backgroundColor: COLORS.surfaceSoft, borderColor: COLORS.muted },
  categoryChipSelected: { borderColor: COLORS.ink, backgroundColor: COLORS.ink },
  categoryText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.body },
  categoryTextSelected: { color: COLORS.white },
  reasonCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 10, padding: 13, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.brandSoft },
  reasonLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: COLORS.brand },
  reasonText: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.body },
  resultCount: { paddingTop: 5, fontSize: 12, lineHeight: 16, color: COLORS.muted },
  learnEmpty: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.hairline },
  emptyIconSmall: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: COLORS.brandSoft },
  educationNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  educationText: { flex: 1, fontSize: 11, lineHeight: 16, color: COLORS.muted },
});
