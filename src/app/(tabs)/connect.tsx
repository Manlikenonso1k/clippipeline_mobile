import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorText } from '@/api/client';
import { useConnectStart, useDeleteAccount, useFlags, useIsGuest, useMe, useSocialAccounts } from '@/api/hooks';
import type { ConnectProvider, Platform, SocialAccount } from '@/api/types';
import { Sheet, SheetButton, SheetLink, SheetText } from '@/components/sheet';
import { AnimatedPressable, InlineMessage, RetryMessage, Skeleton } from '@/components/ui-kit';
import { openProfile, requireAccount } from '@/store/uiStore';
import { useRefresh } from '@/hooks/use-refresh';
import { formatCount, formatDate } from '@/lib/format';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Kinetic Obsidian tokens (see "connect step 7/DESIGN.md")
const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  container: '#1F1F23',
  containerLow: '#1B1B1F',
  containerHigh: '#2A292E',
  containerHighest: '#353439',
  border: '#2A2A36',
  text: '#FFFFFF',
  muted: '#A1A1AE',
  outline: '#938EA1',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  onPrimary: '#1C0062',
  success: '#28C76F',
  warning: '#FF9F43',
  cyan: '#00F2EA',
  tiktokRed: '#FE2C55',
  youtube: '#FF0000',
  igStart: '#F58529',
  igMid: '#DD2A7B',
  igEnd: '#8134AF',
  metaViolet: '#7C5CFF',
  metaPurple: '#B14CFF',
  danger: '#EA5455',
} as const;

const YOUTUBE_TOS_URL = 'https://www.youtube.com/t/terms';
const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy';

// U-04: what each connection lets ClipPipeline access, and why — shown before OAuth starts.
const RATIONALE: Record<ConnectProvider, string[]> = {
  youtube: [
    'Upload the videos you choose to your YouTube channel as Shorts.',
    'Read basic channel info (name, avatar, subscriber count) and view/like/comment counts for videos posted through ClipPipeline, to show your analytics.',
    'We never delete or edit your existing videos. You can revoke access any time here or in your Google Account settings.',
  ],
  meta: [
    'Publish Reels to the Facebook Page and linked Instagram Business/Creator account you select.',
    'Read Page / account names, follower counts and insights for posts made through ClipPipeline, to show your analytics.',
    'We never post anything without your explicit confirmation. You can disconnect any time.',
  ],
  tiktok: [
    'Read your TikTok profile (nickname, avatar) and posting settings so the post form can show your options.',
    'Upload the videos you choose to your TikTok account, with the privacy and interaction settings you pick each time.',
    'Read view/like/comment/share counts for videos posted through ClipPipeline. You can disconnect any time.',
  ],
};

type BtnState = 'idle' | 'authenticating' | 'connected';
type RowState = 'connected' | 'needs_reauth' | 'error' | 'not_connected';
type Notice = { tone: 'ok' | 'error'; text: string } | null;

const PROVIDERS: {
  provider: ConnectProvider;
  name: string;
  platforms: Platform[];
  tag: string;
  blurb: string;
  accent: string;
}[] = [
  { provider: 'youtube', name: 'YouTube', platforms: ['youtube'], tag: 'GOOGLE • SHORTS', blurb: 'Publish vertical clips as YouTube Shorts.', accent: C.youtube },
  {
    provider: 'meta',
    name: 'Meta',
    platforms: ['facebook', 'instagram'],
    tag: 'FACEBOOK PAGE + INSTAGRAM',
    blurb: 'Connect a Facebook Page with a linked Instagram Business/Creator account to publish Reels.',
    accent: C.igMid,
  },
  { provider: 'tiktok', name: 'TikTok', platforms: ['tiktok'], tag: 'TIKTOK', blurb: 'Publish directly to your TikTok profile.', accent: C.cyan },
];

const ROW_NAME: Record<Platform, string> = { youtube: 'YouTube', facebook: 'Facebook Page', instagram: 'Instagram', tiktok: 'TikTok' };
const ROW_COLOR: Record<Platform, string> = { youtube: C.youtube, facebook: '#1877F2', instagram: C.igMid, tiktok: C.cyan };
const PROVIDER_NAME: Record<string, string> = { youtube: 'YouTube', meta: 'Meta', tiktok: 'TikTok' };
const REDIRECT = 'clippipelinemobile://connect';

