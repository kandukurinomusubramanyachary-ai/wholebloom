import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, LAYOUT } from '../utils/constants';
import { ARTICLES } from '../data/content';
import ArticleCard from '../components/ArticleCard';
import ScreenHeader from '../components/ScreenHeader';
import { MotionScrollView, ScrollReveal } from '../components/Motion';

export default function LearnScreen({ navigation }) {
  const { state, toggleBookmark } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = useMemo(() => ['All', ...new Set(ARTICLES.map((article) => article.category))], []);
  const featuredArticle = ARTICLES[0];

  const filteredArticles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return ARTICLES.filter((article) => {
      const matchesCategory = selectedCategory === 'All' || article.category === selectedCategory;
      const matchesSearch = !normalizedQuery
        || article.title.toLowerCase().includes(normalizedQuery)
        || article.category.toLowerCase().includes(normalizedQuery)
        || article.author.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const showingDefault = !searchQuery.trim() && selectedCategory === 'All';
  const listArticles = showingDefault
    ? filteredArticles.filter((article) => article.id !== featuredArticle.id)
    : filteredArticles;

  function openArticle(article) {
    navigation.navigate('Article', { articleId: article.id });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <MotionScrollView
        style={styles.screen}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.inner}>
          <ScreenHeader
            title='Learn'
            subtitle='Clear, culturally familiar guidance for understanding PCOS.'
          />

          <View style={styles.searchBox}>
            <Ionicons name='search-outline' size={20} color={COLORS.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder='Search by topic or author'
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType='search'
              accessibilityLabel='Search learning articles'
            />
            {searchQuery ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                accessibilityRole='button'
                accessibilityLabel='Clear search'
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Ionicons name='close-circle' size={20} color={COLORS.muted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {categories.map((category) => {
              const selected = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedCategory(category)}
                  accessibilityRole='button'
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    selected && styles.categoryChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {showingDefault ? (
            <ScrollReveal style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>Start here</Text>
                <Text style={styles.sectionNote}>5 min read</Text>
              </View>
              <ArticleCard
                article={featuredArticle}
                featured
                bookmarked={state.bookmarks.includes(featuredArticle.id)}
                onPress={() => openArticle(featuredArticle)}
                onBookmark={() => toggleBookmark(featuredArticle.id)}
              />
            </ScrollReveal>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>
                {searchQuery.trim() ? 'Search results' : selectedCategory === 'All' ? 'Explore more' : selectedCategory}
              </Text>
              <Text style={styles.sectionNote}>{listArticles.length} {listArticles.length === 1 ? 'article' : 'articles'}</Text>
            </View>
            {listArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                bookmarked={state.bookmarks.includes(article.id)}
                onPress={() => openArticle(article)}
                onBookmark={() => toggleBookmark(article.id)}
              />
            ))}
            {listArticles.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name='book-outline' size={24} color={COLORS.brand} />
                </View>
                <Text style={styles.emptyTitle}>No close match yet</Text>
                <Text style={styles.emptyText}>Try another phrase or choose a different topic.</Text>
              </View>
            ) : null}
          </View>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { paddingBottom: 40 },
  inner: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: 24,
  },
  searchBox: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 15,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.ink,
    outlineStyle: 'none',
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pressed: { opacity: 0.65 },
  categories: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 6,
    paddingRight: 20,
  },
  categoryChip: {
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  categoryChipSelected: {
    borderColor: COLORS.ink,
    backgroundColor: COLORS.ink,
  },
  categoryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: COLORS.body,
  },
  categoryTextSelected: { color: COLORS.white },
  section: { marginTop: 28 },
  sectionHeadingRow: {
    minHeight: 28,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
  },
  sectionNote: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.hairline,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: COLORS.ink,
  },
  emptyText: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
