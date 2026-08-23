import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../utils/constants';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityLabel,
  accessibilityHint,
  onPressIn,
  onPressOut,
  loadingLabel = 'Saving…',
  ...pressableProps
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...pressableProps}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={(state) => {
        const { pressed, hovered, focused } = state;
        return [
          styles.button,
          styles[variant] || styles.primary,
          hovered && !isDisabled && styles[`${variant}Hover`],
          focused && !isDisabled && styles.focused,
          pressed && !isDisabled && styles[`${variant}Pressed`],
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
          isDisabled && styles.disabledWeb,
          typeof style === 'function' ? style(state) : style,
        ];
      }}
    >
      <View style={styles.content}>
        {icon ? (
          <Ionicons
            name={icon}
            size={19}
            color={
              isDisabled
                ? COLORS.muted
                : variant === 'primary'
                  ? COLORS.white
                  : variant === 'danger'
                    ? COLORS.error
                    : COLORS.ink
            }
          />
        ) : null}
        <Text
          style={[
            styles.text,
            variant === 'primary' && styles.primaryText,
            variant === 'danger' && styles.dangerText,
            variant !== 'primary' && variant !== 'danger' && styles.secondaryText,
            isDisabled && styles.disabledText,
          ]}
        >
          {loading ? loadingLabel : title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = createThemedStyles({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: COLORS.brand,
  },
  primaryHover: {
    backgroundColor: COLORS.brandHover,
  },
  primaryPressed: {
    backgroundColor: COLORS.brandActive,
  },
  secondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  secondaryHover: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.borderStrong,
  },
  secondaryPressed: {
    backgroundColor: COLORS.surfaceStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostHover: {
    backgroundColor: COLORS.surfaceSoft,
  },
  ghostPressed: {
    backgroundColor: COLORS.surfaceStrong,
  },
  danger: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E8C8C4',
  },
  dangerHover: {
    backgroundColor: '#FDF4F2',
    borderColor: '#DDAEA7',
  },
  dangerPressed: {
    backgroundColor: '#FBEAE7',
  },
  focused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  disabled: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.hairline,
  },
  disabledWeb: Platform.select({
    web: { cursor: 'not-allowed' },
    default: {},
  }),
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
  text: {
    ...TYPOGRAPHY.button,
  },
  primaryText: {
    color: COLORS.white,
  },
  secondaryText: {
    color: COLORS.ink,
  },
  dangerText: {
    color: COLORS.error,
  },
  disabledText: {
    color: COLORS.muted,
  },
});
