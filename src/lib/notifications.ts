import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show notifications with sound even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android') {
    // Default channel for user notifications
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#208AEF',
    });

    // Admin alert channel — loud sound + "engk engk" vibration
    await Notifications.setNotificationChannelAsync('admin-alert', {
      name: 'Admin Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'engk.wav',
      vibrationPattern: [0, 400, 150, 400],
      lightColor: '#ef4444',
      bypassDnd: true,
    });
  }

  await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: true,
    },
  });
}

// For users — order status updates
export async function sendNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

// For admin — loud engk engk alert
export async function sendAdminAlert(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'engk.wav',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 400, 150, 400],
    },
    trigger: null,
  });
}
