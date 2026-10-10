import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiFetch, ApiError } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

WebBrowser.maybeCompleteAuthSession();

// Kinetic Obsidian tokens (see "get started step 4"/DESIGN.md)
const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  container: '#1F1F23',
  containerLow: '#1B1B1F',
  containerHigh: '#2A292E',
  border: '#2A2A36',
  text: '#FFFFFF',
  dark: '#131317',
  muted: '#A1A1AE',
  outline: '#938EA1',
  primary: '#CABEFF',
  violet: '#7C5CFF',
  success: '#28C76F',
  cyan: '#00F2EA',
  youtube: '#FF0000',
  instagram: '#DD2A7B',
  facebook: '#1877F2',
  google: '#4285F4',
} as const;

type Provider = 'google' | 'facebook' | 'tiktok';

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'clippipelinemobile',
  path: 'oauth',
});

const facebookDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
  tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token',
};

export default function LoginScreen() {
  const setToken = useAuthStore((state) => state.setToken);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Provider | 'email' | null>(null);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const facebookClientId = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID;
  const tiktokClientKey = process.env.EXPO_PUBLIC_TIKTOK_CLIENT_KEY;

  const googleDiscovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const [googleRequest, , googlePrompt] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId ?? '',
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      usePKCE: true,
    },
    googleDiscovery,
  );

  const [facebookRequest, , facebookPrompt] = AuthSession.useAuthRequest(
    {
      clientId: facebookClientId ?? '',
      responseType: AuthSession.ResponseType.Code,
      scopes: ['public_profile', 'email'],
      redirectUri,
    },
    facebookDiscovery,
  );

  // Exchange a provider authorization code for our own app token via the Laravel API.
  async function exchange(provider: Provider, code: string) {
    const data = await apiFetch<{ token: string }>(`/auth/${provider}/token`, {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
    await setToken(data.token);
    router.replace('/dashboard');
  }

  async function signInGoogle() {
    setError(null);
    if (!googleClientId) return setError('Google sign-in is not configured for this build.');
    setBusy('google');
    try {
      const result = await googlePrompt();
      if (result.type !== 'success' || !result.params.code) {
        if (result.type !== 'dismiss' && result.type !== 'cancel') setError('Google sign-in did not return an authorization code.');
        return;
      }
      await exchange('google', result.params.code);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in with Google.');
    } finally {
      setBusy(null);
    }
  }

  async function signInFacebook() {
    setError(null);
    if (!facebookClientId) return setError('Facebook sign-in is not configured for this build.');
    setBusy('facebook');
    try {
      const result = await facebookPrompt();
      if (result.type !== 'success' || !result.params.code) {
        if (result.type !== 'dismiss' && result.type !== 'cancel') setError('Facebook sign-in did not return an authorization code.');
        return;
      }
      await exchange('facebook', result.params.code);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in with Facebook.');
    } finally {
      setBusy(null);
    }
  }

  // TikTok v2 uses `client_key` (not client_id) and comma-separated scopes, so we
  // drive it directly instead of through useAuthRequest.
  async function signInTikTok() {
    setError(null);
    if (!tiktokClientKey) return setError('TikTok sign-in is not configured for this build.');
    setBusy('tiktok');
    try {
      const state = Math.random().toString(36).slice(2);
      const authUrl =
        'https://www.tiktok.com/v2/auth/authorize/' +
        `?client_key=${encodeURIComponent(tiktokClientKey)}` +
        '&scope=user.info.basic&response_type=code' +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success' || !result.url) return;
      const { queryParams } = Linking.parse(result.url);
      const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
      if (!code) return setError('TikTok sign-in did not return an authorization code.');
      await exchange('tiktok', code);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in with TikTok.');
    } finally {
      setBusy(null);
    }
  }

  async function signInEmail() {
    setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy('email');
    try {
      const data = await apiFetch<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await setToken(data.token);
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(null);
    }
  }

  const googleDisabled = !googleRequest || busy !== null;
  const otherDisabled = busy !== null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={s.header}>
          <Pressable
            accessibilityLabel="Go back to onboarding"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [s.backBtn, pressed && s.pressedSoft]}
          >
            <MaterialIcons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <View style={s.versionPill}>
            <View style={s.versionDot} />
            <Text style={s.versionText}>v2.4 Active</Text>
          </View>
        </View>

        {/* Brand emblem + value proposition */}
        <View style={s.brand}>
          <View style={s.glow} />
          <View style={s.emblem}>
            <View style={s.emblemInner}>
              <MaterialIcons name="all-inclusive" size={48} color={C.primary} />
            </View>
            <View style={s.bolt}>
              <MaterialIcons name="bolt" size={14} color={C.primary} />
            </View>
          </View>
          <Text style={s.title}>ClipPipeline</Text>
          <View style={s.tagline}>
            <Text style={s.taglineText}>Post once. Everywhere.</Text>
          </View>
          <Text style={s.lede}>Sign in to connect your channels and automate your content pipeline.</Text>
        </View>

        {/* Live connected platforms strip */}
        <View style={s.strip}>
          <View style={s.stripLeft}>
            <View style={s.avatars}>
              <View style={[s.avatar, { zIndex: 3 }]}>
                <FontAwesome5 name="tiktok" size={14} color={C.cyan} />
              </View>
              <View style={[s.avatar, s.avatarOverlap, { zIndex: 2 }]}>
                <FontAwesome5 name="youtube" size={14} color={C.youtube} />
              </View>
              <View style={[s.avatar, s.avatarOverlap, { zIndex: 1 }]}>
                <FontAwesome5 name="instagram" size={14} color={C.instagram} />
              </View>
            </View>
            <Text style={s.stripLabel}>Instant Multi-Sync</Text>
          </View>
          <View style={s.ready}>
            <MaterialIcons name="check-circle" size={14} color={C.success} />
            <Text style={s.readyText}>Ready</Text>
          </View>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Authentication actions */}
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={googleDisabled}
            onPress={signInGoogle}
            style={({ pressed }) => [s.authBtn, s.googleBtn, pressed && s.pressed, googleDisabled && s.disabled]}
          >
            {busy === 'google' ? (
              <ActivityIndicator color={C.dark} style={s.authIcon} />
            ) : (
              <FontAwesome5 name="google" size={18} color={C.google} style={s.authIcon} />
            )}
            <Text style={[s.authText, s.googleText]}>{busy === 'google' ? 'Signing in…' : 'Continue with Google'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={otherDisabled}
            onPress={signInTikTok}
            style={({ pressed }) => [s.authBtn, s.tiktokBtn, pressed && s.pressed, otherDisabled && s.disabled]}
          >
            {busy === 'tiktok' ? (
              <ActivityIndicator color={C.text} style={s.authIcon} />
            ) : (
              <FontAwesome5 name="tiktok" size={18} color={C.cyan} style={s.authIcon} />
            )}
            <Text style={s.authText}>{busy === 'tiktok' ? 'Signing in…' : 'Continue with TikTok'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={otherDisabled || !facebookRequest}
            onPress={signInFacebook}
            style={({ pressed }) => [s.authBtn, s.facebookBtn, pressed && s.pressed, (otherDisabled || !facebookRequest) && s.disabled]}
          >
            {busy === 'facebook' ? (
              <ActivityIndicator color={C.text} style={s.authIcon} />
            ) : (
              <FontAwesome5 name="facebook" size={18} color={C.facebook} style={s.authIcon} />
            )}
            <Text style={s.authText}>{busy === 'facebook' ? 'Signing in…' : 'Continue with Facebook'}</Text>
          </Pressable>
        </View>

        {/* Email / password sign-in */}
        <View style={s.emailWrap}>
          {!emailMode ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => { setError(null); setEmailMode(true); }}
              style={({ pressed }) => [s.emailToggle, pressed && s.pressedSoft]}
            >
              <MaterialIcons name="mail-outline" size={16} color={C.muted} />
              <Text style={s.emailToggleText}>Sign in with email</Text>
            </Pressable>
          ) : (
            <View style={s.emailForm}>
              <View style={s.input}>
                <MaterialIcons name="mail-outline" size={18} color={C.muted} />
                <TextInput
                  style={s.inputText}
                  placeholder="Email"
                  placeholderTextColor={C.outline}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  editable={busy === null}
                />
              </View>
              <View style={s.input}>
                <MaterialIcons name="lock-outline" size={18} color={C.muted} />
                <TextInput
                  style={s.inputText}
                  placeholder="Password"
                  placeholderTextColor={C.outline}
                  secureTextEntry
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                  editable={busy === null}
                  onSubmitEditing={signInEmail}
                  returnKeyType="go"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={busy !== null}
                onPress={signInEmail}
                style={({ pressed }) => [s.emailBtn, pressed && s.pressed, busy !== null && s.disabled]}
              >
                {busy === 'email' ? <ActivityIndicator color={C.text} /> : <Text style={s.emailBtnText}>Sign In</Text>}
              </Pressable>
              <Pressable onPress={() => setEmailMode(false)} style={s.emailBack}>
                <Text style={s.emailBackText}>Use social sign-in instead</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Guest / preview divider */}
        <View style={s.guestWrap}>
          <View style={s.dividerRow}>
            <View style={s.divider} />
            <Text style={s.dividerText}>or explore first</Text>
            <View style={s.divider} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/dashboard')}
            style={({ pressed }) => [s.guestBtn, pressed && s.pressedSoft]}
          >
            <MaterialIcons name="visibility" size={16} color={C.primary} />
            <Text style={s.guestText}>Continue in Guest / Preview Mode</Text>
          </Pressable>
        </View>

        {/* Security guarantee */}
        <View style={s.security}>
          <View style={s.securityIcon}>
            <MaterialIcons name="lock" size={18} color={C.primary} />
          </View>
          <View style={s.securityCopy}>
            <Text style={s.securityTitle}>Encrypted Syndication</Text>
            <Text style={s.securitySub}>Tokens secured with zero password sharing.</Text>
          </View>
        </View>

        {/* Legal footer */}
        <View style={s.footer}>
          <Text style={s.legal}>
            By continuing, you agree to ClipPipeline&apos;s <Text style={s.link}>Terms of Service</Text> and{' '}
            <Text style={s.link}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },

  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.container, alignItems: 'center', justifyContent: 'center' },
  versionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: C.containerLow },
  versionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  versionText: { color: C.muted, fontSize: 12, fontWeight: '600' },

  brand: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  glow: { position: 'absolute', top: -24, width: 192, height: 192, borderRadius: 96, backgroundColor: '#7C5CFF26' },
  emblem: { width: 112, height: 112, borderRadius: 24, backgroundColor: C.raised, padding: 4, marginBottom: 16, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  emblemInner: { width: '100%', height: '100%', borderRadius: 20, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  bolt: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  title: { color: C.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  tagline: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, backgroundColor: '#CABEFF1A' },
  taglineText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  lede: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 300 },

  strip: { backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stripLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatars: { flexDirection: 'row' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  avatarOverlap: { marginLeft: -6 },
  stripLabel: { color: C.text, fontSize: 13, fontWeight: '500' },
  ready: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  readyText: { color: C.success, fontSize: 12, fontWeight: '600' },

  error: { color: '#FFB4AB', fontSize: 13, textAlign: 'center', marginBottom: 12 },

  actions: { gap: 12 },
  authBtn: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  authIcon: { position: 'absolute', left: 16 },
  authText: { color: C.text, fontSize: 14, fontWeight: '600' },
  googleBtn: { backgroundColor: C.text, elevation: 3 },
  googleText: { color: C.dark },
  tiktokBtn: { backgroundColor: C.raised },
  facebookBtn: { backgroundColor: C.containerHigh },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  pressedSoft: { opacity: 0.7 },
  disabled: { opacity: 0.5 },

  emailWrap: { marginTop: 4 },
  emailToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  emailToggleText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  emailForm: { gap: 10 },
  input: { height: 48, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  inputText: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 0 },
  emailBtn: { height: 48, borderRadius: 12, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  emailBtnText: { color: C.text, fontSize: 14, fontWeight: '700' },
  emailBack: { alignItems: 'center', paddingVertical: 8 },
  emailBackText: { color: C.outline, fontSize: 12, fontWeight: '600' },

  guestWrap: { alignItems: 'center', marginTop: 20, marginBottom: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 8 },
  divider: { flex: 1, height: 1, backgroundColor: C.containerHigh },
  dividerText: { paddingHorizontal: 12, color: C.outline, fontSize: 13, fontWeight: '500' },
  guestBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: C.containerLow },
  guestText: { color: C.muted, fontSize: 12, fontWeight: '600' },

  security: { backgroundColor: C.bg, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  securityIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#947DFF33', alignItems: 'center', justifyContent: 'center' },
  securityCopy: { flex: 1 },
  securityTitle: { color: C.text, fontSize: 12, fontWeight: '600' },
  securitySub: { color: C.muted, fontSize: 13, marginTop: 2 },

  footer: { marginTop: 'auto', paddingHorizontal: 4 },
  legal: { color: C.outline, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  link: { color: C.muted, textDecorationLine: 'underline' },
});
