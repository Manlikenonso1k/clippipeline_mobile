import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { errorText } from '@/api/client';
import { isPostInFlight, useIsGuest, usePost, usePostAnalytics, useRetryDistribution } from '@/api/hooks';
import type { Platform } from '@/api/types';
import { AnimatedPressable, InlineMessage, Skeleton } from '@/components/ui-kit';
import { DIST_LABEL, STATUS_LABEL, buildChart, captionBody, metricsShort, postTags, privacyNote, timeAgo } from '@/components/post-utils';
import { useRefresh } from '@/hooks/use-refresh';
import { formatCount, formatDate, formatWatchTime } from '@/lib/format';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  container: '#1F1F23',
  containerHigh: '#2A292E',
  highest: '#353439',
  border: '#2A2A36',
  text: '#FFFFFF',
  muted: '#A1A1AE',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  onPrimaryContainer: '#2A0088',
  onPrimaryFixed: '#1C0062',
  success: '#28C76F',
  warning: '#FF9F43',
  danger: '#EA5455',
  cyan: '#00F2EA',
  youtube: '#FF0000',
  igStart: '#F58529',
  igMid: '#DD2A7B',
  igEnd: '#8134AF',
  facebook: '#1877F2',
} as const;

type Tab = 'Aggregated' | Platform;

const PLAT_META: Record<Platform, { name: string; dot: string; icon: 'youtube' | 'facebook' | 'instagram' | 'tiktok' }> = {
  tiktok: { name: 'TikTok', dot: C.cyan, icon: 'tiktok' },
  youtube: { name: 'YouTube Shorts', dot: C.youtube, icon: 'youtube' },
  instagram: { name: 'Instagram Reels', dot: C.igMid, icon: 'instagram' },
  facebook: { name: 'Facebook Reels', dot: C.facebook, icon: 'facebook' },
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === 'instagram') {
    return (
      <LinearGradient colors={[C.igStart, C.igMid, C.igEnd]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={s.chIcon}>
        <FontAwesome5 name="instagram" size={18} color={C.text} />
      </LinearGradient>
    );
  }
  return (
    <View style={[s.chIcon, { backgroundColor: C.raised }]}>
      <FontAwesome5 name={PLAT_META[platform].icon} size={18} color={PLAT_META[platform].dot} />
    </View>
  );
}

