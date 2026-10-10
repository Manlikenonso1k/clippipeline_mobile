import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const CHANNELS = [
  { id: 'sync', name: 'Sync Updates' },
  { id: 'published', name: 'Posts Published' },
  { id: 'alerts', name: 'Failures & Alerts' },
] as const;

export async function registerNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const { id, name } of CHANNELS) {
    try {
      await Notifications.setNotificationChannelAsync(id, {
        name,
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C5CFF',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {
      // ignore; other channels should still be created
    }
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (existing.status !== 'undetermined' && !existing.canAskAgain) return false;
    const result = await Notifications.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

export async function registerForPushTokenAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    if (!(await requestNotificationPermissions())) return null;
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data ?? null;
  } catch {
    return null;
  }
}

export async function sendLocalTestNotification(channelId: string = 'sync'): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'ClipPipeline',
        body: 'This is a test notification.',
      },
      // On Android the channel is specified via a channel-aware trigger (fires immediately).
      trigger: Platform.OS === 'android' ? { channelId } : null,
    });
  } catch {
    // ignore
  }
}
