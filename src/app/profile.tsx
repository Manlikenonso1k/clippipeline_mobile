import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { BottomTabInset } from '@/constants/theme';
import { useMe, useOverview, useSocialAccounts } from '@/api/hooks';
import { AnimatedPressable, BounceIcon, InlineMessage, Skeleton } from '@/components/ui-kit';
import { formatCount } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

// Kinetic Obsidian tokens (see "profile step 9"/DESIGN.md)
const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  container: '#1F1F23',
  containerLow: '#1B1B1F',
  containerHigh: '#2A292E',
  border: '#2A2A36',
  text: '#FFFFFF',
  muted: '#A1A1AE',
  primary: '#CABEFF',
  violet: '#7C5CFF',
  violetEnd: '#B14CFF',
  success: '#28C76F',
  warning: '#FF9F43',
  danger: '#EA5455',
  cyan: '#00F2EA',
  youtube: '#FF0000',
  instagram: '#DD2A7B',
  tertiary: '#FFB780',
} as const;

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const TABS = [
  ['Home', 'dashboard', '/dashboard'],
  ['Posts', 'movie', '/posts'],
  ['Connect', 'sync-alt', '/connect'],
  ['Insights', 'monitor', '/insights'],
  ['Profile', 'account-circle', '/profile'],
] as const;

const CLIP_LIMIT = 100; // plan allowance shown in the design (Pro tier); no plan endpoint exists yet.

const TIERS = [
  { name: 'Free', price: '$0/mo', tag: 'Starter', desc: '5 clips/mo • 720p transcode • ClipPipeline watermark', current: false },
  {
    name: 'Pro Tier',
    price: '$29/mo',
    tag: 'Your Plan',
    desc: '100 clips/mo • 1080p 60fps • Zero watermark • 3-platform concurrent sync • Priority render queue',
    current: true,
  },
  {
    name: 'Agency',
    price: '$79/mo',
    tag: 'Upgrade',
    desc: 'Unlimited clips • Native 4K ingest • Instant transcode engine • Multi-seat team workspace • Custom webhooks',
    current: false,
  },
] as const;

