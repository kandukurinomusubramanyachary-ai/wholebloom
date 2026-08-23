import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { COLORS, createThemedStyles, ELEVATION, WEB_FOCUS } from '../utils/constants';

const elevationStyle = Platform.select({
  web: ELEVATION.web,
  ios: ELEVATION.ios,
  android: ELEVATION.android,
  default: {},
});

function variantStyle(variant) {
  if (variant === 'cream') return styles.cream;
  if (variant === 'terracotta') return styles.terracotta;
  if (variant === 'brandSoft') return styles.brandSoft;
  if (variant === 'sage') return styles.sage;
  if (variant === 'flat') return styles.flat;
  return null;
}

export default function Card({
  children,
  style,
  variant = 'default',
  elevated = false,
  hoverable = true,
  onPress,
  accessibilityRole,
  ...viewProps
}) {
  const base = [
    styles.card,
    variantStyle(variant),
    elevated && styles.elevatedSurface,
    elevated && elevationStyle,
  ];

  if (!onPress) {
    return (
      <View {...viewProps} accessibilityRole={accessibilityRole} style={[...base, style]}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      {...viewProps}
      onPress={onPress}
      accessibilityRole={accessibilityRole || 'button'}
      style={(state) => [
        ...base,
        hoverable && state.hovered && styles.elevatedSurface,
        hoverable && state.hovered && elevationStyle,
        state.focused && styles.focused,
        state.pressed && styles.pressed,
        styles.interactive,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = createThemedStyles({
  card: {
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  cream: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.surfaceSoft,
  },
  terracotta: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  brandSoft: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.brandSoft,
  },
  sage: {
    backgroundColor: COLORS.sageLight,
    borderColor: COLORS.sageLight,
  },
  flat: {
    borderWidth: 0,
  },
  elevatedSurface: {
    borderWidth: 0,
  },
  interactive: Platform.select({
    web: { cursor: 'pointer' },
    default: {},
  }),
  focused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  pressed: {
    opacity: 0.97,
    transform: [{ scale: 0.98 }],
  },
});
