import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Linking, Platform as RNPlatform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { errorText } from '@/api/client';
import { WEB_BASE_URL } from '@/api/config';
import { queryClient, useDeleteMe, useFlags, useIsGuest, useMe, useOverview, useSocialAccounts, useUpdateMe, useUpdatePreferences } from '@/api/hooks';
import type { Period, Platform, PlanName } from '@/api/types';
import { PLATFORMS } from '@/api/types';
import { PLATFORM_LABEL } from '@/components/post-utils';
import { Sheet, SheetButton, SheetCheck, SheetInput, SheetLabel, SheetLink, SheetRow, SheetText } from '@/components/sheet';
import { AnimatedPressable, InlineMessage, RetryMessage, Skeleton } from '@/components/ui-kit';
import { exportAnalyticsCsv } from '@/lib/export';
import { formatCount, formatDate } from '@/lib/format';
import { requestNotificationPermissions, syncPushTokenToBackend, unregisterPushTokenFromBackend } from '@/lib/notifications';
import { signOut as endSession } from '@/lib/session';
import { useAuthStore } from '@/store/authStore';
import { openNotifications, requireAccount } from '@/store/uiStore';

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

const PLAN_LABEL: Record<PlanName, string> = { free: 'Free', pro: 'Pro', agency: 'Agency' };

// Plan matrix: names only + the real limit for the current plan (from GET /me). Prices live on the web billing page.
const TIERS: { key: PlanName; name: string; desc: string }[] = [
  { key: 'free', name: 'Free', desc: 'Try ClipPipeline with a small monthly clip allowance.' },
  { key: 'pro', name: 'Pro', desc: 'A larger monthly clip allowance for regular cross-posting.' },
  { key: 'agency', name: 'Agency', desc: 'No monthly clip limit.' },
];

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const APP_BUILD =
  RNPlatform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : RNPlatform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : undefined;

/** Days until the 1st of next month (clips_used counts the current calendar month). */
function daysToMonthEnd(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
}