export default function ProfileScreen() {
  const [plansOpen, setPlansOpen] = useState(false);
  const [prefs, setPrefs] = useState({ autoSync: true, watermark: true, push: true });

  const meQ = useMe();
  const overviewQ = useOverview('30d');
  const accountsQ = useSocialAccounts();
  const user = meQ.data?.user;
  const ov = overviewQ.data;
  const accounts = accountsQ.data ?? [];
  const connected = accounts.filter((a) => a.connected);
  const has = (p: 'tiktok' | 'youtube' | 'instagram') => connected.some((a) => a.provider === p);
  const connectedCount = ov?.connected_accounts ?? connected.length;
  const name = user?.name?.trim() || (meQ.isLoading ? '' : 'Guest');
  const initials =
    (user?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'G';
  const handleSrc = accounts.find((a) => a.handle)?.handle ?? null;
  const handle = handleSrc ? `@${handleSrc.replace(/^@/, '')}` : null;
  const used = ov?.posts_published ?? 0;
  const usedPct = Math.min(100, Math.round((used / CLIP_LIMIT) * 100));
  const statsLoading = overviewQ.isLoading;
  const stats = [
    { label: 'Syndicated', value: formatCount(used) },
    { label: 'Total Views', value: formatCount(ov?.total_views ?? 0), accent: true },
    { label: 'Platforms', value: String(connectedCount), sync: true },
  ] as const;
  const accountNames = connected.length
    ? connected.map((a) => (a.provider === 'tiktok' ? 'TikTok' : a.provider === 'youtube' ? 'YouTube Shorts' : 'Instagram Reels')).join(', ')
    : 'No accounts linked yet';

  // Avatar glow pulse, live-dot ping, meter fill, plan chevron rotation.
  const glow = useSharedValue(0.4);
  const ping = useSharedValue(0);
  const meter = useSharedValue(0);
  const chevron = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(withTiming(0.9, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
    ping.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    }, [glow, ping]);

  useEffect(() => {
    meter.value = withDelay(250, withTiming(usedPct, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [usedPct, meter]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const pingStyle = useAnimatedStyle(() => ({ opacity: 0.75 * (1 - ping.value), transform: [{ scale: 1 + ping.value * 2 }] }));
  const meterStyle = useAnimatedStyle(() => ({ width: `${meter.value}%` }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevron.value}deg` }] }));

  function togglePlans() {
    const next = !plansOpen;
    setPlansOpen(next);
    chevron.value = withTiming(next ? 180 : 0, { duration: 300, easing: Easing.inOut(Easing.ease) });
  }

  async function signOut() {
    try {
      await useAuthStore.getState().clear();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      {/* Top bar */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [s.backBtn, pressed && s.pressedSoft]}
          >
            <MaterialIcons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <View style={s.logo}>
            <MaterialIcons name="video-library" size={18} color={C.text} />
          </View>
          <Text style={s.headerTitle}>Profile</Text>
        </View>
        <Pressable
          accessibilityLabel="Notifications"
          accessibilityRole="button"
          style={({ pressed }) => [s.backBtn, pressed && s.pressedSoft]}
        >
          <MaterialIcons name="notifications" size={22} color={C.muted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.page, { paddingBottom: Math.max(BottomTabInset, 64) + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity hero */}
        <View style={s.hero}>
          <View style={s.heroGlowTop} />
          <View style={s.heroGlowBottom} />
          <View style={s.heroInner}>
            <View style={s.avatarWrap}>
              <Animated.View style={[s.avatarHalo, glowStyle]} />
              <LinearGradient
                colors={[C.violet, C.violetEnd, C.cyan]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.avatarRing}
              >
                <View style={s.avatarInner}>
                  <Text style={s.avatarInitials}>{initials}</Text>
                </View>
              </LinearGradient>
              <View style={s.liveBadge}>
                <View style={s.liveDotWrap}>
                  <Animated.View style={[s.livePing, pingStyle]} />
                  <View style={s.liveDot} />
                </View>
              </View>
            </View>

            <View style={s.nameRow}>
              {meQ.isLoading ? <Skeleton width={140} height={26} radius={6} /> : <Text style={s.name}>{name}</Text>}
              {user ? <MaterialIcons name="verified" size={18} color={C.primary} /> : null}
            </View>
            {handle ? <Text style={s.handle}>{handle}</Text> : null}
            {user?.email ? <Text style={s.email}>{user.email}</Text> : null}
            {meQ.isError && !user ? (
              <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load data" style={s.heroMsg} />
            ) : null}

            <View style={s.planPill}>
              <MaterialIcons name="workspace-premium" size={14} color={C.tertiary} />
              <Text style={s.planText}>Pro Tier Active</Text>
              <View style={s.planDot} />
            </View>

            <View style={s.statsStrip}>
              {stats.map((stat) => (
                <View key={stat.label} style={[s.stat, 'accent' in stat && s.statAccent]}>
                  <View style={s.statValueRow}>
                    {statsLoading ? (
                      <Skeleton width={36} height={18} radius={5} />
                    ) : (
                      <Text style={[s.statValue, 'accent' in stat && { color: C.primary }]}>{stat.value}</Text>
                    )}
                    {'sync' in stat ? <MaterialIcons name="sync" size={12} color={C.success} /> : null}
                  </View>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Subscription & usage */}
        <View style={s.card}>
          <View style={s.subHeader}>
            <View style={s.subTitleRow}>
              <View style={s.iconTileSm}>
                <MaterialIcons name="auto-awesome" size={18} color={C.primary} />
              </View>
              <View style={s.flex}>
                <Text style={s.cardTitle}>Subscription & Usage</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  Pro Plan ($29/mo) • Renews Nov 14, 2024
                </Text>
              </View>
            </View>
            <View style={s.activePill}>
              <Text style={s.activeText}>Active</Text>
            </View>
          </View>

          <View style={s.meterBlock}>
            <View style={s.meterLabels}>
              <View style={s.meterLabelLeft}>
                <MaterialIcons name="video-library" size={16} color={C.muted} />
                <Text style={s.meterLabel}>Monthly Clips Syndicated</Text>
              </View>
              <Text style={s.meterCount}>
                {used} <Text style={s.meterCountMuted}>/ {CLIP_LIMIT} clips</Text>
              </Text>
            </View>
            <View style={s.track}>
              <Animated.View style={[s.trackFill, meterStyle]}>
                <LinearGradient
                  colors={[C.violet, C.violetEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
            <View style={s.meterFoot}>
              <Text style={s.meterFootMuted}>Resets in 16 days</Text>
              <Text style={s.meterFootAccent}>{100 - usedPct}% remaining</Text>
            </View>
          </View>

          <View style={s.ingest}>
            <View style={s.ingestLeft}>
              <View style={s.iconTileSmSurface}>
                <MaterialIcons name="hd" size={18} color={C.muted} />
              </View>
              <View>
                <Text style={s.rowTitle}>Ingest & Transcode</Text>
                <Text style={s.rowSub}>1080p 60fps Ultra HD</Text>
              </View>
            </View>
            <View style={s.unlimitedBadge}>
              <Text style={s.unlimitedText}>Unlimited</Text>
            </View>
          </View>

          <View style={s.subActions}>
            <AnimatedPressable accessibilityRole="button" style={s.upgradeWrap}>
              <Animated.View style={[s.upgradeGlow, glowStyle]}>
                <LinearGradient
                  colors={[C.violet, C.violetEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <LinearGradient
                colors={[C.violet, C.violetEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.upgradeBtn}
              >
                <MaterialIcons name="bolt" size={18} color={C.text} />
                <Text style={s.upgradeText}>Upgrade to Agency ($79/mo)</Text>
              </LinearGradient>
            </AnimatedPressable>

            <AnimatedPressable accessibilityRole="button" onPress={togglePlans} style={s.compareBtn}>
              <MaterialIcons name="view-carousel" size={16} color={C.muted} />
              <Text style={s.compareText}>Compare All Plans & Features</Text>
              <Animated.View style={chevronStyle}>
                <MaterialIcons name="expand-more" size={18} color={C.muted} />
              </Animated.View>
            </AnimatedPressable>
          </View>
        </View>

        {plansOpen ? (
          <Animated.View entering={FadeInDown.duration(260)} style={s.card}>
            <Text style={s.cardTitle}>Bandwidth & Tier Matrix</Text>
            <Text style={s.cardSub}>Scale clip pipeline processing throughput</Text>
            <View style={s.tiers}>
              {TIERS.map((tier) => (
                <View key={tier.name} style={[s.tier, tier.current && s.tierCurrent, !tier.current && tier.name === 'Free' && s.tierMuted]}>
                  <View style={s.tierHead}>
                    <View style={s.tierNameRow}>
                      <Text style={s.tierName}>{tier.name}</Text>
                      <View style={s.tierPrice}>
                        <Text style={[s.tierPriceText, tier.name === 'Agency' && { color: C.tertiary }, tier.current && { color: C.primary }]}>
                          {tier.price}
                        </Text>
                      </View>
                    </View>
                    {tier.current ? (
                      <View style={s.yourPlan}>
                        <Text style={s.yourPlanText}>{tier.tag}</Text>
                      </View>
                    ) : tier.name === 'Agency' ? (
                      <Pressable style={({ pressed }) => [s.tierUpgrade, pressed && s.pressedSoft]}>
                        <Text style={s.tierUpgradeText}>Upgrade</Text>
                      </Pressable>
                    ) : (
                      <Text style={s.tierTag}>{tier.tag}</Text>
                    )}
                  </View>
                  <Text style={s.cardSub}>{tier.desc}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {/* Preferences & automation */}
        <Section label="Preferences & Automation">
          <Row
            icon="cloud-sync"
            title="Auto-Syndication Engine"
            subtitle="Publish instantly across channels upon transcode"
            right={<Toggle value={prefs.autoSync} onChange={(v) => setPrefs((p) => ({ ...p, autoSync: v }))} />}
          />
          <Divider />
          <Row
            icon="branding-watermark"
            title="Watermark Removal"
            subtitle="Strip TikTok / IG native branding stamps"
            right={<Toggle value={prefs.watermark} onChange={(v) => setPrefs((p) => ({ ...p, watermark: v }))} />}
          />
          <Divider />
          <Row
            icon="notifications-active"
            title="Push Notifications"
            subtitle="Alerts on successful syndication & queue errors"
            right={<Toggle value={prefs.push} onChange={(v) => setPrefs((p) => ({ ...p, push: v }))} />}
          />
          <Divider />
          <Row icon="tag" title="Default Hashtags & Captions" subtitle="Channel-specific keyword presets" chevron />
        </Section>

        {/* Integrations & data */}
        <Section label="Integrations & Data">
          <Row
            icon="hub"
            tint={C.muted}
            title="Connected Accounts"
            badge={accountsQ.isLoading ? undefined : String(connectedCount)}
            subtitle={accountsQ.isError && !accountsQ.data ? "Couldn't load data" : accountNames}
            onPress={() => router.push('/connect' as never)}
            right={
              <View style={s.platforms}>
                <PlatformBadge name="tiktok" color={has('tiktok') ? C.cyan : C.muted} />
                <PlatformBadge name="youtube" color={has('youtube') ? C.youtube : C.muted} />
                <PlatformBadge name="instagram" color={has('instagram') ? C.instagram : C.muted} />
                <MaterialIcons name="chevron-right" size={20} color={C.muted} />
              </View>
            }
          />
          <Divider />
          <Row icon="download" title="Download Analytics Data" subtitle="Export retention & syndication log (CSV)" chevron />
        </Section>

        {/* Support & legal */}
        <Section label="Support & Legal">
          <Row icon="forum" title="Creator Community & Help Center" subtitle="Tutorials, Discord access & 24/7 chat support" chevron />
          <Divider />
          <Row icon="gavel" tint={C.muted} title="Terms of Service" chevron />
          <Divider />
          <Row icon="policy" tint={C.muted} title="Privacy Policy" chevron />
        </Section>

        {/* Sign out */}
        <AnimatedPressable accessibilityRole="button" onPress={signOut} style={s.logout}>
          <MaterialIcons name="logout" size={20} color={C.danger} />
          <Text style={s.logoutText}>Log Out of Pipeline</Text>
        </AnimatedPressable>

        <View style={s.footer}>
          <Text style={s.footerText}>ClipPipeline Mobile v3.8.4 (Build 882)</Text>
          <Text style={s.footerText}>Encrypted Cloud Storage • SOC2 Certified</Text>
        </View>
      </ScrollView>

      {/* Bottom tab bar */}
      <View style={s.tabBar}>
        {TABS.map(([label, icon, path]) => {
          const active = label === 'Profile';
          return (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                // '/posts' is not a typed route in this build yet; cast keeps the spec'd target.
                if (!active) router.replace(path as Href);
              }}
              style={s.tab}
            >
              <BounceIcon active={active}>
                <MaterialIcons name={icon} size={24} color={active ? C.violet : C.muted} />
              </BounceIcon>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
              {active ? <View style={s.tabDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.group}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  badge,
  tint = C.primary,
  right,
  chevron,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  badge?: string;
  tint?: string;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && s.rowPressed]}
    >
      <View style={s.rowLeft}>
        <View style={s.iconTile}>
          <MaterialIcons name={icon} size={20} color={tint} />
        </View>
        <View style={s.flex}>
          <View style={s.rowTitleRow}>
            <Text style={s.rowTitle}>{title}</Text>
            {badge ? (
              <View style={s.countBadge}>
                <Text style={s.countText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ?? (chevron ? <MaterialIcons name="chevron-right" size={20} color={C.muted} /> : null)}
    </Pressable>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

function PlatformBadge({ name, color }: { name: 'tiktok' | 'youtube' | 'instagram'; color: string }) {
  return (
    <View style={s.platformBadge}>
      <FontAwesome5 name={name} size={11} color={color} />
    </View>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const knob = useSharedValue(value ? 20 : 0);

  useEffect(() => {
    knob.value = withTiming(value ? 20 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [value, knob]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knob.value }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={[s.toggle, value ? s.toggleOn : s.toggleOff]}
    >
      <Animated.View style={[s.knob, knobStyle]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  page: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },
  pressedSoft: { opacity: 0.7 },
  heroMsg: { marginTop: 10, alignSelf: 'stretch' },

  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },

  // Identity hero
  hero: { borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  heroGlowTop: {
    position: 'absolute',
    top: -64,
    right: -64,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: '#947DFF26',
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -64,
    left: -64,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: '#8401D21A',
  },
  heroInner: { padding: 20, alignItems: 'center' },
  avatarWrap: { marginBottom: 12 },
  avatarHalo: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 48,
    backgroundColor: '#7C5CFF40',
  },
  avatarRing: { width: 80, height: 80, borderRadius: 40, padding: 3, shadowColor: C.violet, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  avatarInner: { flex: 1, borderRadius: 37, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: C.primary, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  liveBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  livePing: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: C.success },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.success,
    shadowColor: C.success,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: C.text, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.36 },
  handle: { color: C.primary, fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.14, marginTop: 2 },
  email: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },

  planPill: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.raised,
  },
  planText: { color: C.primary, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.24 },
  planDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.success },

  statsStrip: {
    marginTop: 20,
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    backgroundColor: C.raised,
    padding: 12,
  },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, borderRadius: 8 },
  statAccent: { backgroundColor: '#1F1F23A0' },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statValue: { color: C.text, fontSize: 16, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },

  // Cards
  card: { borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 20, gap: 16 },
  cardTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.18 },
  cardSub: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconTileSm: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  iconTileSmSurface: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  activePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: '#28C76F26' },
  activeText: { color: C.success, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.24 },

  meterBlock: { gap: 6 },
  meterLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabelLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meterLabel: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  meterCount: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meterCountMuted: { color: C.muted, fontWeight: '400' },
  track: { height: 8, borderRadius: 999, backgroundColor: C.raised, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 999, overflow: 'hidden' },
  meterFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  meterFootMuted: { color: C.muted, fontSize: 11, lineHeight: 14 },
  meterFootAccent: { color: C.primary, fontSize: 11, lineHeight: 14, fontWeight: '500' },

  ingest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    backgroundColor: C.raised,
    padding: 12,
  },
  ingestLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unlimitedBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#947DFF33' },
  unlimitedText: { color: C.primary, fontSize: 12, lineHeight: 16, fontWeight: '500' },

  subActions: { gap: 8 },
  upgradeWrap: { height: 48, borderRadius: 12, shadowColor: C.violet, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  upgradeGlow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 16, backgroundColor: '#7C5CFF33' },
  upgradeBtn: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  upgradeText: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  pressedUpgrade: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  compareBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: C.raised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  compareText: { color: C.muted, fontSize: 14, lineHeight: 18, fontWeight: '600' },

  tiers: { gap: 12 },
  tier: { borderRadius: 12, backgroundColor: C.raised, padding: 16, gap: 8, borderWidth: 1, borderColor: 'transparent' },
  tierCurrent: { borderColor: '#7C5CFF80', shadowColor: C.violet, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  tierMuted: { opacity: 0.8 },
  tierHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  tierPrice: { borderRadius: 4, backgroundColor: C.surface, paddingHorizontal: 6, paddingVertical: 2 },
  tierPriceText: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  yourPlan: { borderRadius: 999, backgroundColor: '#CABEFF33', paddingHorizontal: 8, paddingVertical: 2 },
  yourPlanText: { color: C.primary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  tierTag: { color: C.muted, fontSize: 13, lineHeight: 18 },
  tierUpgrade: { borderRadius: 8, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 4, minHeight: 28, justifyContent: 'center' },
  tierUpgradeText: { color: C.primary, fontSize: 12, lineHeight: 16, fontWeight: '600' },

  // Settings groups
  section: { gap: 8 },
  sectionLabel: { color: C.muted, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 8 },
  group: { borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12 },
  rowPressed: { backgroundColor: '#1E1E2866' },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  rowSub: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  countBadge: { borderRadius: 999, backgroundColor: C.raised, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: C.primary, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.raised, marginHorizontal: 16 },

  platforms: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platformBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.raised,
    borderWidth: 2,
    borderColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },

  toggle: { width: 48, height: 28, borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: C.violet },
  toggleOff: { backgroundColor: C.raised },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.text },

  logout: {
    minHeight: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#EA545520',
    borderWidth: 1,
    borderColor: '#EA545540',
  },
  pressedLogout: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  logoutText: { color: C.danger, fontSize: 14, lineHeight: 18, fontWeight: '600' },

  footer: { alignItems: 'center', gap: 4, paddingBottom: 16 },
  footerText: { color: '#A1A1AE99', fontSize: 13, lineHeight: 18, textAlign: 'center' },

  // Bottom tab bar
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabLabel: { color: C.muted, fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  tabLabelActive: { color: C.violet },
  tabDot: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: C.violet },
});
