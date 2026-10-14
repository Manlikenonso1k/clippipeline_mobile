import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { apiFetch } from '@/api/client';
import { queryClient } from '@/api/hooks';
import type { AuthExchangeResponse, AuthStartResponse, LoginProvider } from '@/api/types';
import { unregisterPushTokenFromBackend } from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';

export const AUTH_REDIRECT = 'clippipelinemobile://auth';

type AuthResult = { status?: string; code?: string; message?: string };

/** Reads status/code/message from clippipelinemobile://auth?... */
export function parseAuthUrl(url: string): AuthResult {
  try {
    const q = Linking.parse(url).queryParams ?? {};
    const pick = (k: string) => {
      const v = q[k];
      return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;
    };
    return { status: pick('status'), code: pick('code'), message: pick('message') };
  } catch {
    return {};
  }
}

export function decodeMessage(msg: string | undefined): string | undefined {
  if (!msg) return msg;
  try {
    return decodeURIComponent(msg.replace(/\+/g, ' '));
  } catch {
    return msg;
  }
}

// One-time codes are single use: the redirect may arrive both via openAuthSessionAsync and the
// deep-link route, so share one in-flight exchange per code.
const exchanges = new Map<string, Promise<void>>();

/** POST /auth/exchange (§9) → store the Sanctum token. */
export function exchangeLoginCode(code: string): Promise<void> {
  const existing = exchanges.get(code);
  if (existing) return existing;
  const p = (async () => {
    const data = await apiFetch<AuthExchangeResponse>('/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, device_name: Platform.OS }),
    });
    await useAuthStore.getState().setToken(data.token);
  })();
  exchanges.set(code, p);
  p.catch(() => exchanges.delete(code));
  return p;
}

/**
 * §9 sign-in broker: GET /auth/{provider}/start → system browser → clippipelinemobile://auth?code=
 * → POST /auth/exchange. Returns true when signed in, false when the user cancelled.
 */
export async function signInWithProvider(provider: LoginProvider): Promise<boolean> {
  const { auth_url } = await apiFetch<AuthStartResponse>(`/auth/${provider}/start?platform=mobile`);
  const result = await WebBrowser.openAuthSessionAsync(auth_url, AUTH_REDIRECT);
  if (result.type !== 'success' || !result.url) {
    // On Android the redirect can arrive as a deep link instead (handled by the /auth route).
    return !!useAuthStore.getState().token;
  }
  const r = parseAuthUrl(result.url);
  if (r.status === 'error') throw new Error(decodeMessage(r.message) || 'Sign-in failed.');
  if (!r.code) throw new Error('Sign-in did not return a code.');
  await exchangeLoginCode(r.code);
  return true;
}

/** Sign out: unregister this device's push token, clear the auth token and every cached query. */
export async function signOut(): Promise<void> {
  try {
    await unregisterPushTokenFromBackend();
  } finally {
    await useAuthStore.getState().clear();
    queryClient.clear();
    router.replace('/login');
  }
}
