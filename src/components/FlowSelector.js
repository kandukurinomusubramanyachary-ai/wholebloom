import React from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, createThemedStyles, FLOW_LEVELS, WEB_FOCUS } from '../utils/constants';

export default function FlowSelector({ selected, onSelect }) {
  return (
    <View style={styles.container} accessibilityRole='radiogroup'>
      {FLOW_LEVELS.map((flow) => {
        const isSelected = selected === flow.id;
        return <Pressable
          key={flow.id}
          onPress={() => onSelect?.(flow.id)}
          accessibilityRole='radio'
          accessibilityLabel={`${flow.label} flow`}
          accessibilityState={{ checked: isSelected }}
          style={({ pressed, hovered, focused }) => [
            styles.flowItem,
            styles.webInteractive,
            hovered && !isSelected && styles.hovered,
            isSelected && styles.selected,
            focused && styles.focused,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={flow.icon}
            size={21}
            color={isSelected ? COLORS.brand : COLORS.body}
          />
          <Text style={[styles.label, isSelected && styles.selectedLabel]}>
            {flow.label}
          </Text>
        </Pressable>;
      })}
    </View>
  );
}

const styles = createThemedStyles({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flowItem: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 74,
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
    fontSize: 12,
    color: COLORS.body,
    fontWeight: '600',
  },
  selectedLabel: {
    color: COLORS.brand,
    fontWeight: '700',
  },
});
