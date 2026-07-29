import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';
import { Entrance } from './Motion';

export default function ScreenHeader({
  title,
  subtitle,
  action,
  style,
  animated = true,
  motionDelay = 0,
}) {
  return (
    <Entrance
      disabled={!animated}
      delay={motionDelay}
      distance={6}
      initialOpacity={0.94}
      style={[styles.header, style]}
    >
      <View style={styles.copy}>
        <Text accessibilityRole='header' style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </Entrance>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
  },
});
