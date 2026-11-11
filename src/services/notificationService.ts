import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications for new inbound messages and missed calls.
 *
 * Works in Expo Go (local notifications are supported there). Waking the
 * app when it is fully closed needs remote push — a development build plus
 * backend push support — which does not exist yet; see README.
 */
const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let prepared: Promise<boolean> | null = null;

async function prepare(): Promise<boolean> {
  if (!supported) return false;
  // Android 13+ shows the permission prompt only after a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('communications', {
      name: 'Calls & messages',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export const notificationService = {
  /** Creates the Android channel and asks for permission (once per run). */
  ensureReady(): Promise<boolean> {
    prepared ??= prepare().catch(() => false);
    return prepared;
  },

  /** Shows a local notification now; `url` is opened when it is tapped. */
  async notify(title: string, body: string, url: string): Promise<void> {
    if (!(await notificationService.ensureReady())) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { url } },
        trigger: null, // null = present immediately
      });
    } catch {
      // Notifications are best-effort; never break the sync loop.
    }
  },
};
