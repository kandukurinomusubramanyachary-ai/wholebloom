import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const LOTUS_SOURCE = require('../../assets/lotus-mark.png');
const LOCKUP_SOURCE = require('../../assets/bloom-lockup.png');
const LOTUS_ASPECT = 406 / 324;
const LOCKUP_ASPECT = 846 / 478;

const SIZE_PRESETS = {
  small: { icon: 25, lockup: 58 },
  medium: { icon: 34, lockup: 92 },
  large: { icon: 76, lockup: 170 },
  splash: { icon: 132, lockup: 250 },
};

/**
 * Exact lotus crop derived by scripts/generate-logo-assets.js from the
 * hash-pinned, user-supplied Bloom lockup. The color/inverse properties remain
 * accepted for API compatibility; approved artwork colors are intentionally
 * never tinted at runtime.
 */
export function LotusMark({
  size = 32,
  decorative = true,
  accessibilityLabel = 'Bloom lotus',
  style,
}) {
  return (
    <Image
      source={LOTUS_SOURCE}
      resizeMode='contain'
      style={[{ width: size, height: size / LOTUS_ASPECT }, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    />
  );
}

export default function BrandMark({
  size = 'medium',
  showWordmark = true,
  style,
  accessibilityLabel = 'Bloom',
  decorative = false,
}) {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.medium;

  return (
    <View
      style={[styles.container, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    >
      {showWordmark ? (
        <Image
          source={LOCKUP_SOURCE}
          resizeMode='contain'
          style={{ width: preset.lockup, height: preset.lockup / LOCKUP_ASPECT }}
          accessible={false}
        />
      ) : (
        <LotusMark size={preset.icon} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
