import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, createThemedStyles } from '../../../utils/constants';

export default function FramingGuide({ instruction, good = false }) {
  return (
    <View style={[styles.guide, good && styles.good]} accessibilityLiveRegion='polite'>
      <Ionicons name={good ? 'checkmark-circle' : 'scan-outline'} size={21} color={good ? COLORS.sage : COLORS.brand} />
      <Text style={styles.text}>{instruction}</Text>
    </View>
  );
}

const styles = createThemedStyles({
  guide: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.brandSoft },
  good: { backgroundColor: COLORS.sageLight },
  text: { flex: 1, color: COLORS.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
