import React from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, MOODS, WEB_FOCUS } from '../utils/constants';

export default function MoodSelector({ selected, onSelect }) {
  return (
    <View style={styles.container} accessibilityRole='radiogroup'>
      {MOODS.map((mood) => {
        const isSelected = selected === mood.id;
        return <Pressable
          key={mood.id}
          onPress={() => onSelect?.(mood.id)}
          accessibilityRole='radio'
          accessibilityLabel={mood.label}
          accessibilityState={{ checked: isSelected }}
          style={({ pressed, hovered, focused }) => [
            styles.moodItem,
            styles.webInteractive,
            hovered && !isSelected && styles.hovered,
            isSelected && styles.selected,
            focused && styles.focused,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={mood.icon}
            size={23}
            color={isSelected ? COLORS.brand : COLORS.body}
          />
          <Text style={[styles.label, isSelected && styles.selectedLabel]}>
            {mood.label}
          </Text>
        </Pressable>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodItem: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 78,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.surfaceSoft,
  },
  selected: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
  },
  hovered: {
    backgroundColor: COLORS.surfaceStrong,
    borderColor: COLORS.hairline,
  },
  webInteractive: Platform.select({
    web: { cursor: 'pointer' },
    default: {},
  }),
  focused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontSize: 13,
    color: COLORS.body,
    fontWeight: '600',
  },
  selectedLabel: {
    color: COLORS.brand,
    fontWeight: '700',
  },
});
