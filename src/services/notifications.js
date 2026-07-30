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

  async scheduleReminder(identifier, title, body, hour, minute, repeats = true) {
    configureNotificationHandler();
    await this.cancelReminder(identifier);
    
    const trigger = {
      hour,
      minute,
      repeats,
    };
    
    if (Platform.OS === 'android') {
      trigger.channelId = 'bloom-reminders';
    }
    
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
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
    return await Notifications.getAllScheduledNotificationsAsync();
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
