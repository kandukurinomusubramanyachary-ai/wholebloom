import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { KOBOYO_ICONS } from './koboyoIcons';

// Maps Ionicons names (as used across Bloom) to koboyo hand-drawn line icons.
// The app calls icons by Ionicons names; this wrapper renders the koboyo
// equivalent when one exists and falls back to Ionicons otherwise, so nothing
// ever breaks. Keys are the base name WITHOUT the "-outline" suffix — both the
// filled and outline Ionicons variants resolve to the same clean line icon.
const IONICON_TO_KOBOYO = {
  'chevron-back': 'chevron-left',
  'chevron-forward': 'chevron-right',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  'arrow-back': 'arrow-left',
  'arrow-forward': 'arrow-right',
  checkmark: 'check',
  'checkmark-done': 'check',
  'checkmark-circle': 'circle-check',
  checkbox: 'square-check',
  close: 'x',
  'close-circle': 'circle-x',
  remove: 'x',
  add: 'plus',
  'add-circle': 'plus-circle',
  'alert-circle': 'circle-alert',
  warning: 'warning',
  'information-circle': 'info-circle',
  'lock-closed': 'lock-closed',
  'shield-checkmark': 'shield-check',
  calendar: 'calendar',
  'calendar-clear': 'calendar',
  today: 'calendar-check',
  restaurant: 'restaurant',
  nutrition: 'apple',
  water: 'water-drop',
  moon: 'moon',
  leaf: 'leaf',
  sparkles: 'sparkles',
  bulb: 'bulb',
  heart: 'heart',
  happy: 'smile',
  pulse: 'activity',
  body: 'activity',
  fitness: 'dumbbell',
  walk: 'user',
  medkit: 'heartbeat',
  'battery-half': 'battery-half',
  videocam: 'video',
  'videocam-off': 'video-off',
  scan: 'scan',
  eye: 'eye',
  'eye-off': 'eye-off',
  trash: 'trash',
  create: 'pencil',
  copy: 'copy',
  download: 'download',
  share: 'share',
  'document-text': 'document',
  settings: 'settings',
  search: 'search',
  repeat: 'repeat',
  time: 'clock',
  timer: 'timer',
  'swap-horizontal': 'swap',
  notifications: 'bell',
  'notifications-off': 'bell-off',
  'log-out': 'log-out',
  'person-circle': 'user',
  'person-remove': 'user-x',
  chatbubbles: 'message-circle',
  analytics: 'bar-chart',
  'phone-portrait': 'phone',
  'bag-add': 'bag',
};

function baseName(name) {
  return String(name || '').replace(/-outline$/, '').replace(/-sharp$/, '');
}

// Uniform breathing room around every glyph (fraction of the square side).
// Keeps icons from touching their bounds so they feel optically consistent.
const ICON_PADDING = 0.08;

// koboyo glyphs ship with wildly varying viewBox aspect ratios (tall chevrons,
// wide arrows, etc). Rendering those into a square width/height distorts them.
// This recomputes a SQUARE viewBox centered on the original bounds with uniform
// padding, so every icon keeps its true proportions and sits at a consistent
// optical size — the core of making the set feel polished.
function squareViewBox(viewBox) {
  const parts = String(viewBox || '0 0 24 24').split(/\s+/).map(Number);
  const [minX, minY, w, h] = parts.length === 4 ? parts : [0, 0, 24, 24];
  const longest = Math.max(w, h);
  const side = longest * (1 + ICON_PADDING * 2);
  const nx = minX - (side - w) / 2;
  const ny = minY - (side - h) / 2;
  return `${nx} ${ny} ${side} ${side}`;
}

export default function Icon({ name, size = 24, color = '#000', style, ...rest }) {
  const koboyoKey = IONICON_TO_KOBOYO[baseName(name)];
  const icon = koboyoKey ? KOBOYO_ICONS[koboyoKey] : null;

  if (icon && Array.isArray(icon.paths) && icon.paths.length) {
    return (
      <Svg
        width={size}
        height={size}
        viewBox={squareViewBox(icon.viewBox)}
        fill='none'
        style={style}
        accessibilityRole={rest.accessibilityRole}
        accessibilityLabel={rest.accessibilityLabel}
      >
        {icon.paths.map((p, index) => (
          <Path
            key={index}
            d={p.d}
            fill={color}
            fillRule={p.fillRule || 'nonzero'}
            clipRule={p.fillRule || 'nonzero'}
            strokeLinecap='round'
            strokeLinejoin='round'
            opacity={p.opacity != null ? Number(p.opacity) : undefined}
          />
        ))}
      </Svg>
    );
  }

  // Fallback: original Ionicons for any name not mapped to koboyo.
  return <Ionicons name={name} size={size} color={color} style={style} {...rest} />;
}
