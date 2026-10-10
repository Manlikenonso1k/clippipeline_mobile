import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { queryClient } from '@/api/hooks';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    useAuthStore.getState().hydrate();
    useSettingsStore.getState().hydrate();
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
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="connect" />
          <Stack.Screen name="posts" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="post/[id]" />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
