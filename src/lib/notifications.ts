import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiFetch } from '@/api/client';

const WELCOME_KEY = 'clippipeline_welcome_shown';

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

// Register this device's Expo push token with the backend so the server can
// send pushes. Works signed-out too (anonymous device) so announcements can
// reach everyone; re-runs on login to attach the token to the user.
export async function syncPushTokenToBackend(): Promise<void> {
  try {
    const token = await registerForPushTokenAsync();
    if (!token) return;
    await apiFetch('/device-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch {
    // ignore — push-token sync is best-effort
  }
}

// Fire a one-time "welcome" LOCAL notification on first launch — needs no
// login, no server, no FCM. Just proves notifications work and greets the user.
export async function maybeSendWelcomeNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const already = await SecureStore.getItemAsync(WELCOME_KEY).catch(() => null);
    if (already) return;
    if (!(await requestNotificationPermissions())) return;
    await SecureStore.setItemAsync(WELCOME_KEY, '1').catch(() => {});
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Welcome to ClipPipeline 🎉',
        body: 'Post once, everywhere. Connect a channel and your clips auto-sync to TikTok, YouTube & Instagram.',
        data: { type: 'welcome' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 4,
        ...(Platform.OS === 'android' ? { channelId: 'sync' } : {}),
      },
    });
  } catch {
    // ignore
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
