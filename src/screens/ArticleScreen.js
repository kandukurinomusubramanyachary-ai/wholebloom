import React from 'react';
import { Platform, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, createThemedStyles, LAYOUT } from '../utils/constants';
import { ARTICLES } from '../data/content';
import { MotionScrollView, ScrollReveal } from '../components/Motion';

function ArticleBody({ content }) {
  const blocks = String(content || '').split(/\n\s*\n/).filter(Boolean);

  return (
    <View style={styles.body}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        if (blockIndex === 0) {
          return <Text key={`lede-${blockIndex}`} style={styles.lede}>{lines.join(' ')}</Text>;
        }
        if (lines.length === 1) {
          return <Text key={`paragraph-${blockIndex}`} style={styles.paragraph}>{lines[0]}</Text>;
        }
        const [heading, ...details] = lines;
        return (
          <View key={`${heading}-${blockIndex}`} style={styles.bodySection}>
            <Text style={styles.bodyHeading}>{heading.replace(/:$/, '')}</Text>
            {details.map((line, lineIndex) => line.startsWith('- ') ? (
              <View key={`${blockIndex}-${lineIndex}`} style={styles.listRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>{line.slice(2)}</Text>
              </View>
            ) : (
              <Text key={`${blockIndex}-${lineIndex}`} style={styles.paragraph}>{line}</Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default function ArticleScreen({ route, navigation }) {
  const articleId = route?.params?.articleId;
  const { state, toggleBookmark } = useApp();
  const article = ARTICLES.find(a => a.id === articleId);

  if (!article) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.notFoundInner}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole='button'
            accessibilityLabel='Go back'
            style={({ pressed, hovered, focused }) => [styles.backButton, hovered && styles.headerControlHovered, focused && styles.headerControlFocused, pressed && styles.pressed]}
          >
            <Ionicons name='chevron-back' size={22} color={COLORS.ink} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>

          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name='document-text-outline' size={28} color={COLORS.brand} />
            </View>
            <Text style={styles.emptyTitle}>Article unavailable</Text>
            <Text style={styles.emptyBody}>
              This article may have moved. Return to Learn to keep browsing.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isBookmarked = (Array.isArray(state.bookmarks) ? state.bookmarks : []).includes(article.id);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <MotionScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole='button'
              accessibilityLabel='Go back'
              style={({ pressed, hovered, focused }) => [styles.backButton, hovered && styles.headerControlHovered, focused && styles.headerControlFocused, pressed && styles.pressed]}
            >
              <Ionicons name='chevron-back' size={22} color={COLORS.ink} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>

            <Pressable
              onPress={() => toggleBookmark(article.id)}
              accessibilityRole='button'
              accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark article'}
              accessibilityState={{ selected: isBookmarked }}
              style={({ pressed, hovered, focused }) => [
                styles.bookmarkButton,
                isBookmarked && styles.bookmarkButtonActive,
                hovered && styles.bookmarkButtonHovered,
                focused && styles.bookmarkButtonFocused,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={21}
                color={isBookmarked ? COLORS.brand : COLORS.ink}
              />
            </Pressable>
          </View>

          <View style={styles.article}>
            <Text style={styles.category}>{article.category}</Text>
            <Text style={styles.title}>{article.title}</Text>

            <View style={styles.meta}>
              <Text style={styles.author}>{article.author}</Text>
              <View style={styles.metaDot} />
              <View style={styles.readTimeRow}>
                <Ionicons name='time-outline' size={16} color={COLORS.muted} />
                <Text style={styles.readTime}>{article.readTime} min read</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <ArticleBody content={article.content} />

            <ScrollReveal style={styles.disclaimer}>
              <Ionicons name='information-circle-outline' size={21} color={COLORS.sage} />
              <Text style={styles.disclaimerText}>
                Bloom does not diagnose conditions. Speak with a healthcare provider before
                making medical decisions.
              </Text>
            </ScrollReveal>
          </View>
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
    ...Platform.select({
      web: {
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      },
      default: {},
    }),
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      },
      default: {},
    }),
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  inner: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButton: {
    minHeight: LAYOUT.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 12,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  bookmarkButton: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: LAYOUT.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  bookmarkButtonActive: {
    backgroundColor: COLORS.brandSoft,
  },
  bookmarkButtonHovered: { backgroundColor: COLORS.surfaceWarm },
  bookmarkButtonFocused: { backgroundColor: COLORS.brandSoft, borderWidth: 1, borderColor: COLORS.brand },
  headerControlHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  headerControlFocused: { backgroundColor: COLORS.brandSoft, borderRadius: 10 },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.98 }],
  },
  article: {
    paddingTop: 24,
    paddingBottom: 12,
  },
  category: {
    alignSelf: 'flex-start',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.brand,
    marginBottom: 12,
  },
  title: {
    maxWidth: 670,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: COLORS.ink,
    marginBottom: 16,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
  },
  author: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.body,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.muted,
  },
  readTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  readTime: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.hairline,
    marginVertical: 28,
  },
  body: {
    maxWidth: 660,
  },
  lede: {
    marginBottom: 28,
    fontSize: 18,
    lineHeight: 29,
    color: COLORS.ink,
  },
  bodySection: {
    marginBottom: 26,
  },
  bodyHeading: {
    marginBottom: 9,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
  },
  paragraph: {
    marginBottom: 10,
    fontSize: 16,
    lineHeight: 27,
    color: COLORS.body,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 10,
    fontSize: 15,
    lineHeight: 26,
    color: COLORS.brand,
  },
  listText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.body,
  },
  disclaimer: {
    marginTop: 32,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: LAYOUT.controlRadius,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.sageLight,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.body,
  },
  notFoundInner: {
    flex: 1,
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 64,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: COLORS.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    maxWidth: 360,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
    textAlign: 'center',
  },
});
