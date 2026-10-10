import { MaterialIcons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { apiFetch, ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'clippipelinemobile',
  path: 'oauth',
});

export default function LoginScreen() {
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const setToken = useAuthStore((state) => state.setToken);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? '',
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      usePKCE: true,
    },
    discovery,
  );

  async function signIn() {
    setError(null);
    if (!clientId) {
      setError('Google sign-in is not configured for this build.');
      return;
    }

    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success' || !result.params.code) {
        if (result.type !== 'dismiss' && result.type !== 'cancel') {
          setError('Google sign-in did not return an authorization code.');
        }
        return;
      }

      const data = await apiFetch<{ token: string }>('/auth/google/token', {
        method: 'POST',
        body: JSON.stringify({
          code: result.params.code,
          redirect_uri: redirectUri,
        }),
      });
      await setToken(data.token);
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in with Google.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <MaterialIcons name="videocam" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Welcome to ClipPipeline</Text>
        <Text style={styles.subtitle}>Sign in to manage your connected creator accounts.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={!request || loading}
          onPress={signIn}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, (!request || loading) && styles.disabled]}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="login" size={20} color="#FFFFFF" />}
          <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Continue with Google'}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E12' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  icon: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#7C5CFF', borderRadius: 16, justifyContent: 'center', height: 64, width: 64 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 24, textAlign: 'center' },
  subtitle: { color: '#A1A1AE', fontSize: 16, lineHeight: 23, marginTop: 10, textAlign: 'center' },
  error: { color: '#FF8A8A', marginTop: 24, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: '#7C5CFF', borderRadius: 12, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 32, minHeight: 52 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  back: { alignSelf: 'center', marginTop: 20, padding: 10 },
  backText: { color: '#A1A1AE', fontWeight: '600' },
});
