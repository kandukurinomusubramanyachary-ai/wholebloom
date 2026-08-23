import { StyleSheet } from 'react-native';

export const LIGHT_COLORS = Object.freeze({
  canvas: '#FFFEFF',
  splash: '#FFFDFE',
  surfaceSoft: '#F7F7F5',
  surfaceStrong: '#F1F1EE',
  surfaceWarm: '#FBF3EF',
  logo: '#ED3F5B',
  logoInk: '#1D1D1B',
  logoSoft: 'rgba(237, 63, 91, 0.10)',
  brand: '#B52F50',
  brandHover: '#A62A48',
  brandActive: '#92243F',
  brandSoft: '#FBE5EA',
  cycle: '#C0755A',
  sage: '#60745C',
  sageLight: '#E7ECE4',
  blush: '#F4E6E6',
  ink: '#222222',
  body: '#484848',
  muted: '#6A6A6A',
  hairline: '#E5E5E2',
  hairlineSoft: '#EFEFEC',
  borderStrong: '#B9B9B4',
  ivory: '#FEFCFD',
  terracotta: '#B52F50',
  terracottaLight: '#C0755A',
  charcoal: '#222222',
  charcoalLight: '#484848',
  cream: '#F7F7F5',
  white: '#FFFFFF',
  gray: '#6A6A6A',
  lightGray: '#E5E5E2',
  success: '#60745C',
  warning: '#9A651E',
  error: '#B42318',
});

export const DARK_COLORS = Object.freeze({
  canvas: '#121113',
  splash: '#0F0E10',
  surfaceSoft: '#1B191C',
  surfaceStrong: '#242126',
  surfaceWarm: '#23191C',
  logo: '#FF6B84',
  logoInk: '#F8F4F5',
  logoSoft: 'rgba(255, 107, 132, 0.14)',
  brand: '#EE718B',
  brandHover: '#F17F96',
  brandActive: '#D95D78',
  brandSoft: '#321C23',
  cycle: '#D78A70',
  sage: '#9DB296',
  sageLight: '#1E2920',
  blush: '#342328',
  ink: '#F7F4F5',
  body: '#DED8DB',
  muted: '#B7AFB3',
  hairline: '#343035',
  hairlineSoft: '#29262A',
  borderStrong: '#514A50',
  ivory: '#1A181B',
  terracotta: '#EE718B',
  terracottaLight: '#D78A70',
  charcoal: '#F7F4F5',
  charcoalLight: '#DED8DB',
  cream: '#1B191C',
  white: '#1A181B',
  gray: '#B7AFB3',
  lightGray: '#343035',
  success: '#9DB296',
  warning: '#F0B45C',
  error: '#FF8B81',
});

const THEME_NAMES = new Set(['light', 'dark']);
let activeTheme = 'light';

export function cleanThemePreference(value) {
  return THEME_NAMES.has(value) ? value : 'light';
}

export function setActiveTheme(value) {
  activeTheme = cleanThemePreference(value);
}

export function getActiveTheme() {
  return activeTheme;
}

export const COLORS = new Proxy({}, {
  get(_target, property) {
    const palette = activeTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    return palette[property];
  },
  ownKeys() {
    return Reflect.ownKeys(LIGHT_COLORS);
  },
  getOwnPropertyDescriptor(_target, property) {
    if (!Object.hasOwn(LIGHT_COLORS, property)) return undefined;
    return { enumerable: true, configurable: true };
  },
});

const HARD_CODED_DARK_EQUIVALENTS = Object.freeze({
  '#D2D2CE': '#464147',
  '#D6E0D2': '#344036',
  '#D7B1A5': '#6B454E',
  '#D8B2A6': '#6B454E',
  '#DCA9A2': '#71444A',
  '#DDAEA7': '#70464B',
  '#E8C8C4': '#623C42',
  '#EEEAE7': '#29262A',
  '#FBEAE7': '#321C20',
  '#FCEBE8': '#321C20',
  '#FCEDEB': '#2D1B1F',
  '#FDF1EF': '#2D1B1F',
  '#FDF4F2': '#2A1A1D',
  '#FFF2F0': '#2D1B1F',
  '#FFF7F6': '#2A1A1D',
  'rgba(247,247,245,0.68)': 'rgba(255,255,255,0.06)',
  'rgba(255,255,255,0.42)': 'rgba(255,255,255,0.07)',
  'rgba(255,255,255,0.68)': 'rgba(255,255,255,0.10)',
});

const DARK_COLOR_BY_LIGHT = Object.freeze({
  ...Object.fromEntries(
    Object.keys(LIGHT_COLORS).map((key) => [LIGHT_COLORS[key], DARK_COLORS[key]])
  ),
  ...HARD_CODED_DARK_EQUIVALENTS,
});

