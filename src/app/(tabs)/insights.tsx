import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { useOverview, usePosts } from '@/api/hooks';
import { AnimatedPressable, InlineMessage, Skeleton } from '@/components/ui-kit';
import { buildChart, latestAnalytic, shortDate, totalsFor, trendDelta } from '@/components/post-utils';
import { formatCount, formatWatchTime } from '@/lib/format';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  container: '#1F1F23',
  containerLow: '#1B1B1F',
  high: '#2A292E',
  border: '#2A2A36',
  text: '#FFFFFF',
  muted: '#A1A1AE',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  secondaryContainer: '#8401D2',
  tertiary: '#FFB780',
  success: '#28C76F',
  warning: '#FF9F43',
  danger: '#EA5455',
  cyan: '#00F2EA',
  tiktokRed: '#FE2C55',
  youtube: '#FF0000',
  igStart: '#F58529',
  igMid: '#DD2A7B',
  igEnd: '#8134AF',
} as const;

// ---- Chart geometry: 340x160 viewBox; paths are generated from overview.trend ----
const CHART_H = 176;
const FLAT_D = 'M 0 140 L 340 140';
const CURVE_LEN = 390;
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPARKS = {
  views: { color: C.primary, fill: C.primaryContainer, d: 'M0 24 L 20 18 L 40 22 L 60 12 L 80 15 L 100 4' },
  likes: { color: C.tiktokRed, fill: C.tiktokRed, d: 'M0 22 L 20 20 L 40 14 L 60 18 L 80 8 L 100 6' },
  comments: { color: C.warning, fill: C.warning, d: 'M0 26 L 25 21 L 50 16 L 75 19 L 100 5' },
  shares: { color: C.success, fill: C.success, d: 'M0 25 L 20 22 L 45 10 L 70 14 L 100 3' },
} as const;

const KPI_DEFS = [
  { key: 'views', icon: 'visibility', tint: C.primary, label: 'Total Views' },
  { key: 'likes', icon: 'favorite', tint: C.danger, label: 'Likes' },
  { key: 'comments', icon: 'forum', tint: C.warning, label: 'Comments' },
  { key: 'shares', icon: 'share', tint: C.success, label: 'Shares' },
] as const;

const PERIODS = [
  { label: 'Last 30 Days', api: '30d', days: '30-Day' },
  { label: 'Last 7 Days', api: '7d', days: '7-Day' },
  { label: 'This Quarter (Q4)', api: '90d', days: '90-Day' },
] as const;

const PLATFORMS = ['All Platforms', 'TikTok', 'YouTube', 'Instagram'] as const;
type Platform = (typeof PLATFORMS)[number];

// ---- Small animated pieces ----
const SPARK_LEN = 130;

function Spark({ d, color, fill, progress }: { d: string; color: string; fill: string; progress: SharedValue<number> }) {
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: SPARK_LEN * (1 - progress.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (progress.value - 0.5) * 2)) }));
  return (
    <View style={s.spark}>
      <Svg width="100%" height={28} viewBox="0 0 100 28" preserveAspectRatio="none">
        <AnimatedPath d={`${d} L 100 28 L 0 28 Z`} fill={fill} fillOpacity={0.12} animatedProps={areaProps} />
        <AnimatedPath
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={SPARK_LEN}
          vectorEffect="non-scaling-stroke"
          animatedProps={lineProps}
        />
      </Svg>
    </View>
  );
}

function PlatformDot({ kind }: { kind: 'tt' | 'yt' | 'ig' }) {
  if (kind === 'ig') return <LinearGradient colors={[C.igStart, C.igMid] as const} style={s.dot} />;
  return <View style={[s.dot, { backgroundColor: kind === 'tt' ? C.cyan : C.youtube }]} />;
}

