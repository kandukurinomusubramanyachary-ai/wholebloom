import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, createThemedStyles } from '../utils/constants';
import { useReducedMotion } from '../components/Motion';
import { LotusMark } from '../components/BrandMark';
import TodayScreen from '../screens/TodayScreen';
import TimelineScreen from '../screens/TimelineScreen';
import MegScreen from '../screens/MegScreen';
import DietScreen from '../screens/DietScreen';
import StrengthScreen from '../features/strength/StrengthScreen';
import { isStrengthEnabled } from '../features/strength/featureFlag';

const Tab = createBottomTabNavigator();

const tabs = [
  { name: 'Today', component: TodayScreen, icon: 'bloom' },
  { name: 'Timeline', component: TimelineScreen, icon: 'calendar' },
  { name: 'Meg', component: MegScreen, icon: 'chatbubbles' },
  ...(isStrengthEnabled() ? [{ name: 'Strength', component: StrengthScreen, icon: 'fitness' }] : []),
  { name: 'Diet', component: DietScreen, icon: 'nutrition' },
];

function TabIcon({ icon, label, focused, reduceMotion }) {
  const focusProgress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: reduceMotion ? 0 : 170,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [focused, focusProgress, reduceMotion]);

  const scale = focusProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Animated.View style={[styles.tabItem, !reduceMotion && { transform: [{ scale }] }]}>
      <View style={styles.iconWrap}>
        {icon === 'bloom' ? (
          <LotusMark
            size={23}
            style={{ opacity: focused ? 1 : 0.52 }}
          />
        ) : (
          <Ionicons
            name={focused ? icon : `${icon}-outline`}
            size={22}
            color={focused ? COLORS.ink : COLORS.muted}
          />
        )}
        <View style={[styles.activeDot, !focused && styles.activeDotHidden]} />
      </View>
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.35}
        minimumFontScale={0.72}
        numberOfLines={1}
        style={[styles.tabLabel, focused && styles.tabLabelFocused]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

function BloomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [dockWidth, setDockWidth] = useState(0);
  const activeIndex = useRef(new Animated.Value(state.index)).current;
  const segmentWidth = dockWidth ? dockWidth / state.routes.length : 0;
  const focusedOptions = descriptors[state.routes[state.index]?.key]?.options || {};

  useEffect(() => {
    Animated.timing(activeIndex, {
      toValue: state.index,
      duration: reduceMotion ? 0 : 190,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeIndex, reduceMotion, state.index]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) return null;
  if (focusedOptions.tabBarStyle?.display === 'none') return null;

  return (
    <View style={[styles.tabBarFrame, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      <View style={styles.tabBar} onLayout={(event) => setDockWidth(event.nativeEvent.layout.width)}>
        {segmentWidth ? (
          <Animated.View
            style={[
              styles.activeSurface,
              styles.nonInteractive,
              {
                width: Math.max(0, segmentWidth - 4),
                transform: [{ translateX: Animated.multiply(activeIndex, segmentWidth) }],
              },
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const options = descriptors[route.key].options;
          const focused = state.index === index;
          const tab = tabs.find((item) => item.name === route.name);
          const label = options.tabBarLabel || options.title || route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole='tab'
              accessibilityLabel={options.tabBarAccessibilityLabel || String(label)}
              accessibilityState={{ selected: focused }}
              style={({ pressed, hovered, focused: keyboardFocused }) => [
                styles.tabButton,
                hovered && !focused && styles.tabButtonHovered,
                keyboardFocused && styles.tabButtonFocused,
                pressed && !reduceMotion && styles.tabButtonPressed,
              ]}
            >
              <TabIcon icon={tab?.icon || 'ellipse'} label={String(label)} focused={focused} reduceMotion={reduceMotion} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BloomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneContainerStyle: styles.scene,
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarAccessibilityLabel: tab.name }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = createThemedStyles({
  scene: { backgroundColor: COLORS.canvas },
  tabBarFrame: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.canvas,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  tabBar: {
    position: 'relative',
    width: '100%',
    maxWidth: 720,
    height: 58,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 2,
    borderRadius: 0,
    backgroundColor: COLORS.canvas,
    overflow: 'hidden',
  },
  activeSurface: {
    position: 'absolute',
    top: 2,
    left: 2,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.brandSoft,
  },
  nonInteractive: { pointerEvents: 'none' },
  tabButton: {
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionProperty: 'background-color, opacity, transform',
        transitionDuration: '150ms',
        transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        outlineStyle: 'none',
      },
    }),
  },
  tabButtonHovered: { backgroundColor: COLORS.surfaceSoft },
  tabButtonFocused: {
    ...Platform.select({
      web: {
        outlineStyle: 'solid',
        outlineWidth: 2,
        outlineColor: COLORS.brand,
        outlineOffset: -3,
      },
    }),
  },
  tabButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  tabItem: { width: '100%', minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { height: 27, alignItems: 'center', justifyContent: 'center' },
  activeDot: {
    position: 'absolute',
    bottom: -1,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.brand,
    opacity: 1,
  },
  activeDotHidden: { opacity: 0 },
  tabLabel: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 13,
    maxWidth: '100%',
    textAlign: 'center',
    color: COLORS.muted,
    fontWeight: '500',
  },
  tabLabelFocused: { color: COLORS.ink, fontWeight: '600' },
});