function rowState(a: SocialAccount | undefined): RowState {
  if (!a) return 'not_connected';
  return a.status === 'active' ? 'connected' : a.status === 'error' ? 'error' : 'needs_reauth';
}

type ConnectResult = { provider?: string; status?: string; message?: string };

/** Reads provider/status/message from clippipelinemobile://connect?... */
function parseConnectUrl(url: string): ConnectResult {
  try {
    const q = Linking.parse(url).queryParams ?? {};
    const pick = (k: string) => {
      const v = q[k];
      return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;
    };
    return { provider: pick('provider'), status: pick('status'), message: pick('message') };
  } catch {
    return {};
  }
}

function resultNotice(r: ConnectResult): Notice {
  const name = PROVIDER_NAME[r.provider ?? ''] ?? 'Account';
  if (r.status === 'ok') return { tone: 'ok', text: `${name} connected.` };
  if (r.status === 'error') {
    let msg = r.message;
    try {
      msg = msg ? decodeURIComponent(msg.replace(/\+/g, ' ')) : msg;
    } catch {
      // keep raw
    }
    return { tone: 'error', text: msg || `${name} connection failed.` };
  }
  return null;
}

export default function ConnectScreen() {
  const guest = useIsGuest();
  const accountsQ = useSocialAccounts();
  const startM = useConnectStart();
  const deleteM = useDeleteAccount();
  const { refreshing, onRefresh } = useRefresh([accountsQ]);
  const [pending, setPending] = useState<ConnectProvider | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [rationale, setRationale] = useState<ConnectProvider | null>(null);
  const params = useLocalSearchParams<{ provider?: string; status?: string; message?: string; reauth?: string }>();
  const handledLink = useRef<string | null>(null);
  const refetchAccounts = accountsQ.refetch;
  const flags = useFlags();
  const prefs = useMe().data?.preferences;
  const openUrl = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => undefined);
  const pipelineRules = [
    {
      icon: 'cloud-sync',
      color: C.success,
      label: 'Auto-sync analytics',
      value: prefs ? (prefs.auto_sync ? 'On' : 'Off') : '—',
      valueColor: prefs?.auto_sync ? C.success : C.muted,
    },
    {
      icon: 'call-split',
      color: C.primary,
      label: 'Default platforms',
      value: prefs?.default_platforms?.length ? prefs.default_platforms.map((p) => ROW_NAME[p]).join(', ') : 'All connected',
      valueColor: C.text,
    },
    {
      icon: 'tag',
      color: C.primary,
      label: 'Default hashtags',
      value: prefs?.default_hashtags?.length ? prefs.default_hashtags.map((h) => `#${h}`).join(' ') : 'None',
      valueColor: C.text,
    },
    { icon: 'lock', color: C.warning, label: 'Credential protocol', value: 'OAuth 2.0, encrypted at rest', valueColor: C.muted },
  ] as const;

  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const acct = (p: Platform) => accounts.find((a) => a.platform === p);
  const loading = accountsQ.isLoading;
  const linkedCount = PROVIDERS.filter((pv) => pv.platforms.some((p) => rowState(acct(p)) === 'connected')).length;
  const reauthCount = accounts.filter((a) => a.status !== 'active').length;

  // P9: "Re-authorize" from a failed distribution / notification opens this provider's flow.
  const reauthParam: ConnectProvider | null =
    params.reauth === 'youtube' || params.reauth === 'meta' || params.reauth === 'tiktok' ? params.reauth : null;
  const sheetProvider = rationale ?? (guest ? null : reauthParam);
  const closeRationale = () => {
    setRationale(null);
    if (params.reauth) router.setParams({ reauth: undefined });
  };

  // The OAuth redirect can also arrive as a deep link: Expo Router opens /connect?provider=&status=&message=.
  useEffect(() => {
    if (!params.status) return;
    const key = `${params.provider}|${params.status}|${params.message ?? ''}`;
    if (handledLink.current === key) return;
    handledLink.current = key;
    setNotice(resultNotice({ provider: params.provider, status: params.status, message: params.message }));
    setPending(null);
    void refetchAccounts();
    router.setParams({ provider: undefined, status: undefined, message: undefined });
  }, [params.provider, params.status, params.message, refetchAccounts]);

  /** Shows the U-04 rationale first; OAuth starts from the sheet's Continue button. */
  function askConnect(provider: ConnectProvider) {
    if (pending) return;
    if (!requireAccount('Sign in to connect your own YouTube, Meta and TikTok accounts.')) return;
    setRationale(provider);
  }

  async function connect(provider: ConnectProvider) {
    if (pending) return;
    if (guest) {
      requireAccount('Sign in to connect your own YouTube, Meta and TikTok accounts.');
      return;
    }
    setNotice(null);
    setPending(provider);
    try {
      const { auth_url } = await startM.mutateAsync(provider);
      const result = await WebBrowser.openAuthSessionAsync(auth_url, REDIRECT);
      if (result.type === 'success' && result.url) {
        handledLink.current = null;
        setNotice(resultNotice(parseConnectUrl(result.url)));
      }
      // Cancelled / dismissed (or the link arrived via Linking): always re-read the real status.
      await refetchAccounts();
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e) });
    } finally {
      setPending(null);
    }
  }

  function disconnect(a: SocialAccount) {
    if (guest || deleteM.isPending) return;
    const meta = a.connect_provider === 'meta';
    const name = meta ? 'Meta' : ROW_NAME[a.platform];
    const revoke = 'ClipPipeline revokes and deletes its access tokens and stops publishing and syncing. Posts already on the platform stay there.';
    Alert.alert(
      `Disconnect ${name}?`,
      meta ? `Facebook and Instagram share one Meta login, so both will be disconnected. ${revoke}` : revoke,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () =>
            deleteM.mutate(a.id, {
              onSuccess: () => setNotice({ tone: 'ok', text: `${name} disconnected.` }),
              onError: (e) => setNotice({ tone: 'error', text: errorText(e) }),
            }),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      {/* Top app bar */}
      <View style={s.topBar}>
        <View style={s.brandRow}>
          <View style={s.brandTile}>
            <MaterialIcons name="videocam" size={20} color={C.text} />
          </View>
          <Text style={s.brandTitle}>Connect</Text>
        </View>
        <View style={s.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={openProfile} style={s.avatar}>
            <MaterialIcons name="person" size={18} color={C.onPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primaryContainer]} />}
      >
        {/* Heading */}
        <View style={s.heading}>
          <Text style={s.title}>Social Channels</Text>
          <Text style={s.subtitle}>Connect YouTube, Meta (Facebook + Instagram) and TikTok, then publish one upload everywhere.</Text>
        </View>

        {/* Live status pill */}
        <View style={s.syncPill}>
          <View style={s.syncLeft}>
            <PulseDot color={reauthCount ? C.warning : linkedCount ? C.success : C.muted} />
            <Text style={s.syncCount} numberOfLines={1}>
              {loading ? '– of 3' : `${linkedCount} of 3`} Connected
            </Text>
            {reauthCount ? (
              <>
                <Text style={s.syncSep}>•</Text>
                <Text style={[s.syncSub, { color: C.warning }]} numberOfLines={1}>
                  {reauthCount} need{reauthCount === 1 ? 's' : ''} re-auth
                </Text>
              </>
            ) : null}
          </View>
          {guest ? (
            <View style={s.velocity}>
              <MaterialIcons name="visibility" size={16} color={C.primary} />
              <Text style={s.velocityText}>Preview</Text>
            </View>
          ) : null}
        </View>

        {notice ? (
          <InlineMessage
            tone={notice.tone === 'error' ? 'danger' : 'muted'}
            icon={notice.tone === 'error' ? 'error-outline' : 'check-circle'}
            text={notice.text}
          />
        ) : null}
        {accountsQ.isError && !accountsQ.data ? <RetryMessage text="Couldn't load your accounts — tap to retry" onRetry={() => void accountsQ.refetch()} /> : null}
        {loading ? <Skeleton height={14} width="60%" /> : null}
        {!loading && !accountsQ.isError && accounts.length === 0 ? (
          <InlineMessage icon="link-off" text="No accounts linked yet. Connect a channel to start publishing." />
        ) : null}

        <View style={s.stack}>
          {PROVIDERS.map((pv) => {
            const rows = pv.platforms.map((p) => ({ platform: p, account: acct(p), state: rowState(acct(p)) }));
            const anyRow = rows.some((r) => r.account);
            const allOn = rows.every((r) => r.state === 'connected');
            const needsAuth = rows.some((r) => r.state === 'needs_reauth');
            const hasError = rows.some((r) => r.state === 'error');
            const busy = pending === pv.provider;
            const first = rows.find((r) => r.account)?.account;
            return (
              <View key={pv.provider} style={[s.card, s.cardFlat, { borderColor: `${pv.accent}40` }]}>
                <RowWrap>
                  <Tag icon="call-split" label={pv.tag} color={C.muted} bg={C.containerHigh} />
                  <StatusPill
                    label={allOn ? 'Connected' : hasError ? 'Error' : needsAuth ? 'Needs re-auth' : 'Not connected'}
                    color={allOn ? C.success : hasError ? C.danger : needsAuth ? C.warning : C.muted}
                  />
                </RowWrap>

                <View style={s.identity}>
                  {pv.provider === 'meta' ? (
                    <LinearGradient
                      colors={[C.igStart, C.igMid, C.igEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[s.platformTile, s.tileGradient]}
                    >
                      <FontAwesome5 name="facebook" size={22} color={C.text} />
                    </LinearGradient>
                  ) : (
                    <View style={[s.platformTile, { borderColor: `${pv.accent}66` }]}>
                      <FontAwesome5 name={pv.provider} size={22} color={pv.accent} />
                    </View>
                  )}
                  <View style={s.identityCopy}>
                    <Text style={s.platformName}>{pv.name}</Text>
                    <Text style={s.meta}>{pv.blurb}</Text>
                    {pv.provider === 'youtube' ? (
                      <Text style={s.meta}>
                        By connecting you agree to the{' '}
                        <Text accessibilityRole="link" style={s.linkText} onPress={() => openUrl(YOUTUBE_TOS_URL)}>
                          YouTube Terms of Service
                        </Text>{' '}
                        and{' '}
                        <Text accessibilityRole="link" style={s.linkText} onPress={() => openUrl(GOOGLE_PRIVACY_URL)}>
                          Google Privacy Policy
                        </Text>
                        .
                      </Text>
                    ) : null}
                  </View>
                </View>

                {rows.map(({ platform, account, state }) => (
                  <View key={platform} style={s.inset}>
                    <FontAwesome5 name={platform} size={16} color={ROW_COLOR[platform]} />
                    <View style={s.insetCopy}>
                      <Text style={s.insetTitle} numberOfLines={1}>
                        {ROW_NAME[platform]}
                        {account && (account.handle || account.display_name) ? ` • ${account.handle ?? account.display_name}` : ''}
                      </Text>
                      <Text style={[s.insetSub, state === 'needs_reauth' && { color: C.warning }, state === 'error' && { color: C.danger }]} numberOfLines={3}>
                        {state === 'connected'
                          ? `${formatCount(account?.follower_count ?? 0)} followers${account?.last_synced_at ? ` • synced ${formatDate(account.last_synced_at)}` : ''}`
                          : state === 'needs_reauth'
                            ? account?.error || 'Authorization expired — reconnect to keep publishing.'
                            : state === 'error'
                              ? account?.error || 'This account has an error — reconnect to fix it.'
                              : 'Not connected'}
                      </Text>
                    </View>
                    <StatusPill
                      label={state === 'connected' ? 'Active' : state === 'needs_reauth' ? 'Re-auth' : state === 'error' ? 'Error' : 'Off'}
                      color={state === 'connected' ? C.success : state === 'needs_reauth' ? C.warning : state === 'error' ? C.danger : C.muted}
                    />
                  </View>
                ))}

                {loading ? null : allOn ? (
                  <View style={s.bannerRow}>
                    <AnimatedPressable accessibilityRole="button" style={s.linkBtn} onPress={() => askConnect(pv.provider)} disabled={busy}>
                      <Text style={s.linkText}>{busy ? 'Opening…' : 'Reconnect'}</Text>
                    </AnimatedPressable>
                    <View style={s.flexFill} />
                    {first && !guest ? (
                      <AnimatedPressable
                        accessibilityRole="button"
                        accessibilityLabel={`Disconnect ${pv.name}`}
                        style={s.linkBtn}
                        disabled={deleteM.isPending}
                        onPress={() => disconnect(first)}
                      >
                        <Text style={[s.linkText, { color: C.danger }]}>Disconnect</Text>
                      </AnimatedPressable>
                    ) : null}
                  </View>
                ) : (
                  <>
                    <ConnectButton
                      state={busy ? 'authenticating' : 'idle'}
                      onPress={() => askConnect(pv.provider)}
                      label={anyRow ? `Reconnect ${pv.name}` : `Connect ${pv.name}`}
                    />
                    {first && !guest ? (
                      <AnimatedPressable accessibilityRole="button" style={[s.linkBtn, s.center]} disabled={deleteM.isPending} onPress={() => disconnect(first)}>
                        <Text style={[s.linkText, { color: C.danger }]}>Disconnect</Text>
                      </AnimatedPressable>
                    ) : null}
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* Pipeline engine rules */}
        <View style={s.rules}>
          <View style={s.rulesHead}>
            <View style={s.rulesTitleRow}>
              <View style={s.rulesIcon}>
                <MaterialIcons name="tune" size={17} color={C.primary} />
              </View>
              <Text style={s.rulesTitle}>Pipeline Engine Rules</Text>
            </View>
            <Text accessibilityRole="button" style={s.rulesBadge} onPress={openProfile}>
              Defaults
            </Text>
          </View>
          {pipelineRules.map((rule) => (
            <View style={s.ruleRow} key={rule.label}>
              <View style={s.ruleLeft}>
                <MaterialIcons name={rule.icon} size={16} color={rule.color} />
                <Text style={s.ruleLabel}>{rule.label}</Text>
              </View>
              <Text style={[s.ruleValue, { color: rule.valueColor }]}>{rule.value}</Text>
            </View>
          ))}
        </View>

        {/* U-01 */}
        <Text style={s.meta}>
          <Text accessibilityRole="link" style={s.linkText} onPress={() => openUrl(flags.privacy_url)}>
            Privacy Policy
          </Text>
          {'  •  '}
          <Text accessibilityRole="link" style={s.linkText} onPress={() => openUrl(flags.terms_url)}>
            Terms of Service
          </Text>
        </Text>
      </ScrollView>

      {/* U-04 — rationale before OAuth */}
      <Sheet
        visible={sheetProvider !== null}
        onClose={closeRationale}
        title={sheetProvider ? `Connect ${PROVIDER_NAME[sheetProvider]}` : ''}
        subtitle="What ClipPipeline can access, and why"
      >
        {(sheetProvider ? RATIONALE[sheetProvider] : []).map((line) => (
          <SheetText key={line}>• {line}</SheetText>
        ))}
        {sheetProvider === 'youtube' ? (
          <SheetText>
            ClipPipeline uses YouTube API Services. By connecting you agree to the{' '}
            <SheetLink label="YouTube Terms of Service" onPress={() => openUrl(YOUTUBE_TOS_URL)} /> and the{' '}
            <SheetLink label="Google Privacy Policy" onPress={() => openUrl(GOOGLE_PRIVACY_URL)} />.
          </SheetText>
        ) : null}
        <SheetText>
          See our <SheetLink label="Privacy Policy" onPress={() => openUrl(flags.privacy_url)} /> for how we store and delete your data.
        </SheetText>
        <SheetButton
          tone="primary"
          icon="add-link"
          label="Continue"
          onPress={() => {
            const p = sheetProvider;
            closeRationale();
            // Let the sheet finish dismissing before the auth browser is presented (iOS).
            if (p) setTimeout(() => void connect(p), 350);
          }}
        />
        <SheetButton label="Not now" onPress={closeRationale} />
      </Sheet>
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */

// Live indicator: a solid dot with an expanding, fading ping ring.
function PulseDot({ color, size = 10 }: { color: string; size?: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
  }, [t]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.75 * (1 - t.value),
    transform: [{ scale: 1 + t.value * 1.8 }],
  }));

  return (
    <View style={[s.pulseBox, { width: size, height: size }]}>
      <Animated.View style={[s.pulseRing, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ringStyle]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// Connect button: primary gradient with a breathing glow. Turns into a status chip once connected.
function ConnectButton({ state, onPress, label, handle }: { state: BtnState; onPress: () => void; label: string; handle?: string }) {
  const glow = useSharedValue(0.35);

  useEffect(() => {
    if (state !== 'idle') return;
    glow.value = withRepeat(withTiming(0.75, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [glow, state]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  if (state === 'connected') {
    return (
      <View style={[s.connectBtn, s.connectedBtn]}>
        <MaterialIcons name="done" size={18} color={C.success} />
        <Text style={[s.connectText, { color: C.success }]}>{handle ? `Connected ${handle}` : `${label} connected`}</Text>
      </View>
    );
  }

  const busy = state === 'authenticating';

  return (
    <View style={s.connectWrap}>
      {state === 'idle' ? <Animated.View style={[s.connectGlow, glowStyle]} /> : null}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`Connect ${label}`}
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        onPress={onPress}
        style={s.connectBtn}
      >
        <LinearGradient
          colors={[C.metaViolet, C.metaPurple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {busy ? (
          <>
            <ActivityIndicator size="small" color={C.text} />
            <Text style={s.connectText}>Authenticating...</Text>
          </>
        ) : (
          <>
            <MaterialIcons name="add-link" size={20} color={C.text} />
            <Text style={s.connectText}>{`+ ${label}`}</Text>
          </>
        )}
      </AnimatedPressable>
    </View>
  );
}

function RowWrap({ children }: { children: React.ReactNode }) {
  return <View style={s.rowWrap}>{children}</View>;
}

function Tag({ icon, label, color, bg }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; color: string; bg: string }) {
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <MaterialIcons name={icon} size={13} color={color} />
      <Text style={[s.tagText, { color }]}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.statusPill, { backgroundColor: `${color}26` }]}>
      <View style={[s.statusDot, { backgroundColor: color }]} />
      <Text style={[s.statusText, { color }]}>{label}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 20 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  flexFill: { flex: 1 },
  center: { alignSelf: 'center' },

  topBar: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: `${C.surface}E6` },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primaryContainer,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  brandTitle: { color: C.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

  heading: { gap: 4 },
  title: { color: C.text, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.36 },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 22 },

  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${C.containerHigh}E6`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  syncCount: { color: C.text, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  syncSep: { color: C.muted, fontSize: 13 },
  syncSub: { color: C.muted, fontSize: 13, flexShrink: 1 },
  velocity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  velocityText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  pulseBox: { alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute' },

  stack: { gap: 16 },
  card: {
    backgroundColor: C.raised,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardFlat: { backgroundColor: C.surface, elevation: 2 },
  cardGlow: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: `${C.cyan}1A`,
  },
  topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },

  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  unlinkedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.containerHighest,
  },
  unlinkedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.outline },
  unlinkedText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  menuBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.container, alignItems: 'center', justifyContent: 'center' },

  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingTop: 4 },
  platformTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDark: { borderColor: `${C.youtube}55` },
  tileGradient: { borderWidth: 0 },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  platformName: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.18 },
  handle: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  channelLine: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  handleMuted: { color: C.muted, fontSize: 13, fontWeight: '500' },
  igSub: { color: C.muted, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  meta: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '500' },

  inset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.container,
    borderRadius: 12,
    padding: 12,
  },
  insetCopy: { flex: 1, minWidth: 0 },
  insetTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  insetSub: { color: C.muted, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { color: C.text, fontSize: 12, fontWeight: '600' },
  linkBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  linkText: { color: C.primary, fontSize: 12, fontWeight: '600' },

  banner: { backgroundColor: C.containerLow, borderRadius: 12, padding: 12, gap: 10 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerText: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '500' },

  connectWrap: { position: 'relative' },
  connectGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    backgroundColor: C.metaViolet,
  },
  connectBtn: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectedBtn: { backgroundColor: `${C.success}33` },
  connectText: { color: C.text, fontSize: 14, fontWeight: '600' },

  rules: { backgroundColor: C.containerLow, borderRadius: 20, padding: 16, gap: 12 },
  rulesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rulesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rulesIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${C.primaryContainer}33`, alignItems: 'center', justifyContent: 'center' },
  rulesTitle: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  rulesBadge: { color: C.primary, fontSize: 12, fontWeight: '600' },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.container,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  ruleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  ruleLabel: { color: C.muted, fontSize: 13, lineHeight: 18 },
  ruleValue: { fontSize: 12, fontWeight: '600' },

  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 68,
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: `${C.surface}E6`,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  tabIndicator: { position: 'absolute', bottom: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: C.primaryContainer },
});
