import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { MOTION } from '../utils/constants';

const MotionScrollContext = createContext(null);
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

function webPrefersReducedMotion() {
  if (Platform.OS !== 'web' || typeof globalThis.matchMedia !== 'function') return null;
  return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOut() {
  return Easing.bezier(...MOTION.easing.out);
}

function clampOpacity(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0.75, number));
}

export function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(() => {
    const webPreference = webPrefersReducedMotion();
    // Native starts still until the OS preference is known.
    return webPreference === null ? Platform.OS !== 'web' : webPreference;
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof globalThis.matchMedia === 'function') {
      const query = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = (event) => setReduceMotion(event.matches);
      setReduceMotion(query.matches);
      if (query.addEventListener) query.addEventListener('change', handleChange);
      else query.addListener?.(handleChange);
      return () => {
        if (query.removeEventListener) query.removeEventListener('change', handleChange);
        else query.removeListener?.(handleChange);
      };
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(true);
      });
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}

function entranceTransform(progress, from, distance, scaleFrom) {
  const transforms = [];
  const offset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  if (from === 'top') transforms.push({ translateY: Animated.multiply(offset, -1) });
  if (from === 'bottom') transforms.push({ translateY: offset });
  if (from === 'left') transforms.push({ translateX: Animated.multiply(offset, -1) });
  if (from === 'right') transforms.push({ translateX: offset });
  if (scaleFrom !== 1) {
    transforms.push({
      scale: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [Math.max(0.9, scaleFrom), 1],
      }),
    });
  }
  return transforms;
}

/**
 * A small, always-readable entrance. Opacity never starts below 0.75, so
 * content remains available even if an animation is interrupted.
 */
export function Entrance({
  children,
  style,
  delay = 0,
  duration = MOTION.duration.entrance,
  distance = MOTION.distance.entrance,
  from = 'bottom',
  initialOpacity = MOTION.opacity.entrance,
  scaleFrom = 1,
  disabled = false,
  replayKey,
  onAnimationEnd,
  ...viewProps
}) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    progress.stopAnimation();

    if (disabled || reduceMotion) {
      progress.setValue(1);
      return undefined;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: easeOut(),
      useNativeDriver: USE_NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished) onAnimationEnd?.();
    });
    return () => animation.stop();
  }, [
    delay,
    disabled,
    duration,
    onAnimationEnd,
    progress,
    reduceMotion,
    replayKey,
  ]);

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [clampOpacity(initialOpacity, MOTION.opacity.entrance), 1],
  });
  const transform = entranceTransform(progress, from, distance, scaleFrom);

  return (
    <Animated.View
      {...viewProps}
      style={[
        style,
        {
          opacity,
          transform: transform.length ? transform : undefined,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Provides a native-driven vertical scroll value to ScrollReveal and Parallax.
 * Pass `scrollY` when another animation needs to share the same Animated.Value.
 */
export const MotionScrollView = forwardRef(function MotionScrollView(
  {
    children,
    onScroll,
    scrollY: suppliedScrollY,
    scrollEventThrottle = 16,
    horizontal = false,
    ...scrollProps
  },
  ref
) {
  const internalScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = suppliedScrollY || internalScrollY;
  const scrollOffsetRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const { height: viewportHeight } = useWindowDimensions();

  const handleScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: horizontal ? { x: scrollY } : { y: scrollY } } }],
        {
          useNativeDriver: USE_NATIVE_DRIVER,
          listener: (event) => {
            const offset = horizontal
              ? event.nativeEvent.contentOffset.x
              : event.nativeEvent.contentOffset.y;
            scrollOffsetRef.current = offset;
            onScroll?.(event);
          },
        }
      ),
    [horizontal, onScroll, scrollY]
  );

  const contextValue = useMemo(
    () => ({ scrollY, scrollOffsetRef, viewportHeight, reduceMotion, horizontal }),
    [horizontal, reduceMotion, scrollY, viewportHeight]
  );

  return (
    <MotionScrollContext.Provider value={contextValue}>
      <Animated.ScrollView
        {...scrollProps}
        ref={ref}
        horizontal={horizontal}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        {children}
      </Animated.ScrollView>
    </MotionScrollContext.Provider>
  );
});

