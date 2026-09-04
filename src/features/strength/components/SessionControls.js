import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Icon from '../../../components/Icon';

function Control({ icon, label, onPress, large = false, destructive = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={({ pressed, focused }) => [styles.control, large && styles.large, destructive && styles.destructive, focused && styles.focused, pressed && styles.pressed]}
    >
      <Icon name={icon} size={large ? 29 : 21} color={destructive ? '#FF6682' : large ? '#121113' : '#FFFFFF'} />
    </Pressable>
  );
}

export default function SessionControls({ paused, muted, onPause, onMute, onStop }) {
  return (
    <View style={styles.row} accessibilityLabel='Session controls'>
      <Control icon={muted ? 'volume-mute-outline' : 'volume-high-outline'} label={muted ? 'Unmute' : 'Mute'} onPress={onMute} />
      <Control icon={paused ? 'play' : 'pause'} label={paused ? 'Resume' : 'Pause'} onPress={onPause} large />
      <Control icon='close' label='Stop set' onPress={onStop} destructive />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 34, backgroundColor: 'rgba(18,17,19,0.82)' },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  large: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  destructive: { backgroundColor: 'rgba(180,35,24,0.18)' },
  focused: { borderWidth: 2, borderColor: '#FFFFFF' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
