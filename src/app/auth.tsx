// Deep-link target for the §9 sign-in broker: clippipelinemobile://auth?status=ok&code=…
// (Android can deliver the redirect here instead of to openAuthSessionAsync.)
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { errorText } from '@/api/client';
import { SheetButton } from '@/components/sheet';
import { InlineMessage } from '@/components/ui-kit';
import { decodeMessage, exchangeLoginCode } from '@/lib/session';
import { useAuthStore } from '@/store/authStore';

export default function AuthCallback() {
  const params = useLocalSearchParams<{ status?: string; code?: string; message?: string }>();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const handled = useRef(false);
  const paramError =
    params.status === 'error'
      ? decodeMessage(params.message) || 'Sign-in failed.'
      : !params.code && !useAuthStore.getState().token
        ? 'Sign-in did not return a code.'
        : null;
  const error = paramError ?? exchangeError;

  useEffect(() => {
    if (handled.current || params.status === 'error') return;
    handled.current = true;
    if (!params.code) {
      if (useAuthStore.getState().token) router.replace('/dashboard');
      return;
    }
    exchangeLoginCode(params.code)
      .then(() => router.replace('/dashboard'))
      .catch((e) => {
        // The same code may already have been exchanged by the login screen.
        if (useAuthStore.getState().token) router.replace('/dashboard');
        else setExchangeError(errorText(e));
      });
  }, [params.status, params.code]);

  return (
    <View style={s.root}>
      {error ? (
        <View style={s.box}>
          <InlineMessage tone="danger" icon="error-outline" text={error} />
          <SheetButton tone="primary" icon="login" label="Back to sign in" onPress={() => router.replace('/login')} />
        </View>
      ) : (
        <ActivityIndicator color="#CABEFF" size="large" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0E12', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { alignSelf: 'stretch', gap: 12 },
});