export function useMotionScroll() {
  return useContext(MotionScrollContext);
}

/**
 * Reveals once as it approaches the viewport. Before revealing, content stays
 * at 90%+ opacity and a small offset instead of being hidden.
 */
export function ScrollReveal({
  children,
  style,
  threshold = 72,
  distance = MOTION.distance.reveal,
  duration = MOTION.duration.reveal,
  delay = 0,
  initialOpacity = MOTION.opacity.reveal,
  replayKey,
  onLayout,
  ...viewProps
}) {
  const scrollContext = useMotionScroll();
  const localReduceMotion = useReducedMotion();
  const reduceMotion = scrollContext?.reduceMotion ?? localReduceMotion;
  const progress = useRef(new Animated.Value(1)).current;
  const revealedRef = useRef(false);
  const [layoutPosition, setLayoutPosition] = useState(null);

  useEffect(() => {
    revealedRef.current = false;
  }, [replayKey]);

  useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion || !scrollContext || layoutPosition === null) {
      progress.setValue(1);
      return undefined;
    }

    progress.setValue(0);
    let animation = null;
    const reveal = () => {
      if (revealedRef.current) return;
      revealedRef.current = true;
      animation = Animated.timing(progress, {
        toValue: 1,
        duration,
        delay,
        easing: easeOut(),
        useNativeDriver: USE_NATIVE_DRIVER,
        isInteraction: false,
      });
      animation.start();
    };
    const isNearViewport = (offset) =>
      layoutPosition <= offset + scrollContext.viewportHeight - threshold;

    if (isNearViewport(scrollContext.scrollOffsetRef.current)) {
      reveal();
      return () => animation?.stop();
    }

    const listener = scrollContext.scrollY.addListener(({ value }) => {
      if (isNearViewport(value)) reveal();
    });
    return () => {
      scrollContext.scrollY.removeListener(listener);
      animation?.stop();
      progress.stopAnimation();
    };
  }, [
    delay,
    duration,
    layoutPosition,
    progress,
    reduceMotion,
    replayKey,
    scrollContext,
    threshold,
  ]);

  if (!scrollContext) {
    return (
      <Entrance
        {...viewProps}
        style={style}
        delay={delay}
        duration={duration}
        distance={distance}
        initialOpacity={initialOpacity}
        replayKey={replayKey}
        onLayout={onLayout}
      >
        {children}
      </Entrance>
    );
  }

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [clampOpacity(initialOpacity, MOTION.opacity.reveal), 1],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return (
    <Animated.View
      {...viewProps}
      onLayout={(event) => {
        setLayoutPosition(event.nativeEvent.layout.y);
        onLayout?.(event);
      }}
      style={[style, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A restrained, scroll-linked transform. It becomes a plain View when reduced
 * motion is enabled or when used outside MotionScrollView.
 */
export function Parallax({
  children,
  style,
  amount = MOTION.distance.parallax,
  onLayout,
  ...viewProps
}) {
  const scrollContext = useMotionScroll();
  const localReduceMotion = useReducedMotion();
  const reduceMotion = scrollContext?.reduceMotion ?? localReduceMotion;
  const [layoutPosition, setLayoutPosition] = useState(null);

  if (
    reduceMotion ||
    !scrollContext ||
    scrollContext.horizontal ||
    layoutPosition === null
  ) {
    return (
      <Animated.View
        {...viewProps}
        onLayout={(event) => {
          setLayoutPosition(event.nativeEvent.layout.y);
          onLayout?.(event);
        }}
        style={style}
      >
        {children}
      </Animated.View>
    );
  }

  const viewport = Math.max(1, scrollContext.viewportHeight);
  const translateY = scrollContext.scrollY.interpolate({
    inputRange: [layoutPosition - viewport, layoutPosition, layoutPosition + viewport],
    outputRange: [-amount, 0, amount],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...viewProps}
      onLayout={(event) => {
        setLayoutPosition(event.nativeEvent.layout.y);
        onLayout?.(event);
      }}
      style={[style, { transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