export default function PostDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const guest = useIsGuest();
  const postQ = usePost(postId);
  const post = postQ.data;
  const inFlight = isPostInFlight(post);
  const analyticsQ = usePostAnalytics(postId, { poll: inFlight });
  const retryM = useRetryDistribution();
  const { refreshing, onRefresh } = useRefresh([postQ, analyticsQ]);
  const pa = analyticsQ.data;

  const [tab, setTab] = useState<Tab>('Aggregated');
  const [retryError, setRetryError] = useState<Record<number, string>>({});

  const pulse = useSharedValue(1);
  const ping = useSharedValue(0);
  const spin = useSharedValue(0);
  const spinBtn = useSharedValue(0);
  const glow = useSharedValue(0.4);
  const velocity = useSharedValue(0);
  const sparkLenSv = useSharedValue(340);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
    ping.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    spin.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false);
    glow.value = withRepeat(withTiming(0.8, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
    velocity.value = withDelay(500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [pulse, ping, spin, glow, velocity]);

  useEffect(() => {
    spinBtn.value = 0;
    if (retryM.isPending || refreshing) {
      spinBtn.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, false);
    }
  }, [retryM.isPending, refreshing, spinBtn]);

  const sparkLineProps = useAnimatedProps(() => ({ strokeDashoffset: sparkLenSv.value * (1 - velocity.value) }));
  const sparkAreaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (velocity.value - 0.5) * 2)) }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6 }));
  const pingStyle = useAnimatedStyle(() => ({ opacity: 0.75 * (1 - ping.value), transform: [{ scale: 1 + ping.value * 2 }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const spinBtnStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinBtn.value * 360}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const platforms = useMemo(() => pa?.platforms ?? [], [pa?.platforms]);
  const selected = tab === 'Aggregated' ? null : platforms.find((p) => p.platform === tab);
  const totals = metricsShort(selected ? selected.metrics : (pa?.totals ?? post?.totals));
  const heroStats: [string, string][] = [
    ['Likes', formatCount(totals.likes)],
    ['Comments', formatCount(totals.comments)],
    ['Shares', formatCount(totals.shares)],
    ['Watch Time', formatWatchTime(totals.watch)],
  ];

  // Daily views (sum of the selected platforms' 30-day points).
  const series = useMemo(() => {
    const src = tab === 'Aggregated' ? platforms : platforms.filter((p) => p.platform === tab);
    const byDate = new Map<string, number>();
    src.forEach((p) => p.points.forEach((pt) => byDate.set(pt.date, (byDate.get(pt.date) ?? 0) + (pt.views ?? 0))));
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [platforms, tab]);
  const spark = useMemo(() => buildChart(series, { w: 320, top: 3, bottom: 29 }), [series]);
  const sparkD = spark?.d ?? 'M0,29 L320,29';
  const sparkAreaD = `${sparkD} L 320 32 L 0 32 Z`;
  const last7 = series.slice(-7);
  const perDay = last7.length ? last7.reduce((n, v) => n + v, 0) / last7.length : null;
  const sparkLen = spark?.len ?? 340;
  useEffect(() => {
    sparkLenSv.value = sparkLen;
  }, [sparkLen, sparkLenSv]);

  const dists = post?.distributions ?? [];
  const tags = post ? postTags(post) : [];
  const tabs: Tab[] = ['Aggregated', ...platforms.map((p) => p.platform)];

  const share = () => {
    if (!post) return;
    const link = dists.find((d) => d.url)?.url ?? post.video_url;
    Share.share({ message: `${post.title}${link ? `\n${link}` : ''}` }).catch(() => undefined);
  };

  const doRetry = (distributionId: number) => {
    if (guest) {
      Alert.alert('Preview mode', 'Sign in to publish and retry your own posts.');
      return;
    }
    setRetryError((m) => ({ ...m, [distributionId]: '' }));
    retryM.mutate(distributionId, {
      onError: (e) => setRetryError((m) => ({ ...m, [distributionId]: errorText(e) })),
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* App bar */}
      <View style={s.bar}>
        <View style={s.barLeft}>
          <Pressable accessibilityLabel="Go back" style={({ pressed }) => [s.iconBtn, pressed && s.press]} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={C.muted} />
          </Pressable>
          <Text style={s.barTitle}>Post Details</Text>
        </View>
        <View style={s.barRight}>
          <Pressable accessibilityLabel="Share post" style={({ pressed }) => [s.iconBtn, pressed && s.press]} onPress={share}>
            <MaterialIcons name="share" size={22} color={C.muted} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primaryContainer]} />}
      >
        {!post ? (
          postQ.isLoading ? (
            <View style={s.loadingStack}>
              <Skeleton height={320} radius={12} />
              <Skeleton height={20} width="70%" />
              <Skeleton height={90} radius={12} />
              <Skeleton height={90} radius={12} />
            </View>
          ) : (
            <InlineMessage tone="danger" icon="cloud-off" text={postQ.isError ? errorText(postQ.error) : 'Post not found'} />
          )
        ) : (
          <>
            {/* Video card */}
            <View style={s.glow} pointerEvents="none" />
            <View style={s.videoCard}>
              <View style={s.stage}>
                {post.thumbnail ? <Image source={{ uri: post.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                <LinearGradient colors={['#947DFF55', '#0E0E1200', '#0E0E12']} style={StyleSheet.absoluteFill} />
                <View style={s.badges}>
                  <View style={s.badge}>
                    <Animated.View style={[s.badgeDot, inFlight ? dotStyle : undefined]} />
                    <Text style={s.badgeText}>{STATUS_LABEL[post.status] ?? 'Processing'}</Text>
                  </View>
                  <View style={s.badge}>
                    <MaterialIcons name="schedule" size={14} color={C.muted} />
                    <Text style={s.badgeCaption}>
                      {post.status === 'scheduled' && post.scheduled_at ? `Scheduled ${formatDate(post.scheduled_at)}` : timeAgo(post.published_at ?? post.created_at)}
                    </Text>
                  </View>
                </View>
                <AnimatedPressable
                  accessibilityLabel="Play uploaded video"
                  style={s.play}
                  onPress={() => {
                    if (post.video_url) Linking.openURL(post.video_url).catch(() => undefined);
                  }}
                >
                  <View style={s.playTint} />
                  <MaterialIcons name="play-arrow" size={32} color={C.primary} />
                </AnimatedPressable>
              </View>

              <View style={s.summary}>
                <View style={s.titleRow}>
                  <Text style={s.title} numberOfLines={2}>
                    {post.title || 'Untitled clip'}
                  </Text>
                </View>
                {captionBody(post.caption) ? <Text style={s.caption}>{captionBody(post.caption)}</Text> : null}
                {tags.length ? <Text style={s.tags}>{tags.join(' ')}</Text> : null}

                <View style={s.source}>
                  <View style={s.sourceLeft}>
                    <View style={s.sourceAvatar}>
                      <MaterialIcons name={post.source === 'upload' ? 'upload' : 'download'} size={16} color={C.primary} />
                    </View>
                    <View>
                      <Text style={s.sourceTitle}>{post.source === 'upload' ? 'Uploaded from app' : 'Imported from TikTok'}</Text>
                      <Text style={s.sourceSub}>{post.published_at ? `First published ${formatDate(post.published_at)}` : 'Not published yet'}</Text>
                    </View>
                  </View>
                  <View style={s.sourceRight}>
                    <Text style={s.sourceNum}>{formatCount(post.totals?.views ?? 0)}</Text>
                    <Text style={s.sourceSub}>total views</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Distribution */}
            <View style={s.section}>
              <View style={s.secHead}>
                <View style={s.secTitleRow}>
                  <View style={[s.secBar, { backgroundColor: C.primary }]} />
                  <Text style={s.secTitle}>Distribution</Text>
                  <Text style={s.secNote}>
                    • {dists.length} {dists.length === 1 ? 'Channel' : 'Channels'}
                  </Text>
                </View>
                <Pressable style={s.manage} onPress={() => router.push('/connect')}>
                  <MaterialIcons name="sync-alt" size={16} color={C.primary} />
                  <Text style={s.manageText}>Accounts</Text>
                </Pressable>
              </View>

              {dists.length === 0 ? <InlineMessage icon="call-split" text="No target channels for this post." /> : null}

              {dists.map((d) => {
                const failed = d.status === 'failed';
                const done = d.status === 'published';
                const tone = done ? C.success : failed ? C.danger : C.warning;
                const note = privacyNote(d.privacy);
                const busy = retryM.isPending && retryM.variables === d.id;
                const sub = failed
                  ? `Failed${d.attempts ? ` after ${d.attempts} attempt${d.attempts === 1 ? '' : 's'}` : ''}`
                  : done
                    ? d.published_at
                      ? `Live • ${timeAgo(d.published_at)}`
                      : 'Live'
                    : d.status === 'queued'
                      ? post.status === 'scheduled' && post.scheduled_at
                        ? `Scheduled for ${formatDate(post.scheduled_at)}`
                        : 'Waiting in queue'
                      : d.status === 'uploading'
                        ? 'Uploading to platform…'
                        : 'Platform is processing…';
                return (
                  <View style={s.chCard} key={d.id}>
                    <View style={s.chRow}>
                      <View style={s.chLeft}>
                        <PlatformIcon platform={d.platform} />
                        <View style={s.flexShrink}>
                          <View style={s.chNameRow}>
                            <Text style={s.chName}>{PLAT_META[d.platform].name}</Text>
                            <MaterialIcons name={done ? 'check-circle' : failed ? 'error-outline' : 'schedule'} size={14} color={tone} />
                          </View>
                          <Text style={s.chSub} numberOfLines={1}>
                            {sub}
                          </Text>
                        </View>
                      </View>
                      <View style={[s.pill, { backgroundColor: `${tone}26` }]}>
                        <Animated.View style={[s.pillDot, { backgroundColor: tone }, !done && !failed ? dotStyle : undefined]} />
                        <Text style={[s.pillText, { color: tone }]}>{DIST_LABEL[d.status] ?? d.status}</Text>
                      </View>
                    </View>
                    {note ? (
                      <View style={s.chFoot}>
                        <MaterialIcons name="lock-outline" size={14} color={C.warning} />
                        <Text style={[s.chSub, s.flexShrink]}>{note}</Text>
                      </View>
                    ) : null}
                    {done && d.url ? (
                      <View style={s.chFoot}>
                        <Text style={s.chSub}>Live on {PLAT_META[d.platform].name}</Text>
                        <Pressable
                          style={({ pressed }) => [s.linkBtn, pressed && s.press]}
                          onPress={() => d.url && Linking.openURL(d.url).catch(() => undefined)}
                        >
                          <Text style={s.linkText}>Open</Text>
                          <MaterialIcons name="north-east" size={15} color={C.muted} />
                        </Pressable>
                      </View>
                    ) : null}
                    {failed ? (
                      <View style={s.diag}>
                        <View style={s.diagRow}>
                          <MaterialIcons name="warning-amber" size={18} color={C.danger} style={s.diagIcon} />
                          <Text style={s.diagText}>{d.error_message || 'Publishing failed. Check the connected account and retry.'}</Text>
                        </View>
                        {retryError[d.id] ? <Text style={[s.diagText, { color: C.warning }]}>{retryError[d.id]}</Text> : null}
                        <View style={s.diagBtns}>
                          <AnimatedPressable style={s.retry} onPress={() => doRetry(d.id)} disabled={busy}>
                            <Animated.View style={busy ? spinBtnStyle : undefined}>
                              <MaterialIcons name={busy ? 'refresh' : 'replay'} size={16} color={C.text} />
                            </Animated.View>
                            <Text style={s.retryText}>{busy ? 'Re-queuing…' : 'Retry'}</Text>
                          </AnimatedPressable>
                          <AnimatedPressable style={s.reauth} onPress={() => router.push('/connect')}>
                            <MaterialIcons name="vpn-key" size={16} color={C.text} />
                            <Text style={s.retryText}>Re-authorize</Text>
                          </AnimatedPressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Analytics */}
            <View style={s.section}>
              <View style={s.secHead}>
                <View style={s.secTitleRow}>
                  <View style={[s.secBar, { backgroundColor: C.primaryContainer }]} />
                  <Text style={s.secTitle}>Cross-Platform Analytics</Text>
                </View>
                {inFlight ? (
                  <View style={s.live}>
                    <View style={s.liveWrap}>
                      <Animated.View style={[s.liveRing, pingStyle]} />
                      <View style={s.liveDot} />
                    </View>
                    <Text style={s.liveText}>Live</Text>
                  </View>
                ) : null}
              </View>

              {tabs.length > 1 ? (
                <View style={s.tabs}>
                  {tabs.map((t) => (
                    <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                      <Text style={[s.tabText, tab === t && s.tabTextActive]} numberOfLines={1}>
                        {t === 'Aggregated' ? 'All' : PLAT_META[t].name.split(' ')[0]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {analyticsQ.isError && !pa ? (
                <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load analytics. Pull to retry." />
              ) : analyticsQ.isLoading ? (
                <Skeleton height={160} radius={16} />
              ) : platforms.length === 0 ? (
                <InlineMessage icon="query-stats" text="No analytics yet — stats appear after the first sync once a channel is live." />
              ) : null}

              {pa && platforms.length > 0 ? (
                <View style={s.heroCard}>
                  <View style={s.heroGlow} />
                  <View style={s.heroHead}>
                    <Text style={s.heroLabel}>{selected ? PLAT_META[selected.platform].name : 'Combined Total Reach'}</Text>
                  </View>
                  <View style={s.heroNumRow}>
                    <Text style={s.heroNum}>{formatCount(totals.views)}</Text>
                    <Text style={s.heroUnit}>Views</Text>
                  </View>
                  <View style={s.cluster}>
                    {heroStats.map(([label, val]) => (
                      <View key={label} style={s.clusterCell}>
                        <Text style={s.cap}>{label}</Text>
                        <Text style={s.clusterVal}>{val}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.velocity}>
                    <View style={s.velHead}>
                      <Text style={s.cap}>Daily views (30d)</Text>
                      <Text style={s.cap}>{perDay !== null ? `${formatCount(Math.round(perDay))} views/day (7d avg)` : '—'}</Text>
                    </View>
                    <View style={s.spark}>
                      <Svg width="100%" height={32} viewBox="0 0 320 32" preserveAspectRatio="none">
                        <AnimatedPath d={sparkAreaD} fill={C.primary} fillOpacity={0.08} animatedProps={sparkAreaProps} />
                        <AnimatedPath
                          d={sparkD}
                          fill="none"
                          stroke={C.primary}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeDasharray={sparkLen}
                          animatedProps={sparkLineProps}
                        />
                      </Svg>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={s.platList}>
                {platforms
                  .filter((p) => tab === 'Aggregated' || p.platform === tab)
                  .map((p) => {
                    const mt = p.metrics;
                    return (
                      <View key={p.distribution_id} style={s.platCard}>
                        <View style={s.platHead}>
                          <View style={s.platName}>
                            <View style={[s.platDot, { backgroundColor: PLAT_META[p.platform].dot }]} />
                            <Text style={s.chName}>{PLAT_META[p.platform].name}</Text>
                          </View>
                          {p.url ? (
                            <Pressable style={s.linkBtn} onPress={() => p.url && Linking.openURL(p.url).catch(() => undefined)}>
                              <Text style={s.linkText}>Open</Text>
                              <MaterialIcons name="north-east" size={14} color={C.muted} />
                            </Pressable>
                          ) : (
                            <Text style={[s.platNote, { color: C.muted }]}>{DIST_LABEL[p.status] ?? p.status}</Text>
                          )}
                        </View>
                        <View style={s.statGrid}>
                          {(
                            [
                              ['Views', mt.views],
                              ['Likes', mt.likes],
                              ['Comments', mt.comments],
                              ['Shares', mt.shares],
                            ] as const
                          ).map(([label, v]) => (
                            <View key={label} style={s.statCell}>
                              <Text style={s.cap}>{label}</Text>
                              <Text style={s.statVal}>{formatCount(v)}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={s.cap}>
                          Saves {formatCount(mt.saves)} • Watch {formatWatchTime(mt.watch_time_seconds)}
                          {p.captured_on ? ` • as of ${formatDate(p.captured_on)}` : ''}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </View>

            {/* Sync heartbeat */}
            <View style={s.heartbeat}>
              <View style={s.hbLeft}>
                <Animated.View style={inFlight ? spinStyle : undefined}>
                  <MaterialIcons name="autorenew" size={15} color={C.primary} />
                </Animated.View>
                <Text style={s.cap}>Updated: {postQ.dataUpdatedAt ? timeAgo(new Date(postQ.dataUpdatedAt).toISOString()) : '—'}</Text>
              </View>
              <Text style={s.cap}>{inFlight ? 'Refreshing every 5s while publishing' : 'Pull down to refresh'}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom dock */}
      <View style={s.dock}>
        <AnimatedPressable style={s.editBtn} onPress={() => router.push('/post/new')}>
          <MaterialIcons name="add" size={18} color={C.text} />
          <Text style={s.dockText}>New Post</Text>
        </AnimatedPressable>
        <View style={s.resyncWrap}>
          <Animated.View style={[s.resyncGlow, glowStyle]} />
          <AnimatedPressable style={s.resync} onPress={onRefresh} disabled={refreshing}>
            <LinearGradient colors={[C.primary, C.primaryContainer]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Animated.View style={refreshing ? spinBtnStyle : undefined}>
              <MaterialIcons name="sync" size={19} color={C.onPrimaryFixed} />
            </Animated.View>
            <Text style={s.resyncText}>{refreshing ? 'Refreshing…' : 'Refresh Status'}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  loadingStack: { gap: 12 },
  diagIcon: { marginTop: 2 },
  flexShrink: { flexShrink: 1 },
  page: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 112 },
  press: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  pressCta: { opacity: 0.92, transform: [{ scale: 0.98 }] },

  bar: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  barTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.2 },

  glow: { position: 'absolute', top: -20, alignSelf: 'center', width: 288, height: 288, borderRadius: 144, backgroundColor: '#947DFF1A' },
  videoCard: { borderRadius: 12, backgroundColor: C.container, overflow: 'hidden' },
  stage: { width: '100%', aspectRatio: 9 / 13, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badges: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#0E0E12CC' },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.cyan },
  badgeText: { color: C.text, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  badgeCaption: { color: C.muted, fontSize: 13, fontWeight: '500' },
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E1E28E6', alignItems: 'center', justifyContent: 'center' },
  playTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, backgroundColor: '#CABEFF33' },
  stageBottom: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: C.text, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#0E0E12E6', overflow: 'hidden' },
  res: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#0E0E12E6' },
  resText: { color: C.muted, fontSize: 12, fontWeight: '600' },

  summary: { padding: 16, gap: 8, backgroundColor: C.container },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.2 },
  copyBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  caption: { color: C.muted, fontSize: 15, lineHeight: 24 },
  tags: { color: C.primaryContainer, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  source: { marginTop: 4, padding: 10, borderRadius: 8, backgroundColor: '#1E1E28B3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  sourceAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.highest, alignItems: 'center', justifyContent: 'center' },
  sourceTk: { color: C.cyan, fontSize: 12, fontWeight: '700' },
  sourceTitle: { color: C.text, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  sourceSub: { color: C.muted, fontSize: 13, lineHeight: 18 },
  sourceRight: { alignItems: 'flex-end' },
  sourceNum: { color: C.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  section: { marginTop: 24, gap: 8 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  secBar: { width: 6, height: 14, borderRadius: 3 },
  secTitle: { color: C.text, fontSize: 14, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  secNote: { color: C.muted, fontSize: 13 },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 4 },
  manageText: { color: C.primary, fontSize: 12, fontWeight: '600' },

  chCard: { borderRadius: 12, backgroundColor: C.container, padding: 16, gap: 8 },
  chRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  chIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chName: { color: C.text, fontSize: 14, fontWeight: '600' },
  chSub: { color: C.muted, fontSize: 13, lineHeight: 18 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  chFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  linkBtn: { minHeight: 44, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.raised, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { color: C.text, fontSize: 12, fontWeight: '600' },

  diag: { borderRadius: 8, backgroundColor: '#EA54551A', padding: 12, gap: 6 },
  diagRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  diagText: { flex: 1, color: C.danger, fontSize: 13, lineHeight: 18 },
  diagBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  retry: { flex: 1, minHeight: 44, borderRadius: 8, backgroundColor: C.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 12 },
  retryText: { color: C.text, fontSize: 12, fontWeight: '600' },
  reauth: { minHeight: 44, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.raised, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },

  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveWrap: { width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  liveRing: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  liveText: { color: C.success, fontSize: 13, fontWeight: '500' },

  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 12, backgroundColor: C.container },
  tab: { flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: C.primaryContainer },
  tabText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: C.onPrimaryContainer },

  heroCard: { borderRadius: 12, backgroundColor: C.container, padding: 20, overflow: 'hidden' },
  heroGlow: { position: 'absolute', right: -20, top: -20, width: 128, height: 128, borderRadius: 64, backgroundColor: '#CABEFF1A' },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  heroLabel: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#28C76F26' },
  deltaText: { color: C.success, fontSize: 13, fontWeight: '600' },
  heroNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroNum: { color: C.text, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1 },
  heroUnit: { color: C.muted, fontSize: 15 },
  cluster: { flexDirection: 'row', gap: 8, paddingTop: 16, marginTop: 8 },
  clusterCell: { flex: 1 },
  cap: { color: C.muted, fontSize: 13, lineHeight: 18 },
  clusterVal: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  velocity: { marginTop: 16, paddingTop: 12 },
  velHead: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 4 },
  spark: { height: 32 },

  platList: { gap: 8, marginTop: 4 },
  platCard: { borderRadius: 12, backgroundColor: C.container, padding: 16, gap: 8 },
  platHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  platName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platDot: { width: 10, height: 10, borderRadius: 5 },
  platNote: { fontSize: 13, fontWeight: '500' },
  syncBad: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncBadText: { color: C.danger, fontSize: 13, fontWeight: '500' },
  statGrid: { flexDirection: 'row', gap: 8, paddingTop: 4, padding: 10, borderRadius: 8, backgroundColor: C.raised },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: C.text, fontSize: 14, fontWeight: '600' },

  heartbeat: { marginTop: 20, marginBottom: 8, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hbLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#16161DF2' },
  editBtn: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.raised, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dockText: { color: C.text, fontSize: 14, fontWeight: '600' },
  resyncWrap: { flex: 1 },
  resyncGlow: { position: 'absolute', top: 2, left: 2, right: 2, bottom: -4, borderRadius: 14, backgroundColor: '#947DFF40' },
  resync: { minHeight: 48, borderRadius: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resyncText: { color: C.onPrimaryFixed, fontSize: 14, fontWeight: '700' },
});
