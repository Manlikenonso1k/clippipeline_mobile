import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { useMe, useOverview, usePosts, useSocialAccounts } from '@/api/hooks';
import { AnimatedPressable, InlineMessage, Skeleton } from '@/components/ui-kit';
import { buildChart, captionBody, latestAnalytic, postStatus, shortDate, timeAgo, trendDelta } from '@/components/post-utils';
import { formatCount } from '@/lib/format';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  container: '#1F1F23',
  high: '#2A292E',
  highest: '#353439',
  border: '#2A2A36',
  text: '#FFFFFF',
  onSurface: '#E4E1E7',
  muted: '#A1A1AE',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  onPrimary: '#31009A',
  success: '#28C76F',
  cyan: '#00F2EA',
  youtube: '#FF0000',
  igMid: '#DD2A7B',
} as const;

const ranges = ['7d', '30d', '90d'] as const;

// Chart geometry: the design's 340x160 viewBox. Path is generated from overview.trend;
// FALLBACK_D (the design's curve shape) is only a flat placeholder when there is no trend data.
const VW = 340;
const VH = 160;
const FALLBACK_D = 'M0,135 L340,135';
const AnimatedPath = Animated.createAnimatedComponent(Path);

function Stat({ label, badge, icon, value, unit, loading, children }: { label: string; badge?: string; icon?: 'electric-bolt'; value: string; unit: string; loading?: boolean; children?: React.ReactNode }) {
  return (
    <View style={s.stat}>
      <View style={s.statTop}>
        <Text style={s.statLabel}>{label}</Text>
        {badge ? (
          <View style={s.badge}>
            <MaterialIcons name="arrow-upward" size={13} color={C.success} />
            <Text style={s.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {icon ? <MaterialIcons name={icon} size={18} color={C.muted} /> : null}
        {children}
      </View>
      <View style={s.statBottom}>
        {loading ? <Skeleton width={72} height={28} radius={6} /> : <Text style={s.statValue}>{value}</Text>}
        <Text style={s.statUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<(typeof ranges)[number]>('30d');
  const [chartW, setChartW] = useState(0);

  const me = useMe();
  const overviewQ = useOverview(range);
  const postsQ = usePosts('all');
  const accountsQ = useSocialAccounts();
  const overview = overviewQ.data;
  const posts = (postsQ.data ?? []).slice(0, 3);
  const accounts = accountsQ.data ?? [];
  const ovLoading = overviewQ.isLoading;
  const connectedCount = overview?.connected_accounts ?? accounts.filter((a) => a.connected).length;
  const delta = trendDelta(overview?.trend);
  const deltaBadge = delta !== null && delta > 0 ? `${delta.toFixed(1)}%` : undefined;

  const userName = me.data?.user?.name?.trim() || 'there';
  const firstName = userName.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const handleSrc = accounts.find((a) => a.handle)?.handle ?? me.data?.user?.email?.split('@')[0] ?? null;
  const handle = handleSrc ? `@${handleSrc.replace(/^@/, '')}` : '@creator';
  const avatarUri = me.data?.user?.avatar ?? null;

  const trend = useMemo(() => overview?.trend ?? [], [overview?.trend]);
  const chart = useMemo(() => buildChart(trend.map((t) => t.views ?? 0)), [trend]);
  const lineD = chart?.d ?? FALLBACK_D;
  const areaD = `${lineD} L340,160 L0,160 Z`;
  const lineLen = chart?.len ?? 420;
  const axisLabels = useMemo(() => {
    if (trend.length < 2) return [] as { label: string; idx: number }[];
    return [0, 1, 2, 3, 4].map((k) => {
      const idx = Math.round((k * (trend.length - 1)) / 4);
      return { label: shortDate(trend[idx].date), idx };
    });
  }, [trend]);
  const axisOnIdx = useMemo(() => {
    if (!chart || !axisLabels.length) return -1;
    let best = 0;
    axisLabels.forEach((a, i) => {
      if (Math.abs(a.idx - chart.peak) < Math.abs(axisLabels[best].idx - chart.peak)) best = i;
    });
    return best;
  }, [chart, axisLabels]);
  const tipText = chart ? `${shortDate(trend[chart.peak]?.date)} • ${formatCount(trend[chart.peak]?.views ?? 0)} views` : '';
  const lenSv = useSharedValue(420);
  useEffect(() => {
    lenSv.value = lineLen;
  }, [lineLen, lenSv]);

  const pulse = useSharedValue(1);
  const ping = useSharedValue(0);
  const reveal = useSharedValue(0);
  const pop = useSharedValue(0);
  const bars = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.3, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
    ping.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    reveal.value = withDelay(200, withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) }));
    pop.value = withDelay(1200, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    bars.forEach((b, i) => (b.value = withDelay(300 + i * 120, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6 }));
  const pingStyle = useAnimatedStyle(() => ({ opacity: 0.75 * (1 - ping.value), transform: [{ scale: 1 + ping.value * 2 }] }));
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: lenSv.value * (1 - reveal.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (reveal.value - 0.55) / 0.45)) }));
  const popStyle = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ translateY: (1 - pop.value) * 6 }] }));
  const b0 = useAnimatedStyle(() => ({ opacity: bars[0].value, transform: [{ scaleX: 0.4 + 0.6 * bars[0].value }] }));
  const b1 = useAnimatedStyle(() => ({ opacity: bars[1].value, transform: [{ scaleX: 0.4 + 0.6 * bars[1].value }] }));
  const b2 = useAnimatedStyle(() => ({ opacity: bars[2].value, transform: [{ scaleX: 0.4 + 0.6 * bars[2].value }] }));
  const barStyles = [b0, b1, b2];

  const chartH = 144;
  const sx = chartW / VW;
  const sy = chartH / VH;
  const hx = (chart?.peakX ?? 0) * sx;
  const hy = (chart?.peakY ?? 0) * sy;

  return (
    <View style={s.safe}>
      <SafeAreaView style={s.header}>
        <View style={s.headerRow}>
          <View style={s.brand}>
            <View style={s.logo}>
              <MaterialIcons name="videocam" size={20} color={C.text} />
            </View>
            <Text style={s.brandText}>Home</Text>
          </View>
          <View style={s.brand}>
            <Pressable style={({ pressed }) => [s.bell, pressed && s.press]}>
              <MaterialIcons name="notifications-none" size={22} color={C.muted} />
            </Pressable>
            <View style={s.me}>
              <MaterialIcons name="person" size={18} color={C.onPrimary} />
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={s.greet}>
          <View style={s.greetLeft}>
            <View style={s.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <MaterialIcons name="person" size={26} color={C.onPrimary} />
                </View>
              )}
              <View style={s.online}>
                <View style={s.onlineIn} />
              </View>
            </View>
            <View style={s.flex}>
              <View style={s.nameRow}>
                <Text numberOfLines={2} style={s.name}>{greeting}, {firstName}</Text>
                <Text style={s.wave}>👋</Text>
              </View>
              <Text style={s.handle}>{handle}</Text>
            </View>
          </View>
          <View style={s.sync}>
            <Animated.View style={[s.syncDot, pulseStyle]} />
            <Text style={s.syncText}>Auto-sync{'\n'}active</Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={s.grid}>
          <Stat label="Total Views" badge={deltaBadge} value={formatCount(overview?.total_views ?? 0)} unit="views" loading={ovLoading} />
          <Stat label="Total Likes" value={formatCount(overview?.total_likes ?? 0)} unit="likes" loading={ovLoading} />
          <Stat label="Published" icon="electric-bolt" value={formatCount(overview?.posts_published ?? 0)} unit="clips" loading={ovLoading} />
          <Stat label="Connected" value={`${connectedCount} of 3`} unit="hubs" loading={ovLoading && accountsQ.isLoading}>
            <View style={s.dots}>
              {([['tiktok', C.cyan], ['youtube', C.youtube], ['instagram', C.igMid]] as const).map(([pl, color], i) => {
                const on = accounts.some((a) => a.provider === pl && a.connected);
                return <View key={pl} style={[s.dotC, i > 0 && s.dotOverlap, { backgroundColor: on ? color : C.highest }]} />;
              })}
            </View>
          </Stat>
        </View>

        {/* Performance */}
        <View style={s.perf}>
          <View style={s.perfHead}>
            <View style={s.flex}>
              <Text style={s.h2}>Performance</Text>
              <Text style={s.caption}>Aggregated multi-platform reach</Text>
            </View>
            <View style={s.toggle}>
              {ranges.map((r) => (
                <Pressable key={r} onPress={() => setRange(r)} style={[s.pill, range === r && s.pillOn]}>
                  <Text style={[s.pillText, range === r && s.pillTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.chartWrap} onLayout={(e) => setChartW(e.nativeEvent.layout.width)}>
            <View style={{ height: chartH }}>
              {chartW > 0 && (
                <>
                  <Svg width="100%" height={chartH} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none">
                    <Defs>
                      <SvgGradient id="dashPerfFill" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="160">
                        <Stop offset="0" stopColor="#947DFF" stopOpacity={0.45} />
                        <Stop offset="0.65" stopColor="#8401D2" stopOpacity={0.12} />
                        <Stop offset="1" stopColor="#1F1F23" stopOpacity={0} />
                      </SvgGradient>
                    </Defs>
                    {[35, 80, 125].map((y) => (
                      <Line key={y} x1={0} x2={340} y1={y} y2={y} stroke="#353439" strokeOpacity={0.4} strokeWidth={0.75} strokeDasharray="3 4" />
                    ))}
                    <AnimatedPath d={areaD} fill="url(#dashPerfFill)" animatedProps={areaProps} />
                    <AnimatedPath
                      d={lineD}
                      fill="none"
                      stroke={C.primary}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray={lineLen}
                      animatedProps={lineProps}
                    />
                  </Svg>
                  {chart ? (
                  <Animated.View style={[StyleSheet.absoluteFill, popStyle]} pointerEvents="none">
                    <View style={[s.guide, { left: hx, top: 15 * sy, height: 140 * sy }]} />
                    <View style={[s.focal, { left: hx - 5, top: hy - 5 }]}>
                      <View style={s.focalIn} />
                    </View>
                    <View style={[s.tipWrap, { left: Math.max(0, Math.min(chartW - 150, hx - 75)) }]}>
                      <View style={s.tip}>
                        <View style={s.tipDotWrap}>
                          <Animated.View style={[s.tipPing, pingStyle]} />
                          <View style={s.tipDot} />
                        </View>
                        <Text style={s.tipText}>{tipText}</Text>
                      </View>
                    </View>
                  </Animated.View>
                  ) : null}
                </>
              )}
            </View>
            {overviewQ.isError && !overview ? (
              <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load data" style={s.chartMsg} />
            ) : ovLoading ? (
              <Skeleton height={14} style={s.chartMsg} />
            ) : !chart ? (
              <InlineMessage icon="show-chart" text="No activity yet for this period" style={s.chartMsg} />
            ) : (
              <View style={s.axis}>
                {axisLabels.map((a, i) => (
                  <Text key={`${a.idx}-${i}`} style={[s.axisText, i === axisOnIdx && s.axisOn]}>{a.label}</Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Top posts */}
        <View style={s.postsSec}>
          <View style={s.postsHead}>
            <View style={s.titleRow}>
              <Text style={s.h2}>Top Posts</Text>
              <Text style={s.active}>{posts.length} active</Text>
            </View>
            <AnimatedPressable style={s.viewAll} onPress={() => router.push('/posts' as never)}>
              <Text style={s.viewAllText}>View all</Text>
              <MaterialIcons name="chevron-right" size={16} color={C.primary} />
            </AnimatedPressable>
          </View>

          {postsQ.isError && !postsQ.data ? (
            <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load data" />
          ) : postsQ.isLoading ? (
            <>
              <Skeleton height={168} radius={12} />
              <Skeleton height={168} radius={12} />
            </>
          ) : posts.length === 0 ? (
            <InlineMessage icon="movie" text="No posts yet — your syndicated clips will show up here." />
          ) : null}

          {posts.map((p) => {
            const status = postStatus(p);
            const tone = status === 'published' ? C.success : status === 'failed' ? '#EA5455' : '#FF9F43';
            const label = status === 'published' ? 'Published' : status === 'failed' ? 'Failed' : 'Processing';
            const v = (pl: 'tiktok' | 'youtube' | 'instagram') => {
              const a = latestAnalytic(p, pl);
              return a ? formatCount(a.views) : '—';
            };
            return (
            <Pressable style={s.post} key={p.id} onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(p.id) } })}>
              <View style={s.postTop}>
                <View style={s.thumb}>
                  <LinearGradient colors={['#947DFF55', '#131317CC'] as const} style={StyleSheet.absoluteFill} />
                  <View style={s.playWrap}>
                    <View style={s.play}>
                      <MaterialIcons name="play-arrow" size={14} color={C.text} />
                    </View>
                  </View>
                </View>
                <View style={s.postBody}>
                  <View>
                    <View style={s.postTitleRow}>
                      <Text numberOfLines={2} style={s.postTitle}>{p.title}</Text>
                      <Text style={[s.published, { color: tone, backgroundColor: `${tone}26` }]}>{label}</Text>
                    </View>
                    <Text numberOfLines={1} style={s.postSub}>{captionBody(p.caption) || ' '}</Text>
                  </View>
                  <Text style={s.ago}>{p.published_at ? `Syndicated ${timeAgo(p.published_at)}` : 'Not published yet'}</Text>
                </View>
              </View>
              <View style={s.dist}>
                {(
                  [
                    ['TIKTOK', v('tiktok'), C.cyan],
                    ['SHORTS', v('youtube'), C.youtube],
                    ['REELS', v('instagram'), C.igMid],
                  ] as const
                ).map(([name, val, color], i) => (
                  <Animated.View key={name} style={[s.distItem, barStyles[i]]}>
                    <View style={[s.distDot, { backgroundColor: color }]} />
                    <View style={s.flex}>
                      <Text numberOfLines={1} style={s.distName}>{name}</Text>
                      <Text numberOfLines={1} style={s.distVal}>{val}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  flex: { flex: 1 },
  press: { opacity: 0.7 },
  header: { backgroundColor: C.surface, zIndex: 2 },
  headerRow: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primaryContainer, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  brandText: { color: C.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  me: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 20 },

  greet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  greetLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  avatarWrap: { width: 48, height: 48 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.high },
  avatarFallback: { backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  chartMsg: { marginTop: 8 },
  online: {
    position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: C.success,
    borderWidth: 2, borderColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  onlineIn: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.surface },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  name: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.2, flexShrink: 1 },
  wave: { fontSize: 17 },
  handle: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.high },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  syncText: { color: C.onSurface, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48.8%', flexGrow: 1, padding: 16, borderRadius: 12, backgroundColor: C.container, gap: 8 },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { color: C.muted, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#28C76F26' },
  badgeText: { color: C.success, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  statBottom: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  statValue: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  statUnit: { color: C.muted, fontSize: 13, fontWeight: '500' },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dotC: { width: 14, height: 14, borderRadius: 7 },
  dotOverlap: { marginLeft: -4 },

  perf: { padding: 20, borderRadius: 12, backgroundColor: C.container },
  perfHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  h2: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.2 },
  caption: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', padding: 2, borderRadius: 999, backgroundColor: C.high },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillOn: { backgroundColor: C.primaryContainer },
  pillText: { color: C.muted, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  pillTextOn: { color: C.text },

  chartWrap: { marginTop: 4 },
  guide: { position: 'absolute', width: 1, backgroundColor: '#CABEFF80' },
  focal: {
    position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: C.bg, borderWidth: 2, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  focalIn: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.text },
  tipWrap: { position: 'absolute', top: 2, width: 150, alignItems: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: C.raised },
  tipDotWrap: { width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  tipPing: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  tipText: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 8 },
  axisText: { color: '#A1A1AEB3', fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2 },
  axisOn: { color: C.primary },

  postsSec: { gap: 16 },
  postsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  active: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.high, color: C.muted,
    fontSize: 12, lineHeight: 16, fontWeight: '600', overflow: 'hidden',
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { color: C.primary, fontSize: 12, lineHeight: 16, fontWeight: '600' },

  post: { padding: 16, borderRadius: 12, backgroundColor: C.container, gap: 12 },
  postTop: { flexDirection: 'row', gap: 12 },
  thumb: { width: 80, height: 112, borderRadius: 8, overflow: 'hidden', backgroundColor: C.highest },
  thumbImg: { width: '100%', height: '100%' },
  playWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  play: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#16161DCC', alignItems: 'center', justifyContent: 'center' },
  dur: {
    position: 'absolute', right: 4, bottom: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
    backgroundColor: '#131317CC', color: C.text, fontSize: 10, lineHeight: 12, fontWeight: '500',
  },
  postBody: { flex: 1, justifyContent: 'space-between', minWidth: 0 },
  postTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  postTitle: { flex: 1, color: C.text, fontSize: 14, lineHeight: 19, fontWeight: '600', letterSpacing: 0.1 },
  published: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#28C76F26', color: C.success,
    fontSize: 12, lineHeight: 16, fontWeight: '600', overflow: 'hidden',
  },
  postSub: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 4 },
  ago: { color: '#A1A1AEB3', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  dist: { flexDirection: 'row', gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A2A3699' },
  distItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: C.high },
  distDot: { width: 8, height: 8, borderRadius: 4 },
  distName: { color: C.muted, fontSize: 10, lineHeight: 14, fontWeight: '600', letterSpacing: 0.8 },
  distVal: { color: C.text, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.2 },

  nav: { backgroundColor: C.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  navRow: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { minWidth: 44, minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.2, marginTop: 2 },
  tabDot: { position: 'absolute', bottom: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: C.primaryContainer },
});