const LIGHT_COLOR_BY_DARK = Object.freeze(Object.fromEntries(
  Object.entries(DARK_COLOR_BY_LIGHT).map(([light, dark]) => [dark, light])
));

function themedValue(value, equivalents, property) {
  if (Array.isArray(value)) {
    return value.map((item) => themedValue(item, equivalents));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        themedValue(item, equivalents, key),
      ])
    );
  }
  if (property === 'shadowColor') return '#000000';
  return typeof value === 'string' && equivalents[value]
    ? equivalents[value]
    : value;
}

export function createThemedStyles(definitions) {
  const lightStyles = StyleSheet.create(themedValue(definitions, LIGHT_COLOR_BY_DARK));
  const darkStyles = StyleSheet.create(themedValue(definitions, DARK_COLOR_BY_LIGHT));
  return new Proxy({}, {
    get(_target, property) {
      return (activeTheme === 'dark' ? darkStyles : lightStyles)[property];
    },
    has(_target, property) {
      return property in (activeTheme === 'dark' ? darkStyles : lightStyles);
    },
    ownKeys() {
      return Reflect.ownKeys(activeTheme === 'dark' ? darkStyles : lightStyles);
    },
    getOwnPropertyDescriptor(_target, property) {
      const styles = activeTheme === 'dark' ? darkStyles : lightStyles;
      if (!Object.hasOwn(styles, property)) return undefined;
      return { enumerable: true, configurable: true, value: styles[property] };
    },
  });
}

export const FONTS = {
  display: undefined,
  body: undefined,
};

export const TYPOGRAPHY = {
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  componentTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  supporting: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
};

export const SIZES = {
  xs: 4,
  sm: 8,
  compact: 12,
  md: 16,
  gutter: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const LAYOUT = {
  screenPadding: 20,
  maxContentWidth: 720,
  cardRadius: 16,
  controlRadius: 12,
  touchTarget: 48,
};

export const MOTION = {
  duration: {
    press: 120,
    release: 150,
    entrance: 220,
    reveal: 200,
  },
  distance: {
    entrance: 8,
    reveal: 10,
    parallax: 12,
  },
  opacity: {
    entrance: 0.9,
    reveal: 0.9,
  },
  easing: {
    out: [0.23, 1, 0.32, 1],
    inOut: [0.77, 0, 0.175, 1],
  },
};

// Bloom has one elevation tier. Most surfaces remain flat.
export const ELEVATION = {
  web: {
    boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 8px',
  },
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 2,
  },
};

export const WEB_FOCUS = {
  outlineStyle: 'solid',
  outlineWidth: 2,
  outlineColor: COLORS.brand,
  outlineOffset: 2,
};

const LEGACY_MOODS = [
  { id: 'calm', label: 'Calm', icon: 'leaf-outline', emoji: '🌿' },
  { id: 'tender', label: 'Tender', icon: 'flower-outline', emoji: '🌸' },
  { id: 'low', label: 'Low', icon: 'cloud-outline', emoji: '🌧️' },
  { id: 'irritable', label: 'Irritable', icon: 'flash-outline', emoji: '⚡' },
  { id: 'joyful', label: 'Joyful', icon: 'sunny-outline', emoji: '☀️' },
];

export const MOODS = [
  { id: 'calm', label: 'Calm', icon: 'leaf-outline', emoji: '' },
  { id: 'happy', label: 'Happy', icon: 'sunny-outline', emoji: '' },
  { id: 'low', label: 'Low', icon: 'cloud-outline', emoji: '' },
  { id: 'anxious', label: 'Anxious', icon: 'pulse-outline', emoji: '' },
  { id: 'irritated', label: 'Irritated', icon: 'flash-outline', emoji: '' },
  { id: 'overwhelmed', label: 'Overwhelmed', icon: 'rainy-outline', emoji: '' },
  { id: 'emotionally_sensitive', label: 'Emotionally sensitive', icon: 'flower-outline', emoji: '' },
];

export const FLOW_LEVELS = [
  { id: 'none', label: 'None', icon: 'remove-outline', emoji: '—' },
  { id: 'spotting', label: 'Spotting', icon: 'water-outline', emoji: '•' },
  { id: 'light', label: 'Light', icon: 'water-outline', emoji: '••' },
  { id: 'medium', label: 'Medium', icon: 'water', emoji: '•••' },
  { id: 'heavy', label: 'Heavy', icon: 'water', emoji: '••••' },
];

