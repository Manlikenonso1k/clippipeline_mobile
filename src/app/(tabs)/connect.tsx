import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { usePosts, useSocialAccounts } from '@/api/hooks';
import type { Platform } from '@/api/types';
import { AnimatedPressable, InlineMessage, Skeleton } from '@/components/ui-kit';
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
} as const;

const PIPELINE_RULES = [
  { icon: 'water-drop', color: C.success, label: 'Automatic Watermark Removal', value: 'Active', valueColor: C.success },
  { icon: 'hd', color: C.primary, label: 'Source Ingestion Bitrate', value: '1080p Ultra HD', valueColor: C.text },
  { icon: 'lock', color: C.warning, label: 'Credential Protocol', value: 'OAuth 2.0 Encrypted', valueColor: C.muted },
] as const;

type IgState = 'idle' | 'authenticating' | 'connected';

export default function ConnectScreen() {
  const accountsQ = useSocialAccounts();
  const postsQ = usePosts('all');
  const [autoFetch, setAutoFetch] = useState(true);
  const [pending, setPending] = useState<Platform | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const accounts = accountsQ.data ?? [];
  const acct = (p: Platform) => accounts.find((a) => a.provider === p);
  const isOn = (p: Platform) => !!acct(p)?.connected;
  const tt = acct('tiktok');
  const yt = acct('youtube');
  const ig = acct('instagram');
  const ttOn = isOn('tiktok');
  const ytOn = isOn('youtube');
  const igOn = isOn('instagram');
  const handleOf = (h: string | null | undefined) => (h ? `@${h.replace(/^@/, '')}` : '');
  const linkedCount = (['tiktok', 'youtube', 'instagram'] as Platform[]).filter(isOn).length;
  const clipCount = postsQ.data?.length ?? 0;
  const loading = accountsQ.isLoading;

  // OAuth for each platform happens server-side; here we only show a brief authenticating state and
  // then re-read the real connection status from the API.
  function connect(p: Platform) {
    if (pending) return;
    setPending(p);
    timer.current = setTimeout(() => {
      accountsQ.refetch().finally(() => setPending(null));
    }, 1200);
  }
  const stateFor = (p: Platform): IgState => (pending === p ? 'authenticating' : isOn(p) ? 'connected' : 'idle');

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      {/* Top app bar */}
      <View style={s.topBar}>
        <View style={s.brandRow}>
          <View style={s.brandTile}>
            <MaterialIcons name="videocam" size={20} color={C.text} />
          </View>
          <Text style={s.brandTitle}>Home</Text>
        </View>
        <View style={s.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={s.bellBtn}>
            <MaterialIcons name="notifications" size={22} color={C.muted} />
          </Pressable>
          <View style={s.avatar}>
            <MaterialIcons name="person" size={18} color={C.onPrimary} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        {/* Heading */}
        <View style={s.heading}>
          <Text style={s.title}>Social Channels</Text>
          <Text style={s.subtitle}>Connect TikTok to import clips, then connect YouTube & Instagram to auto-syndicate.</Text>
        </View>

        {/* Live sync status pill */}
        <View style={s.syncPill}>
          <View style={s.syncLeft}>
            <PulseDot color={C.success} />
            <Text style={s.syncCount} numberOfLines={1}>
              {loading ? '– of 3' : `${linkedCount} of 3`} Connected
            </Text>
            <Text style={s.syncSep}>•</Text>
            <Text style={s.syncSub} numberOfLines={1}>
              Auto-sync active
            </Text>
          </View>
          <View style={s.velocity}>
            <MaterialIcons name="bolt" size={16} color={C.primary} />
            <Text style={s.velocityText}>High Velocity</Text>
          </View>
        </View>

        {accountsQ.isError && !accountsQ.data ? (
          <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load data" />
        ) : null}
        {loading ? <Skeleton height={14} width="60%" /> : null}
        {!loading && !accountsQ.isError && accounts.length === 0 ? (
          <InlineMessage icon="link-off" text="No accounts linked yet. Connect TikTok to get started." />
        ) : null}

        <View style={s.stack}>
          {/* 1. TikTok: mandatory source */}
          <View style={[s.card, { borderColor: `${C.cyan}40` }]}>
            <View style={s.cardGlow} pointerEvents="none" />
            <LinearGradient
              colors={[C.cyan, C.tiktokRed, C.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.topAccent}
            />

            <RowWrap>
              <Tag icon="input" label="SOURCE ACCOUNT • REQUIRED" color={C.cyan} bg={`${C.cyan}26`} />
              <View style={s.rowEnd}>
                <StatusPill label={ttOn ? 'Connected' : 'Unlinked'} color={ttOn ? C.success : C.muted} />
                <MenuButton label="TikTok settings" />
              </View>
            </RowWrap>

            <View style={s.identity}>
              <View style={[s.platformTile, { borderColor: `${C.cyan}66` }]}>
                <FontAwesome5 name="tiktok" size={22} color={C.cyan} />
              </View>
              <View style={s.identityCopy}>
                <View style={s.nameRow}>
                  <Text style={s.platformName}>TikTok</Text>
                  <MaterialIcons name="verified" size={16} color={C.cyan} />
                </View>
                <Text style={s.handle}>{ttOn && tt?.handle ? handleOf(tt.handle) : 'Not connected'}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {ttOn ? `${formatCount(tt?.follower_count ?? 0)} followers • Clip Source (Auto-import)` : 'Required to import your master clips'}
                </Text>
              </View>
            </View>

            <View style={s.inset}>
              <MaterialIcons name="history" size={18} color={C.cyan} />
              <View style={s.insetCopy}>
                <Text style={s.insetTitle}>
                  {ttOn ? (tt?.expires_at ? `Token valid until ${formatDate(tt.expires_at)}` : 'Source active') : 'Waiting for connection'}
                </Text>
                <Text style={s.insetSub}>{clipCount} master {clipCount === 1 ? 'clip' : 'clips'} cataloged</Text>
              </View>
              <View style={s.toggleWrap}>
                <Text style={s.toggleLabel}>Auto-Fetch</Text>
                <Switch
                  value={autoFetch}
                  onValueChange={setAutoFetch}
                  trackColor={{ false: C.containerHighest, true: C.primaryContainer }}
                  thumbColor={C.text}
                  ios_backgroundColor={C.containerHighest}
                  accessibilityLabel="Auto-Fetch"
                />
              </View>
            </View>
            {!ttOn && !loading ? (
              <ConnectButton state={stateFor('tiktok')} onPress={() => connect('tiktok')} label="TikTok" />
            ) : null}
          </View>

          {/* 2. YouTube: connected target */}
          <View style={[s.card, s.cardFlat, { borderColor: `${C.youtube}40` }]}>
            <RowWrap>
              <Tag icon="call-split" label="TARGET DESTINATION" color={C.muted} bg={C.containerHigh} />
              <View style={s.rowEnd}>
                <StatusPill label={ytOn ? 'Connected' : 'Unlinked'} color={ytOn ? C.success : C.muted} />
                <MenuButton label="YouTube settings" />
              </View>
            </RowWrap>

            <View style={s.identity}>
              <View style={[s.platformTile, s.tileDark]}>
                <FontAwesome5 name="youtube" size={22} color={C.youtube} />
              </View>
              <View style={s.identityCopy}>
                <View style={s.nameRow}>
                  <Text style={s.platformName}>YouTube</Text>
                  <FontAwesome5 name="youtube" size={13} color={C.youtube} />
                </View>
                <Text style={s.channelLine} numberOfLines={1}>
                  {ytOn && yt?.handle ? handleOf(yt.handle) : 'Not connected'}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {ytOn ? `${formatCount(yt?.follower_count ?? 0)} subscribers • Publishes as Shorts` : 'Connect a channel to publish Shorts'}
                </Text>
              </View>
            </View>

            {ytOn ? (
              <View style={s.inset}>
                <MaterialIcons name="check-circle" size={18} color={C.success} />
                <View style={s.insetCopy}>
                  <Text style={s.insetTitle}>Syndication Active</Text>
                  <Text style={s.insetSub}>{yt?.expires_at ? `Token valid until ${formatDate(yt.expires_at)}` : 'Publishing as Shorts'}</Text>
                </View>
                <AnimatedPressable accessibilityRole="button" style={s.linkBtn} onPress={() => connect('youtube')}>
                  <Text style={s.linkText}>Re-auth</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <View style={s.banner}>
                <View style={s.bannerRow}>
                  <MaterialIcons name="info" size={16} color={C.warning} />
                  <Text style={s.bannerText}>Google authorization required</Text>
                </View>
                {!loading ? <ConnectButton state={stateFor('youtube')} onPress={() => connect('youtube')} label="YouTube" /> : null}
              </View>
            )}
          </View>

          {/* 3. Instagram: unlinked target */}
          <View style={[s.card, s.cardFlat, { borderColor: `${C.igMid}40` }]}>
            <RowWrap>
              <Tag icon="call-split" label="TARGET DESTINATION" color={C.muted} bg={C.containerHigh} />
              <View style={s.rowEnd}>
                <View style={s.unlinkedPill}>
                  <View style={s.unlinkedDot} />
                  <Text style={s.unlinkedText}>{igOn ? 'Connected' : 'Unlinked'}</Text>
                </View>
              </View>
            </RowWrap>

            <View style={s.identity}>
              <LinearGradient
                colors={[C.igStart, C.igMid, C.igEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.platformTile, s.tileGradient]}
              >
                <FontAwesome5 name="instagram" size={24} color={C.text} />
              </LinearGradient>
              <View style={s.identityCopy}>
                <Text style={s.platformName}>Instagram</Text>
                <Text style={s.igSub}>{igOn && ig?.handle ? handleOf(ig.handle) : 'Publishes as Instagram Reels'}</Text>
                <Text style={s.meta}>
                  {igOn
                    ? `${formatCount(ig?.follower_count ?? 0)} followers • Publishes as Reels`
                    : 'Connect Creator or Business account to enable 9:16 Reels cross-posting.'}
                </Text>
              </View>
            </View>

            <View style={s.banner}>
              <View style={s.bannerRow}>
                <MaterialIcons name={igOn ? 'check-circle' : 'info'} size={16} color={igOn ? C.success : C.warning} />
                <Text style={s.bannerText}>{igOn ? 'Reels syndication active' : 'Meta Graph API token authorization required'}</Text>
              </View>
              {!loading ? <ConnectButton state={stateFor('instagram')} onPress={() => connect('instagram')} label="Instagram" handle={igOn ? handleOf(ig?.handle) : ''} /> : null}
            </View>
          </View>
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
            <Text style={s.rulesBadge}>Defaults</Text>
          </View>
          {PIPELINE_RULES.map((rule) => (
            <View style={s.ruleRow} key={rule.label}>
              <View style={s.ruleLeft}>
                <MaterialIcons name={rule.icon} size={16} color={rule.color} />
                <Text style={s.ruleLabel}>{rule.label}</Text>
              </View>
              <Text style={[s.ruleValue, { color: rule.valueColor }]}>{rule.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

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
function ConnectButton({ state, onPress, label, handle }: { state: IgState; onPress: () => void; label: string; handle?: string }) {
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
            <Text style={s.connectText}>{`+ Connect ${label}`}</Text>
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

function MenuButton({ label }: { label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.menuBtn, pressed && s.pressed]}>
      <MaterialIcons name="more-vert" size={18} color={C.muted} />
    </Pressable>
  );
}

/* ---------- Styles ---------- */

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 20 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

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
