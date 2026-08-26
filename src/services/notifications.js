import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let notificationHandlerConfigured = false;

export function configureNotificationHandler() {
  if (notificationHandlerConfigured) return true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerConfigured = true;
    return true;
  } catch {
    return false;
  }
}

class NotificationService {
  async requestPermissions() {
    configureNotificationHandler();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  }

  async scheduleReminder(identifier, title, body, hour, minute, repeats = true, weekday = null) {
    configureNotificationHandler();
    await this.cancelReminder(identifier);

    if (!Number.isInteger(hour) || hour < 0 || hour > 23
      || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error('Reminder time is invalid.');
    }

    const trigger = Number.isInteger(weekday) && weekday >= 1 && weekday <= 7
      ? { weekday, hour, minute, repeats: true }
      : { hour, minute, repeats };
    
    if (Platform.OS === 'android') {
      trigger.channelId = 'bloom-reminders';
    }
    
    const content = {
      title,
      body,
      sound: false,
      ...(Platform.OS === 'android'
        ? { priority: Notifications.AndroidNotificationPriority.LOW }
        : {}),
    };

    return Notifications.scheduleNotificationAsync({
      content: {
        ...content,
      },
      trigger,
      identifier,
    });
  }

  async cancelReminder(identifier) {
    configureNotificationHandler();
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  async cancelAllReminders() {
    configureNotificationHandler();
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getScheduledReminders() {
    configureNotificationHandler();
    return Notifications.getAllScheduledNotificationsAsync();
  }

  async setupAndroidChannel() {
    configureNotificationHandler();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bloom-reminders', {
        name: 'Bloom Reminders',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 0, 0, 0],
        lightColor: '#C0755A',
        sound: null,
        enableVibrate: false,
      });
    }
  }
}

export const notifications = new NotificationService();
