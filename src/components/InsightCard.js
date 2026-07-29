import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';
import Card from './Card';
import { ScrollReveal } from './Motion';

function confidenceLabel(insight) {
  if (insight.confidenceLabel) return insight.confidenceLabel;
  if (typeof insight.confidence === 'number') return `${insight.confidence}% confidence`;
  return insight.confidence || 'Early observation';
}

function insightIcon(insight) {
  if (insight.id === 'sleep-mood' || insight.category === 'sleep') return 'moon-outline';
  if (insight.category === 'food') return 'restaurant-outline';
  if (insight.category === 'movement') return 'walk-outline';
  if (insight.category === 'cycle') return 'calendar-outline';
  return 'analytics-outline';
}

export default function InsightCard({ insight, index = 0, animated = true }) {
  const content = (
    <Card
      style={styles.card}
      accessible
      accessibilityLabel={`${insight.title}. ${insight.observation}. ${confidenceLabel(insight)}`}
    >
      <View style={styles.header} importantForAccessibility='no-hide-descendants'>
        <View style={styles.icon}>
          <Ionicons name={insightIcon(insight)} size={20} color={COLORS.brand} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{insight.title}</Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidence}>{confidenceLabel(insight)}</Text>
        </View>
      </View>
      <Text style={styles.observation}>{insight.observation}</Text>
    </Card>
  );

  if (!animated) return content;
  return (
    <ScrollReveal delay={Math.min(index, 4) * 45} distance={8} initialOpacity={0.94}>
      {content}
    </ScrollReveal>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: COLORS.brandSoft,
  },
  titleContainer: { flex: 1 },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: COLORS.ink,
  },
  confidenceBadge: {
    maxWidth: 132,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
  },
  confidence: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: COLORS.body,
    textAlign: 'center',
  },
  observation: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.body,
  },
});
