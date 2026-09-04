import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS } from '../../../utils/constants';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A smooth circular progress ring. `progress` is 0..1. Animates toward each new
// value so rep tempo and countdowns read as continuous motion, not steps.
export default function ProgressRing({
  progress = 0,
  size = 240,
  strokeWidth = 14,
  color = COLORS.brand,
  trackColor = COLORS.hairline,
  children,
  animated = true,
  pulseKey = null,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const anim = useRef(new Animated.Value(progress)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) {
      anim.setValue(progress);
      return undefined;
    }
    const animation = Animated.timing(anim, {
      toValue: progress,
      duration: 140,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, animated, anim]);

  // A gentle scale pop whenever pulseKey changes (e.g. a completed rep).
  useEffect(() => {
    if (pulseKey === null) return undefined;
    pulse.setValue(0.94);
    const animation = Animated.spring(pulse, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [pulseKey, pulse]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: pulse }] }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference}, ${circumference}`}
            strokeDashoffset={strokeDashoffset}
          />
        </G>
      </Svg>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
