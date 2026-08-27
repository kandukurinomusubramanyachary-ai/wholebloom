import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, createThemedStyles, LAYOUT, WEB_FOCUS } from '../utils/constants';
import { notifications } from '../services/notifications';
import ScreenHeader from '../components/ScreenHeader';
import ScreenScaffold from '../components/ScreenScaffold';

const DEFAULT_REMINDERS = {
  checkin: { enabled: true, time: '20:00' },
  period: { enabled: false, time: '20:00' },
  medication: { enabled: false, time: '09:00' },
  meals: { enabled: false, time: '13:00' },
  movement: { enabled: false, time: '18:00' },
  sleep: { enabled: false, time: '22:00' },
  weekly: { enabled: true, time: '09:00', day: 0 },
};

const REMINDER_CONFIGS = [
  {
    key: 'checkin',
    label: 'Daily check-in',
    desc: 'A gentle nudge to notice your day',
    icon: 'checkmark-circle-outline',
    title: 'A note from Bloom',
    body: 'Take a quiet moment for your daily check-in when you are ready.',
  },
  {
    key: 'period',
    label: 'Period logging',
    desc: 'Remember to update bleeding when it is useful',
    icon: 'water-outline',
    title: 'A note from Bloom',
    body: 'You can update your cycle record when it feels useful.',
  },
  {
    key: 'medication',
    label: 'Medicine or supplement',
    desc: 'A private prompt for something you planned',
    icon: 'medkit-outline',
    title: 'A note from Bloom',
    body: 'A gentle reminder for something you planned today.',
  },
  {
    key: 'meals',
    label: 'Meals',
    desc: 'A no-pressure prompt to log a meal',
    icon: 'restaurant-outline',
    title: 'A note from Bloom',
    body: 'Log a meal if it would help you remember your day.',
  },
  {
    key: 'movement',
    label: 'Movement',
    desc: 'A realistic prompt for movement or recovery',
    icon: 'walk-outline',
    title: 'A note from Bloom',
    body: 'Choose movement, stretching or rest based on how you feel.',
  },
  {
    key: 'sleep',
    label: 'Sleep',
    desc: 'A quiet cue to begin winding down',
    icon: 'moon-outline',
    title: 'A note from Bloom',
    body: 'A small wind-down moment may help you prepare for rest.',
  },
  {
    key: 'weekly',
    label: 'Weekly summary',
    desc: 'A gentle prompt to review your week',
    icon: 'analytics-outline',
    title: 'Your Bloom week',
    body: 'Your weekly summary is ready whenever you want to look back.',
  },
];

function mergeReminders(saved = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_REMINDERS).map(([key, value]) => [
      key,
      { ...value, ...(saved[key] || {}) },
    ])
  );
}

