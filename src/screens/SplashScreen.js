import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandMark from '../components/BrandMark';
import { useReducedMotion } from '../components/Motion';
import { COLORS, createThemedStyles } from '../utils/constants';
import { setStartupStage } from '../diagnostics/startupDiagnostics';

const SPLASH_DURATION = 2200;
const REDUCED_MOTION_DURATION = 450;
const SPLASH_TIMEOUT = 4000;

export default function SplashScreen({ ready, onFinish }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const logoProgress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const loaderProgress = useRef(new Animated.Value(0)).current;
  const [animationComplete, setAnimationComplete] = useState(false);
  const finishCalled = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  function finishSplash() {
    if (finishCalled.current) return;
    finishCalled.current = true;
    setStartupStage('splash-hidden');
    onFinishRef.current?.();
  }

  useEffect(() => {
    setStartupStage('splash-visible');
    const logoAnimation = Animated.timing(logoProgress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 1400,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
      isInteraction: false,
    });
    const loaderAnimation = Animated.timing(loaderProgress, {
      toValue: 1,
      duration: reduceMotion ? REDUCED_MOTION_DURATION : SPLASH_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
      isInteraction: false,
    });

    Animated.parallel([logoAnimation, loaderAnimation]).start(({ finished }) => {
      if (finished) setAnimationComplete(true);
    });

    return () => {
      logoAnimation.stop();
      loaderAnimation.stop();
    };
  }, [loaderProgress, logoProgress, reduceMotion]);

  useEffect(() => {
    const timeout = setTimeout(finishSplash, SPLASH_TIMEOUT);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (ready && animationComplete) finishSplash();
  }, [animationComplete, ready]);

  const opacity = logoProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = logoProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });
  const loaderTranslateX = loaderProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-110, 0],
  });

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(insets.top, 24) + 48,
          paddingBottom: Math.max(insets.bottom, 24) + 48,
        },
      ]}
      accessibilityLabel='Bloom is opening'
      accessibilityLiveRegion='polite'
    >
      <View style={styles.logoContent}>
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
          <BrandMark size='splash' layout='stacked' />
        </Animated.View>
      </View>

      <View
        style={styles.loaderTrack}
        accessibilityRole='progressbar'
        accessibilityValue={{
          min: 0,
          max: 100,
          now: animationComplete ? 100 : undefined,
          text: animationComplete ? 'Ready' : 'Opening Bloom',
        }}
      >
        <Animated.View
          style={[
            styles.loaderBar,
            { transform: [{ translateX: loaderTranslateX }] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: COLORS.splash,
  },
  logoContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderTrack: {
    width: 110,
    height: 2,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: COLORS.logoSoft,
  },
  loaderBar: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.logo,
  },
});
