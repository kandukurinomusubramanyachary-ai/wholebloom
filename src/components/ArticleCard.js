import React, { useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, createThemedStyles, ELEVATION, WEB_FOCUS } from '../utils/constants';

const elevationStyle = Platform.select({
  web: ELEVATION.web,
  ios: ELEVATION.ios,
  android: ELEVATION.android,
  default: {},
});

export default function ArticleCard({
  article,
  bookmarked,
  onPress,
  onBookmark,
  featured = false,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <View style={[styles.card, featured && styles.featuredCard, hovered && elevationStyle]}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole='button'
        accessibilityLabel={`Read ${article.title}`}
        style={({ pressed, focused }) => [
          styles.articleButton,
          styles.webInteractive,
          focused && styles.focused,
          pressed && styles.articlePressed,
        ]}
      >
        <View style={styles.metaRow}>
          <View style={[styles.categoryChip, featured && styles.featuredChip]}>
            <Text style={styles.category}>{article.category}</Text>
          </View>
          <Text style={styles.readTime}>{article.readTime} min</Text>
        </View>
        <Text style={[styles.title, featured && styles.featuredTitle]}>{article.title}</Text>
        <Text style={styles.author}>{article.author}</Text>
        <View style={styles.readRow}>
          <Text style={styles.readLabel}>Read article</Text>
          <Ionicons name='arrow-forward' size={17} color={COLORS.brand} />
        </View>
      </Pressable>

      {onBookmark ? (
        <Pressable
          onPress={onBookmark}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={bookmarked ? `Remove ${article.title} from saved articles` : `Save ${article.title}`}
          accessibilityState={{ selected: bookmarked }}
          style={({ pressed, hovered: bookmarkHovered, focused }) => [
            styles.bookmarkButton,
            styles.webInteractive,
            bookmarkHovered && styles.bookmarkHovered,
            focused && styles.focused,
            pressed && styles.bookmarkPressed,
          ]}
        >
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={COLORS.brand}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = createThemedStyles({
  card: {
    position: 'relative',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  featuredCard: {
    backgroundColor: COLORS.surfaceWarm,
    borderColor: COLORS.surfaceWarm,
  },
  articleButton: {
    padding: 20,
  },
  webInteractive: Platform.select({
    web: { cursor: 'pointer' },
    default: {},
  }),
  focused: Platform.select({
    web: { ...WEB_FOCUS, outlineOffset: -2 },
    default: {},
  }),
  articlePressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  metaRow: {
    minHeight: 34,
    paddingRight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
  },
  featuredChip: {
    backgroundColor: COLORS.white,
  },
  category: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.brand,
  },
  readTime: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
  },
  title: {
    marginTop: 13,
    maxWidth: 540,
    paddingRight: 16,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  featuredTitle: {
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.35,
  },
  author: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  readRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.brand,
  },
  bookmarkButton: {
    position: 'absolute',
    top: 14,
    right: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  bookmarkHovered: {
    backgroundColor: COLORS.surfaceStrong,
  },
  bookmarkPressed: {
    backgroundColor: COLORS.brandSoft,
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
});
