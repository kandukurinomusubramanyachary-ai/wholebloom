import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../utils/constants';
import { Entrance } from './Motion';

export default function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  color = COLORS.sage,
  label,
  sublabel,
  animated = true,
  motionDelay = 0,
}) {
  const safeProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  return (
    <Entrance
      disabled={!animated}
      delay={motionDelay}
      distance={0}
      scaleFrom={0.97}
      initialOpacity={0.94}
      style={styles.container}
      accessibilityRole='progressbar'
      accessibilityLabel={`${label || 'Progress'} ${Math.round(safeProgress)} percent`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(safeProgress) }}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle stroke={COLORS.hairline} fill='none' cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
          <Circle
            stroke={color} fill='none' cx={size / 2} cy={size / 2} r={radius}
            strokeWidth={strokeWidth} strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset} strokeLinecap='round'
            rotation='-90' origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.textContainer}>
          <Text style={styles.progressText}>{Math.round(safeProgress)}%</Text>
        </View>
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
      {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
    </Entrance>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  label: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.ink,
  },
  sublabel: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.muted,
    marginTop: 2,
  },
});
