import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { queryClient } from '@/api/hooks';
import * as Notifications from 'expo-notifications';
import {
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
      } catch {
        // silent
      }
    })();

    // Re-register this device's push token whenever the user signs in.
    const unsub = useAuthStore.subscribe((state, prev) => {
      if (state.token && state.token !== prev.token) {
        syncPushTokenToBackend();
      }
    });

    // Tap-to-open: route to the relevant screen from the notification payload.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { screen?: string; postId?: number | string }
        | undefined;
      if (data?.screen === 'post' && data.postId != null) {
        router.push({ pathname: '/post/[id]', params: { id: String(data.postId) } });
      }
    });

    return () => {
      unsub();
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
          <Stack.Screen name="post/[id]" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