export default function RemindersScreen({ navigation }) {
  const { state, saveSettings } = useApp();
  const [reminders, setReminders] = useState(() => mergeReminders(state.settings?.reminders));
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    void notifications.setupAndroidChannel().catch((error) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Bloom reminders] Notification channel setup failed.', error);
      }
    });
  }, []);

  async function schedule(key, reminder) {
    const config = REMINDER_CONFIGS.find((item) => item.key === key);
    const [hour, minute] = reminder.time.split(':').map(Number);
    const weekday = key === 'weekly' ? Number(reminder.day) + 1 : null;
    await notifications.scheduleReminder(key, config.title, config.body, hour, minute, true, weekday);
  }

  async function toggleReminder(key, enabled) {
    if (busyKey) return;
    setBusyKey(key);
    setError('');
    setStatus('');

    try {
      if (enabled) {
        const permissionGranted = await notifications.requestPermissions();
        if (!permissionGranted) {
          const permissionError = new Error('Notifications are turned off for Bloom. You can enable them in your device settings.');
          permissionError.code = 'permission';
          throw permissionError;
        }
      }

      const updated = {
        ...reminders,
        [key]: { ...reminders[key], enabled },
      };
      await saveSettings({ reminders: updated });
      if (enabled) await schedule(key, updated[key]);
      else await notifications.cancelReminder(key);
      setReminders(updated);
      setStatus(`${REMINDER_CONFIGS.find((item) => item.key === key)?.label} reminder ${enabled ? 'turned on' : 'turned off'}.`);
    } catch (updateError) {
      setError(
        updateError.code === 'permission'
          ? updateError.message
          : 'Bloom could not update this reminder. Please try again.'
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function adjustTime(key, minutes) {
    if (busyKey) return;
    setBusyKey(key);
    setError('');
    setStatus('');
    const current = reminders[key] || DEFAULT_REMINDERS[key];
    const [hour, minute] = current.time.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute + minutes, 0, 0);
    const newTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const updated = { ...reminders, [key]: { ...current, time: newTime } };

    try {
      await saveSettings({ reminders: updated });
      if (updated[key].enabled) await schedule(key, updated[key]);
      setReminders(updated);
      setStatus(`${REMINDER_CONFIGS.find((item) => item.key === key)?.label} reminder moved to ${newTime}.`);
    } catch (updateError) {
      setError('Bloom could not update this reminder time. Please try again.');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <ScreenScaffold
      contentContainerStyle={styles.scrollContent}
      innerStyle={styles.content}
    >
          <BackButton onPress={() => navigation.goBack()} />
          <ScreenHeader
            title='Reminders'
            subtitle='Choose a few useful prompts. Missing one never resets your progress.'
          />

          {error ? (
            <View style={styles.errorState} accessibilityRole='alert' accessibilityLiveRegion='assertive'>
              <Ionicons name='alert-circle-outline' size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {status ? (
            <View style={styles.successState} accessibilityRole='status' accessibilityLiveRegion='polite'>
              <Ionicons name='checkmark-circle-outline' size={20} color={COLORS.sage} />
              <Text style={styles.successText}>{status}</Text>
            </View>
          ) : null}

          <View style={styles.list}>
            {REMINDER_CONFIGS.map((config, index) => {
              const reminder = reminders[config.key] || DEFAULT_REMINDERS[config.key];
              const busy = busyKey === config.key;
              return (
                <View
                  key={config.key}
                  style={[
                    styles.reminderItem,
                    index < REMINDER_CONFIGS.length - 1 && styles.reminderItemDivider,
                  ]}
                >
                  <Pressable
                    onPress={() => toggleReminder(config.key, !reminder.enabled)}
                    disabled={Boolean(busyKey)}
                    accessibilityRole='switch'
                    accessibilityLabel={`${config.label} reminder`}
                    accessibilityHint={config.desc}
                    accessibilityState={{ checked: Boolean(reminder.enabled), disabled: Boolean(busyKey), busy }}
                    style={({ pressed, hovered, focused }) => [
                      styles.reminderHeader,
                      hovered && !busyKey && styles.headerHovered,
                      focused && styles.headerFocused,
                      pressed && !busyKey && styles.headerPressed,
                    ]}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons name={config.icon} size={20} color={COLORS.brand} />
                    </View>
                    <View style={styles.reminderCopy}>
                      <Text style={styles.reminderLabel}>{config.label}</Text>
                      <Text style={styles.reminderDesc}>{config.desc}</Text>
                    </View>
                    <View style={[styles.switchTrack, reminder.enabled && styles.switchTrackActive]}>
                      <View style={[styles.switchKnob, reminder.enabled && styles.switchKnobActive]}>
                        {reminder.enabled ? <Ionicons name='checkmark' size={12} color={COLORS.brand} /> : null}
                      </View>
                    </View>
                  </Pressable>

                  {reminder.enabled ? (
                    <View style={styles.timePicker}>
                      <Pressable
                        onPress={() => adjustTime(config.key, -30)}
                        disabled={Boolean(busyKey)}
                        accessibilityRole='button'
                        accessibilityLabel={`Move ${config.label} 30 minutes earlier`}
                        accessibilityState={{ disabled: Boolean(busyKey), busy }}
                        style={({ pressed, hovered, focused }) => [
                          styles.timeButton,
                          hovered && !busyKey && styles.timeButtonHovered,
                          focused && styles.focusedControl,
                          pressed && !busyKey && styles.pressed,
                        ]}
                      >
                        <Ionicons name='remove' size={22} color={COLORS.ink} />
                      </Pressable>
                      <View style={styles.timeCopy} accessible accessibilityLabel={`${config.label} reminder time ${reminder.time}`}>
                        <Text style={styles.timeLabel}>{busy ? 'Updating' : 'Reminder time'}</Text>
                        <Text style={styles.timeText}>{reminder.time}</Text>
                      </View>
                      <Pressable
                        onPress={() => adjustTime(config.key, 30)}
                        disabled={Boolean(busyKey)}
                        accessibilityRole='button'
                        accessibilityLabel={`Move ${config.label} 30 minutes later`}
                        accessibilityState={{ disabled: Boolean(busyKey), busy }}
                        style={({ pressed, hovered, focused }) => [
                          styles.timeButton,
                          hovered && !busyKey && styles.timeButtonHovered,
                          focused && styles.focusedControl,
                          pressed && !busyKey && styles.pressed,
                        ]}
                      >
                        <Ionicons name='add' size={22} color={COLORS.ink} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.note}>
            <Ionicons name='notifications-outline' size={18} color={COLORS.sage} />
            <Text style={styles.noteText}>
              Bloom uses quiet, neutral notification text. Your device controls whether reminders are delivered.
            </Text>
          </View>
    </ScreenScaffold>
  );
}

function BackButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel='Go back'
      hitSlop={8}
      style={({ pressed, hovered, focused }) => [
        styles.backButton,
        hovered && styles.backButtonHovered,
        focused && styles.backButtonFocused,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name='chevron-back' size={20} color={COLORS.ink} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

const styles = createThemedStyles({
  scrollContent: { paddingBottom: 48 },
  content: { maxWidth: LAYOUT.phoneMaxWidth, paddingTop: 12 },
  backButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, marginBottom: 8, paddingHorizontal: 6 },
  backText: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
  errorState: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 12, padding: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: '#FFF7F6' },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.error },
  successState: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 12, padding: 14, borderRadius: LAYOUT.controlRadius, backgroundColor: COLORS.sageLight },
  successText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.body },
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.canvas,
  },
  reminderItem: { backgroundColor: COLORS.canvas },
  reminderItemDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  reminderHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  headerPressed: { backgroundColor: COLORS.surfaceSoft },
  headerHovered: { backgroundColor: COLORS.surfaceWarm },
  headerFocused: {
    backgroundColor: COLORS.brandSoft,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1 },
  reminderLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: COLORS.ink },
  reminderDesc: { marginTop: 2, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  switchTrack: { width: 50, height: 28, justifyContent: 'center', paddingHorizontal: 2, borderRadius: 14, backgroundColor: COLORS.hairline },
  switchTrackActive: { backgroundColor: COLORS.brand },
  switchKnob: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  switchKnobActive: { transform: [{ translateX: 22 }] },
  timePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: COLORS.hairline, backgroundColor: COLORS.surfaceSoft },
  timeButton: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.hairline, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas },
  timeButtonHovered: { borderColor: '#D7B1A5', backgroundColor: COLORS.surfaceWarm },
  focusedControl: {
    borderColor: COLORS.brand,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
  timeCopy: { minWidth: 98, alignItems: 'center' },
  timeLabel: { fontSize: 11, lineHeight: 15, color: COLORS.muted },
  timeText: { marginTop: 2, fontSize: 20, lineHeight: 25, fontWeight: '700', color: COLORS.ink, fontVariant: ['tabular-nums'] },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 4, paddingVertical: 20 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.muted },
  backButtonHovered: { backgroundColor: COLORS.surfaceSoft, borderRadius: 10 },
  backButtonFocused: {
    backgroundColor: COLORS.brandSoft,
    borderRadius: 10,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
});