const parseTags = (raw: string) => [...new Set(raw.split(/[\s,]+/).map((t) => t.replace(/^#+/, '').trim()).filter(Boolean))];

export default function ProfileScreen() {
  const [plansOpen, setPlansOpen] = useState(false);
  const [sheet, setSheet] = useState<'name' | 'defaults' | 'export' | 'delete' | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');
  const [platformsDraft, setPlatformsDraft] = useState<Platform[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const guest = useIsGuest();
  const flags = useFlags();
  const updateMe = useUpdateMe();
  const updatePrefs = useUpdatePreferences();
  const deleteMe = useDeleteMe();
  const meQ = useMe();
  const overviewQ = useOverview('30d');
  const accountsQ = useSocialAccounts();
  const user = meQ.data?.user;
  const ov = overviewQ.data;
  const accounts = accountsQ.data ?? [];
  const connected = accounts.filter((a) => a.status === 'active');
  const has = (p: Platform) => connected.some((a) => a.platform === p);
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
  const plan = meQ.data?.plan;
  const prefs = meQ.data?.preferences;
  const planLabel = plan ? PLAN_LABEL[plan.name] ?? plan.name : '—';
  const used = plan?.clips_used ?? 0;
  const limit = plan?.clips_limit ?? null;
  const usedPct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const billingUrl = plan?.billing_url || `${WEB_BASE_URL}/#pricing`;
  const statsLoading = overviewQ.isLoading;
  const stats = [
    { label: 'Syndicated · 30d', value: formatCount(ov?.posts_published ?? 0) },
    { label: 'Views · 30d', value: formatCount(ov?.totals.views ?? 0), accent: true },
    { label: 'Platforms', value: String(connectedCount), sync: true },
  ] as const;
  const accountNames = connected.length
    ? connected.map((a) => PLATFORM_LABEL[a.platform]).join(', ')
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

  const openUrl = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => undefined);
  const closeSheet = () => {
    setSheet(null);
    setSheetError(null);
    setConfirmText('');
  };

  async function signOut() {
    await endSession();
  }

  function setPref(patch: Parameters<typeof updatePrefs.mutate>[0]) {
    if (!requireAccount('Sign in to change your preferences.')) return;
    updatePrefs.mutate(patch, { onError: (e) => Alert.alert("Couldn't save", errorText(e)) });
  }

  // R5: push toggle = notifications_enabled preference + device-token register / unregister.
  async function setPush(on: boolean) {
    if (!requireAccount('Sign in to manage notifications.')) return;
    if (on) {
      if (!(await requestNotificationPermissions())) {
        Alert.alert('Notifications are off', 'Allow notifications for ClipPipeline in your device settings first.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => undefined) },
        ]);
        return;
      }
      void syncPushTokenToBackend();
    } else {
      void unregisterPushTokenFromBackend();
    }
    setPref({ notifications_enabled: on });
  }

  function openNameSheet() {
    if (!requireAccount('Sign in to edit your profile.')) return;
    setNameDraft(user?.name ?? '');
    setSheet('name');
  }

  function openDefaultsSheet() {
    if (!requireAccount('Sign in to set default hashtags and platforms.')) return;
    setTagsDraft((prefs?.default_hashtags ?? []).map((t) => `#${t}`).join(' '));
    setPlatformsDraft(prefs?.default_platforms ?? []);
    setSheet('defaults');
  }

  async function runExport(period: Period) {
    setExporting(true);
    setSheetError(null);
    try {
      await exportAnalyticsCsv(period);
      closeSheet();
    } catch (e) {
      setSheetError(errorText(e));
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setSheetError(null);
    // Unregister while our token is still valid — DELETE /me revokes it immediately.
    await unregisterPushTokenFromBackend();
    deleteMe.mutate(undefined, {
      onSuccess: async (res) => {
        closeSheet();
        await useAuthStore.getState().clear();
        queryClient.clear();
        router.replace('/login');
        Alert.alert(
          'Account deletion scheduled',
          `Your account and data will be fully deleted by ${formatDate(res?.completes_by ?? null)}. You have been signed out.`,
        );
      },
      onError: (e) => setSheetError(errorText(e)),
    });
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
          onPress={openNotifications}
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
              <RetryMessage onRetry={() => void meQ.refetch()} style={s.heroMsg} />
            ) : null}

            {!guest && plan ? (
              <View style={s.planPill}>
                <MaterialIcons name="workspace-premium" size={14} color={C.tertiary} />
                <Text style={s.planText}>{planLabel} Plan</Text>
                <View style={s.planDot} />
              </View>
            ) : null}

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

        {/* R1 — guest: sign-in CTA instead of plan / usage */}
        {guest ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>You&apos;re in Preview mode</Text>
            <Text style={s.cardSub}>The numbers on these screens are sample data. Sign in to connect your channels and see your own plan, usage and settings.</Text>
            <View style={s.subActions}>
              <AnimatedPressable accessibilityRole="button" style={s.upgradeWrap} onPress={() => router.push('/login')}>
                <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.upgradeBtn}>
                  <MaterialIcons name="login" size={18} color={C.text} />
                  <Text style={s.upgradeText}>Sign in</Text>
                </LinearGradient>
              </AnimatedPressable>
            </View>
          </View>
        ) : null}

        {/* Subscription & usage */}
        {!guest ? (
        <View style={s.card}>
          <View style={s.subHeader}>
            <View style={s.subTitleRow}>
              <View style={s.iconTileSm}>
                <MaterialIcons name="auto-awesome" size={18} color={C.primary} />
              </View>
              <View style={s.flex}>
                <Text style={s.cardTitle}>Subscription & Usage</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {plan ? `${planLabel} plan • ${plan.renews_at ? `Renews ${formatDate(plan.renews_at)}` : 'No renewal date'}` : meQ.isLoading ? 'Loading…' : '—'}
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
                {used} <Text style={s.meterCountMuted}>{limit === null ? 'clips • unlimited' : `/ ${limit} clips`}</Text>
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
              <Text style={s.meterFootMuted}>Resets in {daysToMonthEnd()} days</Text>
              <Text style={s.meterFootAccent}>{limit === null ? 'Unlimited' : `${100 - usedPct}% remaining`}</Text>
            </View>
          </View>

          <View style={s.ingest}>
            <View style={s.ingestLeft}>
              <View style={s.iconTileSmSurface}>
                <MaterialIcons name="cloud-sync" size={18} color={C.muted} />
              </View>
              <View>
                <Text style={s.rowTitle}>Analytics sync</Text>
                <Text style={s.rowSub}>
                  {meQ.data?.sync?.last_synced_at ? `Last synced ${formatDate(meQ.data.sync.last_synced_at)}` : 'Not synced yet'}
                </Text>
              </View>
            </View>
            <View style={s.unlimitedBadge}>
              <Text style={s.unlimitedText}>
                {meQ.data?.sync?.status === 'active' ? 'Active' : meQ.data?.sync?.status === 'attention' ? 'Attention' : 'Idle'}
              </Text>
            </View>
          </View>

          <View style={s.subActions}>
            <AnimatedPressable accessibilityRole="button" style={s.upgradeWrap} onPress={() => openUrl(billingUrl)}>
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
                <Text style={s.upgradeText}>{plan?.name === 'agency' ? 'Manage billing' : 'Upgrade plan'}</Text>
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
        ) : null}

        {plansOpen && !guest ? (
          <Animated.View entering={FadeInDown.duration(260)} style={s.card}>
            <Text style={s.cardTitle}>Bandwidth & Tier Matrix</Text>
            <Text style={s.cardSub}>Scale clip pipeline processing throughput</Text>
            <View style={s.tiers}>
              {TIERS.map((tier) => {
                const current = plan?.name === tier.key;
                return (
                <View key={tier.name} style={[s.tier, current && s.tierCurrent, !current && tier.key === 'free' && s.tierMuted]}>
                  <View style={s.tierHead}>
                    <View style={s.tierNameRow}>
                      <Text style={s.tierName}>{tier.name}</Text>
                      {current ? (
                        <View style={s.tierPrice}>
                          <Text style={[s.tierPriceText, { color: C.primary }]}>{limit === null ? 'Unlimited' : `${limit} clips/mo`}</Text>
                        </View>
                      ) : null}
                    </View>
                    {current ? (
                      <View style={s.yourPlan}>
                        <Text style={s.yourPlanText}>Your Plan</Text>
                      </View>
                    ) : (
                      <Pressable onPress={() => openUrl(billingUrl)} style={({ pressed }) => [s.tierUpgrade, pressed && s.pressedSoft]}>
                        <Text style={s.tierUpgradeText}>View</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={s.cardSub}>{tier.desc}</Text>
                </View>
                );
              })}
              <Text style={s.cardSub}>Prices and plan details are on the web billing page.</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Preferences & automation */}
        <Section label="Preferences & Automation">
          <Row
            icon="cloud-sync"
            title="Auto-Sync Analytics"
            subtitle="Refresh stats from your connected channels every few hours"
            right={<Toggle value={prefs?.auto_sync ?? true} onChange={(v) => setPref({ auto_sync: v })} />}
          />
          <Divider />
          <Row
            icon="notifications-active"
            title="Push Notifications"
            subtitle="Alerts when a post publishes or fails, and when an account needs re-auth"
            right={<Toggle value={prefs?.notifications_enabled ?? true} onChange={(v) => void setPush(v)} />}
          />
          <Divider />
          <Row
            icon="tag"
            title="Default Hashtags & Platforms"
            subtitle={
              prefs?.default_hashtags?.length
                ? prefs.default_hashtags.map((t) => `#${t}`).join(' ')
                : 'Pre-fill new posts with your usual hashtags and channels'
            }
            onPress={openDefaultsSheet}
            chevron
          />
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
          <Row
            icon="download"
            title="Download Analytics Data"
            subtitle="Per-post stats for every channel (CSV)"
            onPress={() => requireAccount('Sign in to export your analytics as CSV.') && setSheet('export')}
            chevron
          />
        </Section>

        {/* Account */}
        <Section label="Account">
          <Row icon="edit" title="Edit Profile" subtitle={user?.name ? `Name: ${user.name}` : 'Change your display name'} onPress={openNameSheet} chevron />
          <Divider />
          <Row
            icon="delete-forever"
            tint={C.danger}
            title="Delete Account"
            subtitle="Permanently delete your account and data"
            onPress={() => requireAccount('Sign in to manage your account.') && setSheet('delete')}
            chevron
          />
        </Section>

        {/* Support & legal */}
        <Section label="Support & Legal">
          <Row
            icon="forum"
            title="Help & Support"
            subtitle={`Email ${flags.support_email}`}
            onPress={() => Linking.openURL(`mailto:${flags.support_email}`).catch(() => undefined)}
            chevron
          />
          <Divider />
          <Row icon="gavel" tint={C.muted} title="Terms of Service" onPress={() => openUrl(flags.terms_url)} chevron />
          <Divider />
          <Row icon="policy" tint={C.muted} title="Privacy Policy" onPress={() => openUrl(flags.privacy_url)} chevron />
        </Section>

        {/* Sign out */}
        {!guest ? (
          <AnimatedPressable accessibilityRole="button" onPress={signOut} style={s.logout}>
            <MaterialIcons name="logout" size={20} color={C.danger} />
            <Text style={s.logoutText}>Log Out of Pipeline</Text>
          </AnimatedPressable>
        ) : null}

        <View style={s.footer}>
          <Text style={s.footerText}>
            ClipPipeline Mobile v{APP_VERSION}
            {APP_BUILD ? ` (Build ${APP_BUILD})` : ''}
          </Text>
          <Text style={s.footerText}>ClipPipeline is not affiliated with TikTok, Meta or YouTube.</Text>
        </View>
      </ScrollView>

      {/* R4 — edit name */}
      <Sheet visible={sheet === 'name'} onClose={closeSheet} title="Edit profile">
        <SheetLabel>Name</SheetLabel>
        <SheetInput value={nameDraft} onChangeText={setNameDraft} placeholder="Your name" maxLength={100} autoFocus />
        {sheetError ? <InlineMessage tone="danger" icon="error-outline" text={sheetError} /> : null}
        <SheetButton
          tone="primary"
          label="Save"
          disabled={!nameDraft.trim() || nameDraft.trim() === user?.name}
          loading={updateMe.isPending}
          onPress={() =>
            updateMe.mutate({ name: nameDraft.trim() }, { onSuccess: closeSheet, onError: (e) => setSheetError(errorText(e)) })
          }
        />
      </Sheet>

      {/* R6 / C3 — default hashtags + platforms */}
      <Sheet visible={sheet === 'defaults'} onClose={closeSheet} title="Post defaults" subtitle="Used to pre-fill the New Cross-Post form.">
        <SheetLabel>Default hashtags</SheetLabel>
        <SheetInput value={tagsDraft} onChangeText={setTagsDraft} placeholder="#editing #creator" autoCapitalize="none" autoCorrect={false} />
        <SheetLabel>Default platforms</SheetLabel>
        {PLATFORMS.map((p) => (
          <SheetCheck
            key={p}
            label={PLATFORM_LABEL[p]}
            checked={platformsDraft.includes(p)}
            onChange={(on) => setPlatformsDraft((cur) => (on ? [...cur, p] : cur.filter((x) => x !== p)))}
          />
        ))}
        <SheetText>Leave all unchecked to select every connected channel.</SheetText>
        {sheetError ? <InlineMessage tone="danger" icon="error-outline" text={sheetError} /> : null}
        <SheetButton
          tone="primary"
          label="Save defaults"
          loading={updatePrefs.isPending}
          onPress={() =>
            updatePrefs.mutate(
              { default_hashtags: parseTags(tagsDraft), default_platforms: platformsDraft },
              { onSuccess: closeSheet, onError: (e) => setSheetError(errorText(e)) },
            )
          }
        />
      </Sheet>

      {/* R7 — CSV export */}
      <Sheet visible={sheet === 'export'} onClose={closeSheet} title="Download analytics" subtitle="One row per post and channel, with the latest stats.">
        {(['7d', '30d', '90d'] as Period[]).map((p) => (
          <SheetRow
            key={p}
            icon="download"
            label={p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Last 90 days'}
            disabled={exporting}
            onPress={() => void runExport(p)}
          />
        ))}
        {exporting ? <SheetText>Preparing CSV…</SheetText> : null}
        {sheetError ? <InlineMessage tone="danger" icon="error-outline" text={sheetError} /> : null}
      </Sheet>

      {/* R10 / U-03 — delete account */}
      <Sheet visible={sheet === 'delete'} onClose={closeSheet} title="Delete your account?">
        <SheetText>
          This permanently deletes your ClipPipeline account: your profile, posts, uploaded videos, analytics history and
          notification settings. ClipPipeline&apos;s access to your YouTube, Meta and TikTok accounts is revoked right away
          and you are signed out on every device. Deletion completes within 7 days.
        </SheetText>
        <SheetText tone="warning">Videos already published on YouTube, Facebook, Instagram or TikTok are not deleted from those platforms.</SheetText>
        <SheetText>
          You can also request deletion on the web: <SheetLink label="Delete account page" onPress={() => openUrl(flags.delete_account_url)} />
        </SheetText>
        <SheetLabel>Type DELETE to confirm</SheetLabel>
        <SheetInput value={confirmText} onChangeText={setConfirmText} placeholder="DELETE" autoCapitalize="characters" autoCorrect={false} />
        {sheetError ? <InlineMessage tone="danger" icon="error-outline" text={sheetError} /> : null}
        <SheetButton
          tone="danger"
          icon="delete-forever"
          label="Delete my account"
          disabled={confirmText.trim() !== 'DELETE'}
          loading={deleteMe.isPending}
          onPress={() => void deleteAccount()}
        />
        <SheetButton label="Cancel" onPress={closeSheet} />
      </Sheet>
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
