import React from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SYMPTOMS, WEB_FOCUS } from '../utils/constants';

export default function SymptomPicker({ selected = [], onToggle }) {
  return (
    <View style={styles.container} accessibilityRole='group'>
      {SYMPTOMS.map((symptom) => {
        const isSelected = selected.includes(symptom.id);
        return (
          <Pressable
            key={symptom.id}
            onPress={() => onToggle?.(symptom.id)}
            accessibilityRole='checkbox'
            accessibilityLabel={symptom.label}
            accessibilityState={{ checked: isSelected }}
            style={({ pressed, hovered, focused }) => [
              styles.chip,
              styles.webInteractive,
              hovered && !isSelected && styles.hovered,
              isSelected && styles.selected,
              focused && styles.focused,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={isSelected ? 'checkmark-circle' : symptom.icon}
              size={17}
              color={isSelected ? COLORS.brand : COLORS.body}
            />
            <Text style={[styles.label, isSelected && styles.selectedLabel]}>
              {symptom.label}
            </Text>
          </Pressable>
        );
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.surfaceSoft,
    gap: 7,
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
