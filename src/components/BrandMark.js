import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { COLORS } from '../utils/constants';

const SIZE_PRESETS = {
  small: { icon: 25, word: 68 },
  medium: { icon: 34, word: 88 },
  large: { icon: 76, word: 146 },
  splash: { icon: 132, word: 250 },
};

export function LotusMark({
  size = 32,
  color = COLORS.logo,
  inverse = false,
  decorative = true,
  accessibilityLabel = 'Bloom lotus',
  style,
}) {
  const resolvedColor = inverse ? COLORS.white : color;

  return (
    <Svg
      width={size}
      height={size * (112 / 132)}
      viewBox='0 0 132 112'
      fill='none'
      style={style}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    >
      <G
        stroke={resolvedColor}
        strokeWidth='3.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <Path d='M66 74C44 89 15 82 4 57C27 42 50 52 66 74Z' />
        <Path d='M66 74C88 89 117 82 128 57C105 42 82 52 66 74Z' />
        <Path d='M66 74C42 71 22 51 25 20C46 20 62 31 66 52C69 31 86 20 107 20C110 51 90 71 66 74Z' />
        <Path d='M66 74C49 55 48 27 66 6C84 27 83 55 66 74Z' />
        <Path d='M25 43C31 61 46 72 66 74' />
        <Path d='M107 43C101 61 86 72 66 74' />
        <Path d='M66 74L52 88L66 102L80 88L66 74ZM66 74V107' />
      </G>
    </Svg>
  );
}

export function BloomWordmark({
  width = 88,
  color = COLORS.logoInk,
  inverse = false,
  decorative = true,
  accessibilityLabel = 'bloom',
  style,
}) {
  const resolvedColor = inverse ? COLORS.white : color;

  return (
    <Svg
      width={width}
      height={width * (48 / 202)}
      viewBox='0 0 202 48'
      fill='none'
      style={style}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    >
      <G
        stroke={resolvedColor}
        strokeWidth='3.6'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <Path d='M5 4V43M5 29C5 20 11 15 19 15C28 15 34 21 34 29C34 38 28 43 19 43C11 43 5 38 5 29Z' />
        <Path d='M50 4V43' />
        <Path d='M83 15C73 15 67 21 67 29C67 38 73 43 83 43C92 43 98 38 98 29C98 21 92 15 83 15Z' />
        <Path d='M128 15C118 15 112 21 112 29C112 38 118 43 128 43C137 43 143 38 143 29C143 21 137 15 128 15Z' />
        <Path d='M157 43V17M157 26C157 19 162 15 169 15C176 15 180 20 180 27V43M180 26C180 19 185 15 192 15C199 15 202 20 202 27V43' />
      </G>
    </Svg>
  );
}

export default function BrandMark({
  size = 'medium',
  color = COLORS.logo,
  inverse = false,
  showWordmark = true,
  layout = 'horizontal',
  style,
  accessibilityLabel = 'Bloom',
  decorative = false,
}) {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.medium;
  const stacked = layout === 'stacked';
  const resolvedColor = inverse ? COLORS.white : color;
  const wordmarkColor = inverse ? COLORS.white : COLORS.logoInk;

  return (
    <View
      style={[styles.container, stacked && styles.stacked, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? 'no' : 'auto'}
    >
      <LotusMark size={preset.icon} color={resolvedColor} inverse={inverse} />
      {showWordmark ? (
        <BloomWordmark
          width={preset.word}
          color={wordmarkColor}
          inverse={inverse}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stacked: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 10,
  },
});
