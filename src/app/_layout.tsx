import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { invalidateForPush, queryClient } from '@/api/hooks';
import * as Notifications from 'expo-notifications';
import {
  maybeSendWelcomeNotification,
  registerNotificationChannels,
  requestNotificationPermissions,
  syncPushTokenToBackend,
} from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    useAuthStore.getState().hydrate();
    useSettingsStore.getState().hydrate();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await registerNotificationChannels();
        await requestNotificationPermissions();
        await syncPushTokenToBackend();
        await maybeSendWelcomeNotification();
      } catch {
        // silent
      }
    })();

    // Re-register this device's push token whenever the user signs in.
    // Also drop every cached query when the user changes (login, logout, 401) so
    // one account's data (or guest demo data) never shows for another.
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (state.token === prev.token) return;
      if (prev.hydrated) queryClient.clear();
      if (state.token) syncPushTokenToBackend();
    });

    // Foreground pushes: refresh the affected queries (CONTRACT §7).
    const recv = Notifications.addNotificationReceivedListener((n) => {
      invalidateForPush(n.request.content.data as { type?: string; postId?: number | string } | undefined);
    });

    // Tap-to-open: refresh, then route to the relevant screen from the payload.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { type?: string; screen?: string; postId?: number | string }
        | undefined;
      invalidateForPush(data);
      if (data?.screen === 'post' && data.postId != null) {
        router.push({ pathname: '/post/[id]', params: { id: String(data.postId) } });
      } else if (data?.screen === 'connect') {
        router.push('/connect');
      }
    });

    return () => {
      unsub();
      recv.remove();
      sub.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={DarkTheme}>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="welcome/two" />
          <Stack.Screen name="welcome/three" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post/new" />
          <Stack.Screen name="post/[id]" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