const BASE_SYMPTOMS = [
  { id: 'cramps', label: 'Cramps', icon: 'pulse-outline', emoji: '•' },
  { id: 'bloating', label: 'Bloating', icon: 'ellipse-outline', emoji: '•' },
  { id: 'headache', label: 'Headache', icon: 'medical-outline', emoji: '•' },
  { id: 'acne', label: 'Acne', icon: 'sparkles-outline', emoji: '•' },
  { id: 'fatigue', label: 'Fatigue', icon: 'battery-dead-outline', emoji: '•' },
  { id: 'cravings', label: 'Cravings', icon: 'restaurant-outline', emoji: '•' },
  { id: 'mood_swings', label: 'Mood swings', icon: 'swap-horizontal-outline', emoji: '•' },
  { id: 'insomnia', label: 'Insomnia', icon: 'moon-outline', emoji: '•' },
  { id: 'back_pain', label: 'Back pain', icon: 'body-outline', emoji: '•' },
  { id: 'nausea', label: 'Nausea', icon: 'fitness-outline', emoji: '•' },
  { id: 'breast_tenderness', label: 'Breast tenderness', icon: 'heart-outline', emoji: '•' },
  { id: 'anxiety', label: 'Anxiety', icon: 'cloud-outline', emoji: '•' },
  { id: 'constipation', label: 'Constipation', icon: 'body-outline', emoji: '' },
  { id: 'diarrhea', label: 'Diarrhea', icon: 'water-outline', emoji: '' },
  { id: 'hot_flashes', label: 'Hot flashes', icon: 'thermometer-outline', emoji: '' },
  { id: 'dizziness', label: 'Dizziness', icon: 'sync-outline', emoji: '' },
  { id: 'lower_back_pain', label: 'Lower back pain', icon: 'body-outline', emoji: '' },
  { id: 'muscle_aches', label: 'Muscle aches', icon: 'fitness-outline', emoji: '' },
  { id: 'appetite_changes', label: 'Appetite changes', icon: 'restaurant-outline', emoji: '' },
  { id: 'tearfulness', label: 'Tearfulness', icon: 'rainy-outline', emoji: '' },
  { id: 'irritability', label: 'Irritability', icon: 'flash-outline', emoji: '' },
];

export const SYMPTOMS = [
  ...BASE_SYMPTOMS.filter((item) => item.id !== 'anxiety'),
  { id: 'hair_fall', label: 'Hair fall', icon: 'leaf-outline', emoji: '' },
  { id: 'pelvic_discomfort', label: 'Pelvic discomfort', icon: 'body-outline', emoji: '' },
];

export const TRACKING_GOALS = [
  { id: 'track_cycle', label: 'Track my cycle' },
  { id: 'understand_irregular', label: 'Understand irregular periods' },
  { id: 'pcos_support', label: 'Manage PCOS or PCOD' },
  { id: 'food_habits', label: 'Improve food habits' },
  { id: 'movement_sleep', label: 'Improve movement and sleep' },
  { id: 'emotional_support', label: 'Feel emotionally supported' },
  { id: 'doctor_prep', label: 'Prepare for doctor appointments' },
];

export const DIETARY_PREFERENCES = [
  { id: 'no_preference', label: 'No preference' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'eggetarian', label: 'Eggetarian' },
  { id: 'non_vegetarian', label: 'Non-vegetarian' },
  { id: 'vegan', label: 'Vegan' },
];

export const MOVEMENT_PREFERENCES = [
  { id: 'walking', label: 'Walking' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'stretching', label: 'Gentle stretching' },
  { id: 'strength', label: 'Beginner strength' },
  { id: 'breathing', label: 'Breathing exercises' },
  { id: 'rest', label: 'Rest and recovery' },
];

export const CYCLE_PHASES = {
  period_days: { label: 'Period days', description: 'A time to notice what your body needs.', get color() { return COLORS.cycle; } },
  early_cycle: { label: 'Earlier cycle', description: 'An estimate based on your logged dates.', get color() { return COLORS.sage; } },
  mid_cycle: { label: 'Mid-cycle', description: 'An estimate based on your logged dates.', get color() { return COLORS.blush; } },
  later_cycle: { label: 'Later cycle', description: 'An estimate based on your logged dates.', get color() { return COLORS.surfaceWarm; } },
};

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
  { id: 'te', label: 'Telugu' },
  { id: 'ta', label: 'Tamil' },
  { id: 'kn', label: 'Kannada' },
  { id: 'mr', label: 'Marathi' },
];

export const TONE_PREFERENCES = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'data', label: 'Data-focused' },
  { id: 'mindfulness', label: 'Mindfulness' },
];

export const AFFIRMATIONS = [
  "Your body is not broken. It is beautifully unique.",
  "You are learning to understand yourself with kindness.",
  "Every cycle is different, and that is okay.",
  "You are doing your best, and that is enough.",
  "Your body deserves patience, not pressure.",
  "Small steps toward understanding are still progress.",
  "You are not alone in this journey.",
  "Your worth is not defined by your cycle.",
  "Rest is productive too.",
  "You are building a relationship with your body based on trust.",
  "It is okay to have hard days.",
  "Your body is wise. Listen to it with compassion.",
  "You are allowed to take up space and prioritize your health.",
  "Healing is not linear, and that is normal.",
  "You deserve care that honors your unique rhythm.",
];