export default function Insights() {
  const [platform, setPlatform] = useState<Platform>('All Platforms');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState<string>('Last 30 Days');
  const periodDef = PERIODS.find((p) => p.label === period) ?? PERIODS[0];

  const overviewQ = useOverview(periodDef.api);
  const postsQ = usePosts('all');
  const ov = overviewQ.data;
  const ovLoading = overviewQ.isLoading;
  const posts = useMemo(() => postsQ.data ?? [], [postsQ.data]);

  const trend = useMemo(() => ov?.trend ?? [], [ov?.trend]);
  const series = useMemo(() => trend.map((x) => x.views ?? 0), [trend]);

  // Platform split from per-post analytics.
  const split = useMemo(() => {
    const out = { tt: 0, yt: 0, ig: 0 };
    let watch = 0;
    posts.forEach((p) => {
      out.tt += latestAnalytic(p, 'tiktok')?.views ?? 0;
      out.yt += latestAnalytic(p, 'youtube')?.views ?? 0;
      out.ig += latestAnalytic(p, 'instagram')?.views ?? 0;
      watch += totalsFor(p).watch;
    });
    return { ...out, total: out.tt + out.yt + out.ig, watch };
  }, [posts]);
  const pct = (n: number) => (split.total > 0 ? Math.round((n / split.total) * 100) : 0);

  const primary = useMemo(() => buildChart(series, { top: 14, bottom: 140 }), [series]);
  const ttShare = split.total > 0 ? split.tt / split.total : 0;
  // Secondary curve is scaled to the same max so it sits under the primary line.
  const primaryD = primary?.d ?? FLAT_D;
  const primaryAreaD = `${primaryD} L 340 150 L 0 150 Z`;
  const tiktokD = ttShare > 0 ? buildChart(series.map((v) => v * ttShare), { top: 14 + (1 - ttShare) * 126, bottom: 140 })?.d ?? FLAT_D : FLAT_D;
  const tiktokAreaD = `${tiktokD} L 340 150 L 0 150 Z`;
  const curveLen = primary?.len ?? CURVE_LEN;
  const curveLenSv = useSharedValue(CURVE_LEN);
  useEffect(() => {
    curveLenSv.value = curveLen;
  }, [curveLen, curveLenSv]);
  const peakDate = primary ? shortDate(trend[primary.peak]?.date) : '';
  const peakVal = primary ? formatCount(series[primary.peak] ?? 0) : '';
  const axisLabels = useMemo(() => {
    if (trend.length < 2) return [] as { label: string; idx: number }[];
    return [0, 1, 2, 3, 4].map((k) => {
      const idx = Math.round((k * (trend.length - 1)) / 4);
      return { label: shortDate(trend[idx].date), idx };
    });
  }, [trend]);
  const axisOnIdx = useMemo(() => {
    if (!primary || !axisLabels.length) return -1;
    let best = 0;
    axisLabels.forEach((a, i) => {
      if (Math.abs(a.idx - primary.peak) < Math.abs(axisLabels[best].idx - primary.peak)) best = i;
    });
    return best;
  }, [primary, axisLabels]);
  const delta = trendDelta(trend);
  const rangeCaption =
    trend.length >= 2
      ? `${shortDate(trend[0].date)} – ${shortDate(trend[trend.length - 1].date)} • ${periodDef.days} Aggregation`
      : `${periodDef.days} Aggregation`;

  const topClips = useMemo(
    () =>
      posts
        .map((p) => ({ p, t: totalsFor(p) }))
        .sort((a, b) => b.t.views - a.t.views)
        .slice(0, 3),
    [posts],
  );
  const kpiValue = (k: (typeof KPI_DEFS)[number]['key']) =>
    formatCount(k === 'views' ? ov?.total_views ?? 0 : k === 'likes' ? ov?.total_likes ?? 0 : k === 'comments' ? ov?.total_comments ?? 0 : ov?.total_shares ?? 0);
  const boostMult = split.tt > 0 && split.total > split.tt ? split.total / split.tt : null;
  const avgWatch = (ov?.total_views ?? 0) > 0 && split.watch > 0 ? formatWatchTime(split.watch / split.total) : '—';

  const chart = useSharedValue(0);
  const spark = useSharedValue(0);
  const ping = useSharedValue(0);
  const pulse = useSharedValue(0.6);
  const bars = useSharedValue(0);

  useEffect(() => {
    chart.value = withDelay(150, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    spark.value = withDelay(500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    bars.value = withDelay(700, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    ping.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [chart, spark, bars, ping, pulse]);

  const pingStyle = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - ping.value), transform: [{ scale: 1 + ping.value * 2.2 }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6 }));
  const primaryLineProps = useAnimatedProps(() => ({ strokeDashoffset: curveLenSv.value * (1 - chart.value) }));
  const tiktokLineProps = useAnimatedProps(() => ({ strokeDashoffset: curveLenSv.value * (1 - chart.value) }));
  const primaryAreaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (chart.value - 0.55) / 0.45)) }));
  const tiktokAreaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (chart.value - 0.45) / 0.45)) }));
  const barW = (pct: number) => useAnimatedStyle(() => ({ width: `${pct * bars.value}%` })); // eslint-disable-line react-hooks/rules-of-hooks
  const wTT = barW(pct(split.tt));
  const wYT = barW(pct(split.yt));
  const wIG = barW(pct(split.ig));

  const dim = (p: 'tt' | 'yt' | 'ig') =>
    platform === 'All Platforms' ||
    (platform === 'TikTok' && p === 'tt') ||
    (platform === 'YouTube' && p === 'yt') ||
    (platform === 'Instagram' && p === 'ig')
      ? 1
      : 0.35;

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe}>
        {/* Top app bar */}
        <View style={s.appBar}>
          <View style={s.brand}>
            <View style={s.logo}>
              <MaterialIcons name="videocam" size={20} color={C.text} />
            </View>
            <Text style={s.brandText}>Home</Text>
          </View>
          <View style={s.brand}>
            <Pressable style={s.bell}>
              <MaterialIcons name="notifications-none" size={22} color={C.muted} />
            </Pressable>
            <View style={s.avatar}>
              <MaterialIcons name="person" size={18} color="#31009A" />
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.h1}>Insights</Text>
              <Text style={s.caption}>{rangeCaption}</Text>
            </View>
            <View style={s.headActions}>
              <AnimatedPressable style={s.periodBtn} onPress={() => setPeriodOpen((v) => !v)}>
                <MaterialIcons name="calendar-today" size={17} color={C.primary} />
                <Text style={s.periodText}>{period}</Text>
                <MaterialIcons name="expand-more" size={18} color={C.muted} />
              </AnimatedPressable>
              <Pressable style={s.shareBtn}>
                <MaterialIcons name="ios-share" size={19} color={C.muted} />
              </Pressable>
            </View>
          </View>
          {periodOpen ? (
            <View style={s.popover}>
              {PERIODS.map((x) => x.label).map((p) => {
                const on = p === period;
                return (
                  <Pressable
                    key={p}
                    style={[s.popItem, on && { backgroundColor: 'rgba(202,190,255,0.1)' }]}
                    onPress={() => {
                      setPeriod(p);
                      setPeriodOpen(false);
                    }}>
                    <Text style={[s.caption, on ? { color: C.primary, fontWeight: '600' } : null]}>{p}</Text>
                    {on ? <MaterialIcons name="check" size={16} color={C.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Platform chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsWrap}>
            {PLATFORMS.map((p) => {
              const on = p === platform;
              const inner = (
                <>
                  {p === 'All Platforms' ? (
                    <MaterialIcons name="hub" size={15} color={on ? C.text : C.muted} />
                  ) : p === 'TikTok' ? (
                    <View style={[s.chipDot, { backgroundColor: C.cyan }]} />
                  ) : p === 'YouTube' ? (
                    <View style={[s.chipDot, { backgroundColor: C.youtube }]} />
                  ) : (
                    <LinearGradient colors={[C.igStart, C.igMid] as const} style={s.chipDot} />
                  )}
                  <Text style={[s.caption, on ? { color: C.text, fontWeight: '600' } : null]}>{p}</Text>
                </>
              );
              return (
                <Pressable key={p} onPress={() => setPlatform(p)}>
                  {on ? (
                    <LinearGradient
                      colors={[C.primaryContainer, C.secondaryContainer] as const}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[s.chip, { paddingHorizontal: 16 }]}>
                      {inner}
                    </LinearGradient>
                  ) : (
                    <View style={[s.chip, { backgroundColor: 'rgba(42,41,46,0.4)' }]}>{inner}</View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Reach chart card */}
          <View style={[s.card, { padding: 16, gap: 12, overflow: 'hidden' }]}>
            <View style={s.glow} />
            <View style={s.rowBetween}>
              <View>
                <Text style={s.label}>CROSS-CHANNEL REACH</Text>
                <View style={s.baseline}>
                  {ovLoading ? <Skeleton width={110} height={36} radius={8} /> : <Text style={s.statXl}>{formatCount(ov?.total_views ?? 0)}</Text>}
                  <Text style={[s.caption, { marginLeft: 8 }]}>Views</Text>
                </View>
              </View>
              {delta !== null ? (
                <View style={[s.growth, delta < 0 && { backgroundColor: 'rgba(234,84,85,0.15)' }]}>
                  <MaterialIcons name={delta < 0 ? 'trending-down' : 'trending-up'} size={15} color={delta < 0 ? C.danger : C.success} />
                  <Text style={[s.label, { color: delta < 0 ? C.danger : C.success }]}>{`${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.chartBox}>
              {!primary ? (
                overviewQ.isError && !ov ? (
                  <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load data" style={s.chartMsg} />
                ) : ovLoading ? (
                  <Skeleton height={CHART_H - 20} radius={12} style={s.chartMsg} />
                ) : (
                  <InlineMessage icon="show-chart" text="No activity yet for this period" style={s.chartMsg} />
                )
              ) : null}
              <Svg width="100%" height={CHART_H} viewBox="0 0 340 160" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
                <Defs>
                  <SvgGradient id="insReachPrimary" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="160">
                    <Stop offset="0" stopColor="#947DFF" stopOpacity={0.35} />
                    <Stop offset="0.85" stopColor="#947DFF" stopOpacity={0.02} />
                    <Stop offset="1" stopColor="#947DFF" stopOpacity={0} />
                  </SvgGradient>
                  <SvgGradient id="insReachTikTok" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="160">
                    <Stop offset="0" stopColor="#00F2EA" stopOpacity={0.2} />
                    <Stop offset="1" stopColor="#00F2EA" stopOpacity={0} />
                  </SvgGradient>
                </Defs>
                {[30, 75, 120].map((y) => (
                  <Line key={y} x1={0} x2={340} y1={y} y2={y} stroke="#2A2A36" strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="3 4" />
                ))}
                <AnimatedPath d={tiktokAreaD} fill="url(#insReachTikTok)" animatedProps={tiktokAreaProps} />
                <AnimatedPath
                  d={tiktokD}
                  fill="none"
                  stroke="#00F2EA"
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  strokeDasharray={curveLen}
                  animatedProps={tiktokLineProps}
                />
                <AnimatedPath d={primaryAreaD} fill="url(#insReachPrimary)" animatedProps={primaryAreaProps} />
                <AnimatedPath
                  d={primaryD}
                  fill="none"
                  stroke={C.primary}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeDasharray={curveLen}
                  animatedProps={primaryLineProps}
                />
              </Svg>
              {/* Peak marker */}
              {primary ? (
                <>
                  <View style={[s.peakLine, { left: `${(primary.peakX / 340) * 100}%`, top: (primary.peakY / 160) * CHART_H }]} />
                  <View style={[s.peakAnchor, { left: `${(primary.peakX / 340) * 100}%`, top: (primary.peakY / 160) * CHART_H - 1 }]}>
                    <Animated.View style={[s.peakHalo, haloStyle]} />
                    <View style={s.peakDot} />
                  </View>
                  <View style={s.tooltip}>
                    <View style={s.pingWrap}>
                      <Animated.View style={[s.pingRing, pingStyle]} />
                      <View style={s.pingCore} />
                    </View>
                    <Text style={[s.label, { color: C.text }]}>{peakDate}</Text>
                    <Text style={s.caption}>•</Text>
                    <Text style={[s.label, { color: C.primary, fontWeight: '700' }]}>{peakVal}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={[s.rowBetween, { paddingHorizontal: 4 }]}>
              {axisLabels.map((a, i) => (
                <Text key={`${a.idx}-${i}`} style={[s.caption, i === axisOnIdx ? { color: C.primary, fontWeight: '600' } : null]}>
                  {a.label}
                </Text>
              ))}
            </View>

            <View style={s.legend}>
              {(
                [
                  ['tt', 'TikTok', split.total ? `${pct(split.tt)}%` : '—', formatCount(split.tt)],
                  ['yt', 'Shorts', split.total ? `${pct(split.yt)}%` : '—', formatCount(split.yt)],
                  ['ig', 'Reels', split.total ? `${pct(split.ig)}%` : '—', formatCount(split.ig)],
                ] as const
              ).map(([k, name, pct, num]) => (
                <View key={k} style={{ flex: 1, gap: 2, opacity: dim(k) }}>
                  <View style={s.legendHead}>
                    <PlatformDot kind={k} />
                    <Text style={[s.label, { color: C.muted }]}>{name}</Text>
                  </View>
                  <View style={s.baseline}>
                    <Text style={s.labelMd}>{pct}</Text>
                    <Text style={[s.caption, { marginLeft: 4 }]}>{num}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Cross-post boost */}
          {boostMult ? (
            <View style={[s.card, s.boost]}>
              <LinearGradient colors={[C.primary, C.secondaryContainer] as const} style={s.boostBar} />
              <View style={s.boostIcon}>
                <MaterialIcons name="rocket-launch" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.legendHead}>
                  <Text style={[s.labelMd, { fontWeight: '700' }]}>{boostMult.toFixed(1)}x Cross-Post Boost</Text>
                  <View style={s.tertiaryPill}>
                    <Text style={[s.label, { color: C.tertiary }]}>{`+${Math.round((boostMult - 1) * 100)}%`}</Text>
                  </View>
                </View>
                <Text style={[s.caption, { marginTop: 2 }]} numberOfLines={1}>
                  Auto-syndicating unlocked {formatCount(split.total - split.tt)} extra views beyond TikTok.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.muted} />
            </View>
          ) : null}

          {/* KPI grid */}
          <View style={s.grid}>
            {KPI_DEFS.map((k) => {
              const sp = SPARKS[k.key];
              return (
                <View key={k.key} style={[s.card, s.kpi]}>
                  <View style={s.rowBetween}>
                    <View style={s.kpiIcon}>
                      <MaterialIcons name={k.icon} size={18} color={k.tint} />
                    </View>
                    {k.key === 'views' && delta !== null && delta > 0 ? (
                      <View style={s.deltaPill}>
                        <Text style={[s.label, { color: C.success }]}>{`+${delta.toFixed(1)}% ↑`}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Text style={[s.label, { color: C.muted }]}>{k.label}</Text>
                    {ovLoading ? <Skeleton width={70} height={28} radius={6} style={{ marginVertical: 3 }} /> : <Text style={s.statLg}>{kpiValue(k.key)}</Text>}
                  </View>
                  <Spark d={sp.d} color={sp.color} fill={sp.fill} progress={spark} />
                </View>
              );
            })}
          </View>

          {/* Watch completion */}
          <View style={[s.card, { padding: 16, gap: 10 }]}>
            <View style={s.rowBetween}>
              <View style={s.legendHead}>
                <MaterialIcons name="timelapse" size={19} color={C.primary} />
                <Text style={[s.labelMd, { marginLeft: 4 }]}>Avg. Watch Time / View</Text>
              </View>
              <Text style={[s.labelMd, { fontWeight: '700' }]}>{avgWatch}</Text>
            </View>
            <View style={s.track}>
              <Animated.View style={[{ height: '100%', backgroundColor: C.cyan }, wTT]} />
              <Animated.View style={[{ height: '100%', backgroundColor: C.youtube }, wYT]} />
              <Animated.View style={[{ height: '100%', overflow: 'hidden' }, wIG]}>
                <LinearGradient colors={[C.igStart, C.igMid] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
            <View style={s.rowBetween}>
              <Text style={s.caption}>Total watch time: {split.watch > 0 ? formatWatchTime(split.watch) : '—'}</Text>
              <Text style={s.caption}>Posts published: {formatCount(ov?.posts_published ?? 0)}</Text>
            </View>
          </View>

          {/* Top clips */}
          <View style={[s.rowBetween, { marginTop: 4 }]}>
            <View style={s.legendHead}>
              <Text style={s.headline}>Top Performing Clips</Text>
              <View style={s.topPill}>
                <Text style={[s.label, { color: C.primary }]}>{topClips.length} Top</Text>
              </View>
            </View>
            <Pressable style={s.legendHead}>
              <Text style={[s.label, { color: C.muted }]}>By Views</Text>
              <MaterialIcons name="sort" size={16} color={C.muted} />
            </Pressable>
          </View>

          {postsQ.isError && !postsQ.data ? (
            <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load data" />
          ) : postsQ.isLoading ? (
            <>
              <Skeleton height={136} radius={16} />
              <Skeleton height={136} radius={16} />
            </>
          ) : topClips.length === 0 ? (
            <InlineMessage icon="movie" text="No posts yet — your top clips will rank here." />
          ) : null}

          {topClips.map(({ p, t: tt }, i) => {
            const rank = i + 1;
            const eng = tt.views > 0 ? ((tt.likes + tt.comments + tt.shares) / tt.views) * 100 : 0;
            const v = (pl: 'tiktok' | 'youtube' | 'instagram') => {
              const a = latestAnalytic(p, pl);
              return a ? formatCount(a.views) : '—';
            };
            return (
              <Pressable
                key={p.id}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(p.id) } })}
                style={[s.card, s.clip]}
              >
                <View style={s.thumb}>
                  {p.thumbnail ? <Image source={{ uri: p.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                  <LinearGradient colors={['rgba(148,125,255,0.35)', 'rgba(19,19,23,0.8)'] as const} style={StyleSheet.absoluteFill} />
                  <View style={[s.rank, rank === 1 ? { backgroundColor: C.primaryContainer } : { backgroundColor: C.raised }]}>
                    <Text style={[s.label, { color: C.text, fontWeight: '700' }]}>{rank}</Text>
                  </View>
                  <View style={s.play}>
                    <MaterialIcons name="play-arrow" size={16} color={C.text} />
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between', paddingVertical: 2 }}>
                  <View>
                    <Text style={s.clipTitle} numberOfLines={2}>
                      {p.title || 'Untitled clip'}
                    </Text>
                    <Text style={[s.caption, { marginTop: 4 }]}>
                      {p.published_at ? shortDate(p.published_at) : 'Not published'} • {(p.distributions ?? []).length || 1} channels
                    </Text>
                  </View>
                  <View style={{ gap: 6, paddingTop: 4 }}>
                    <View style={s.rowBetween}>
                      <View style={s.baseline}>
                        <Text style={s.headline}>{formatCount(tt.views)}</Text>
                        <Text style={[s.caption, { marginLeft: 4 }]}>total views</Text>
                      </View>
                    </View>
                    <View style={s.legendHead}>
                      <MaterialIcons name="trending-up" size={14} color={C.success} />
                      <Text style={[s.label, { color: C.success, marginLeft: 2 }]}>{eng.toFixed(1)}% engagement</Text>
                    </View>
                    <View style={s.pills}>
                      {([['tt', v('tiktok')], ['yt', v('youtube')], ['ig', v('instagram')]] as const).map(([k, val]) => (
                        <View key={k} style={s.miniPill}>
                          <View style={[s.miniDot, { backgroundColor: k === 'tt' ? C.cyan : k === 'yt' ? C.youtube : C.igMid }]} />
                          <Text style={s.caption}>{val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}

          <AnimatedPressable style={s.cta} onPress={() => router.push('/posts' as never)}>
            <MaterialIcons name="analytics" size={19} color={C.primary} />
            <Text style={s.labelMd}>View Full Video Breakdown</Text>
          </AnimatedPressable>
        </ScrollView>
      </SafeAreaView>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110, gap: 16 },
  appBar: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.18 },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  h1: { color: C.text, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.36 },
  caption: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: C.high,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodText: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  shareBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.high, alignItems: 'center', justifyContent: 'center' },
  popover: { alignSelf: 'flex-end', width: 176, borderRadius: 12, backgroundColor: C.raised, padding: 6, gap: 4, marginTop: -8 },
  popItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartMsg: { position: 'absolute', left: 0, right: 0, top: 30, zIndex: 2 },
  chipsWrap: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 6, paddingVertical: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  card: { borderRadius: 16, backgroundColor: C.surface },
  glow: { position: 'absolute', top: -48, right: -48, width: 192, height: 192, borderRadius: 96, backgroundColor: 'rgba(148,125,255,0.1)' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  label: { color: C.muted, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.24 },
  labelMd: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.14 },
  headline: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.18 },
  statXl: { color: C.text, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.08 },
  statLg: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.56 },
  growth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(40,199,111,0.15)',
  },
  chartBox: { height: CHART_H, marginTop: 4, justifyContent: 'flex-end' },
  peakLine: { position: 'absolute', top: 14, bottom: 0, width: 1, backgroundColor: 'rgba(148,125,255,0.8)' },
  peakAnchor: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  peakHalo: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(148,125,255,0.3)' },
  peakDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.text, borderWidth: 2.5, borderColor: C.secondaryContainer },
  tooltip: {
    position: 'absolute',
    top: -4,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: C.raised,
  },
  pingWrap: { width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  pingRing: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  pingCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  legend: { flexDirection: 'row', gap: 8, paddingTop: 8, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  boost: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  boostBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  boostIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(148,125,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  tertiaryPill: { paddingHorizontal: 6, borderRadius: 4, backgroundColor: 'rgba(255,183,128,0.2)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { width: '48%', flexGrow: 1, padding: 14 },
  kpiIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.high, alignItems: 'center', justifyContent: 'center' },
  deltaPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(40,199,111,0.1)' },
  spark: { height: 28, marginTop: 8, flexDirection: 'row', alignItems: 'flex-end' },
  track: { width: '100%', height: 10, borderRadius: 5, backgroundColor: C.high, overflow: 'hidden', flexDirection: 'row' },
  topPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.high },
  clip: { padding: 12, flexDirection: 'row', gap: 12 },
  thumb: { width: 80, height: 112, borderRadius: 12, backgroundColor: C.high, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(19,19,23,0.3)' },
  rank: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  play: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(22,22,29,0.8)', alignItems: 'center', justifyContent: 'center' },
  dur: { position: 'absolute', bottom: 4, right: 4, color: C.text, fontSize: 10, backgroundColor: 'rgba(19,19,23,0.8)', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  clipTitle: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.high },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  cta: { height: 48, borderRadius: 12, backgroundColor: C.high, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface },
  nav: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabDot: { position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: C.primaryContainer },
});
