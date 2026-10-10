import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
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

// ---- Chart data: exact path data from the design's 340x160 viewBox ----
const CHART_H = 176;
const PEAK_X = 270;
const PRIMARY_D = 'M 0 120 C 35 105, 55 92, 85 88 C 120 82, 145 98, 175 70 C 210 42, 235 25, 270 14 C 300 5, 325 15, 340 12';
const TIKTOK_D = 'M 0 135 C 35 125, 60 110, 85 105 C 120 98, 145 115, 175 92 C 210 68, 235 55, 270 42 C 305 32, 325 38, 340 30';
const PRIMARY_AREA_D = `${PRIMARY_D} L 340 150 L 0 150 Z`;
const TIKTOK_AREA_D = `${TIKTOK_D} L 340 150 L 0 150 Z`;
const CURVE_LEN = 390;
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPARKS = {
  views: { color: C.primary, fill: C.primaryContainer, d: 'M0 24 L 20 18 L 40 22 L 60 12 L 80 15 L 100 4' },
  likes: { color: C.tiktokRed, fill: C.tiktokRed, d: 'M0 22 L 20 20 L 40 14 L 60 18 L 80 8 L 100 6' },
  comments: { color: C.warning, fill: C.warning, d: 'M0 26 L 25 21 L 50 16 L 75 19 L 100 5' },
  shares: { color: C.success, fill: C.success, d: 'M0 25 L 20 22 L 45 10 L 70 14 L 100 3' },
} as const;

const KPIS = [
  { key: 'views', icon: 'visibility', tint: C.primary, label: 'Total Views', value: '2.4M', delta: '+14.2%' },
  { key: 'likes', icon: 'favorite', tint: C.danger, label: 'Likes', value: '385K', delta: '+8.5%' },
  { key: 'comments', icon: 'forum', tint: C.warning, label: 'Comments', value: '14.8K', delta: '+19.1%' },
  { key: 'shares', icon: 'share', tint: C.success, label: 'Shares', value: '42.3K', delta: '+31.0%' },
] as const;

const CLIPS = [
  {
    rank: 1,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7WWlYlSg5dzfhlZs_w5-64A92dKEdKfnVSxOaNsaf8_Noa1ga6XKJINYegdi7idNkrdOYugNTBq9bzX1M-23l8zvLhNqZsMq2vudVb5ABMsbWEEZJeAeTozNJV3t7PGUnCVn_2Ep4MMOiH-hukP8d-8bDuEVyHpetL7ji6bNa3KKvAABKH-c8k9SS-wu_931w17iMriLfiB1P4R9bT16_cDaHUmzD1qTKTcs63x8WQKXZLLM08WUnlw',
    dur: '0:42',
    title: '5 productivity tools that felt illegal to know before this...',
    meta: 'Oct 18 • Automated syndication',
    views: '1.2M',
    retention: '94%',
    tt: '680K',
    yt: '340K',
    ig: '180K',
  },
  {
    rank: 2,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcPLf_b2O0IzhMAQt8kdWKv7po7imgbmIqKFsohjaVBcVUc4QvNhjwC7Dn5pC6YK2esIk2DOG8diSFoqUItwsl0vEK_XW0kaF7Ll5MyzlrbUGqdn_VBS_G5OSqijwNTfH16UVjUy1HmkaACl0wlVV0l9Zrn6KEv_Q7x8ZLWErxkI4b2DmjBF4MMjWWM9H9BHzXGHRvORV8KfbDogo82qomVfrLQryNFY7NZiBa_PHRfJP82BExIbGFpQ',
    dur: '0:58',
    title: 'How I automated my entire content stack with one server script',
    meta: 'Oct 24 • AI Captions + Soundsync',
    views: '740K',
    retention: '81%',
    tt: '410K',
    yt: '220K',
    ig: '110K',
  },
  {
    rank: 3,
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDx9TK2EGklOSic4przETswe5zk5beXHgD_MhHJPDml4ECIMl6XE98wygal4zaVqRkagN9unH_W1nAfoNe0upRNj3NueoRIwMLjCD0Ir0AlIreb3iisxQF9c64FIWuwgYSDPFWXs3Ay85hzwPcHjCLjhzMNcIJSmTeQ5jysfaUpeTEFxwsokA4QDAQnUJCtUJzyYgCKgI0lGLOQn-CdURZYIfAL9SZ1Ektcm820nLx-naTwbE_0EjKfKw',
    dur: '0:35',
    title: 'Why 99% of podcasts fail in their first 3 episodes (and the fix)',
    meta: 'Oct 12 • Smart hook reframe',
    views: '460K',
    retention: '76%',
    tt: '190K',
    yt: '185K',
    ig: '85K',
  },
] as const;

const PLATFORMS = ['All Platforms', 'TikTok', 'YouTube', 'Instagram'] as const;
type Platform = (typeof PLATFORMS)[number];

const TABS = [
  { label: 'Home', icon: 'dashboard', route: '/dashboard' },
  { label: 'Posts', icon: 'movie', route: '/posts' },
  { label: 'Connect', icon: 'sync-alt', route: '/connect' },
  { label: 'Insights', icon: 'show-chart', route: '/insights' },
  { label: 'Profile', icon: 'account-circle', route: '/profile' },
] as const;

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
  const [period, setPeriod] = useState('Last 30 Days');

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
  const primaryLineProps = useAnimatedProps(() => ({ strokeDashoffset: CURVE_LEN * (1 - chart.value) }));
  const tiktokLineProps = useAnimatedProps(() => ({ strokeDashoffset: CURVE_LEN * (1 - chart.value) }));
  const primaryAreaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (chart.value - 0.55) / 0.45)) }));
  const tiktokAreaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (chart.value - 0.45) / 0.45)) }));
  const barW = (pct: number) => useAnimatedStyle(() => ({ width: `${pct * bars.value}%` })); // eslint-disable-line react-hooks/rules-of-hooks
  const wTT = barW(52);
  const wYT = barW(31);
  const wIG = barW(17);

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
              <Text style={s.caption}>Oct 1 – Oct 30 • 30-Day Aggregation</Text>
            </View>
            <View style={s.headActions}>
              <Pressable style={s.periodBtn} onPress={() => setPeriodOpen((v) => !v)}>
                <MaterialIcons name="calendar-today" size={17} color={C.primary} />
                <Text style={s.periodText}>{period}</Text>
                <MaterialIcons name="expand-more" size={18} color={C.muted} />
              </Pressable>
              <Pressable style={s.shareBtn}>
                <MaterialIcons name="ios-share" size={19} color={C.muted} />
              </Pressable>
            </View>
          </View>
          {periodOpen ? (
            <View style={s.popover}>
              {['Last 30 Days', 'Last 7 Days', 'This Quarter (Q4)', 'Custom Range...'].map((p) => {
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
                  <Text style={s.statXl}>2.4M</Text>
                  <Text style={[s.caption, { marginLeft: 8 }]}>Views</Text>
                </View>
              </View>
              <View style={s.growth}>
                <MaterialIcons name="trending-up" size={15} color={C.success} />
                <Text style={[s.label, { color: C.success }]}>+28.4%</Text>
              </View>
            </View>

            <View style={s.chartBox}>
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
                <AnimatedPath d={TIKTOK_AREA_D} fill="url(#insReachTikTok)" animatedProps={tiktokAreaProps} />
                <AnimatedPath
                  d={TIKTOK_D}
                  fill="none"
                  stroke="#00F2EA"
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  strokeDasharray={CURVE_LEN}
                  animatedProps={tiktokLineProps}
                />
                <AnimatedPath d={PRIMARY_AREA_D} fill="url(#insReachPrimary)" animatedProps={primaryAreaProps} />
                <AnimatedPath
                  d={PRIMARY_D}
                  fill="none"
                  stroke={C.primary}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeDasharray={CURVE_LEN}
                  animatedProps={primaryLineProps}
                />
              </Svg>
              {/* Peak marker */}
              <View style={[s.peakLine, { left: `${(PEAK_X / 340) * 100}%` }]} />
              <View style={[s.peakAnchor, { left: `${(PEAK_X / 340) * 100}%`, top: ((14 / 160) * CHART_H) - 1 }]}>
                <Animated.View style={[s.peakHalo, haloStyle]} />
                <View style={s.peakDot} />
              </View>
              <View style={s.tooltip}>
                <View style={s.pingWrap}>
                  <Animated.View style={[s.pingRing, pingStyle]} />
                  <View style={s.pingCore} />
                </View>
                <Text style={[s.label, { color: C.text }]}>Oct 24</Text>
                <Text style={s.caption}>•</Text>
                <Text style={[s.label, { color: C.primary, fontWeight: '700' }]}>142.5K</Text>
              </View>
            </View>

            <View style={[s.rowBetween, { paddingHorizontal: 4 }]}>
              {['Oct 1', 'Oct 8', 'Oct 15', 'Oct 24', 'Oct 30'].map((d) => (
                <Text key={d} style={[s.caption, d === 'Oct 24' ? { color: C.primary, fontWeight: '600' } : null]}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={s.legend}>
              {(
                [
                  ['tt', 'TikTok', '52%', '1.25M'],
                  ['yt', 'Shorts', '31%', '744K'],
                  ['ig', 'Reels', '17%', '408K'],
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
          <View style={[s.card, s.boost]}>
            <LinearGradient colors={[C.primary, C.secondaryContainer] as const} style={s.boostBar} />
            <View style={s.boostIcon}>
              <MaterialIcons name="rocket-launch" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.legendHead}>
                <Text style={[s.labelMd, { fontWeight: '700' }]}>3.1x Cross-Post Boost</Text>
                <View style={s.tertiaryPill}>
                  <Text style={[s.label, { color: C.tertiary }]}>+210%</Text>
                </View>
              </View>
              <Text style={[s.caption, { marginTop: 2 }]} numberOfLines={1}>
                Auto-syndicating unlocked 1.66M extra views from 1 single master file.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.muted} />
          </View>

          {/* KPI grid */}
          <View style={s.grid}>
            {KPIS.map((k) => {
              const sp = SPARKS[k.key];
              return (
                <View key={k.key} style={[s.card, s.kpi]}>
                  <View style={s.rowBetween}>
                    <View style={s.kpiIcon}>
                      <MaterialIcons name={k.icon} size={18} color={k.tint} />
                    </View>
                    <View style={s.deltaPill}>
                      <Text style={[s.label, { color: C.success }]}>{k.delta} ↑</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Text style={[s.label, { color: C.muted }]}>{k.label}</Text>
                    <Text style={s.statLg}>{k.value}</Text>
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
                <Text style={[s.labelMd, { marginLeft: 4 }]}>Avg. Watch Completion</Text>
              </View>
              <Text style={[s.labelMd, { fontWeight: '700' }]}>78.4%</Text>
            </View>
            <View style={s.track}>
              <Animated.View style={[{ height: '100%', backgroundColor: C.cyan }, wTT]} />
              <Animated.View style={[{ height: '100%', backgroundColor: C.youtube }, wYT]} />
              <Animated.View style={[{ height: '100%', overflow: 'hidden' }, wIG]}>
                <LinearGradient colors={[C.igStart, C.igMid] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
            <View style={s.rowBetween}>
              <Text style={s.caption}>TikTok benchmark: 82%</Text>
              <Text style={s.caption}>Reels benchmark: 71%</Text>
            </View>
          </View>

          {/* Top clips */}
          <View style={[s.rowBetween, { marginTop: 4 }]}>
            <View style={s.legendHead}>
              <Text style={s.headline}>Top Performing Clips</Text>
              <View style={s.topPill}>
                <Text style={[s.label, { color: C.primary }]}>3 Top</Text>
              </View>
            </View>
            <Pressable style={s.legendHead}>
              <Text style={[s.label, { color: C.muted }]}>By Views</Text>
              <MaterialIcons name="sort" size={16} color={C.muted} />
            </Pressable>
          </View>

          {CLIPS.map((c) => (
            <View key={c.rank} style={[s.card, s.clip]}>
              <View style={s.thumb}>
                <Image source={{ uri: c.img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={s.thumbShade} />
                <View style={[s.rank, c.rank === 1 ? { backgroundColor: C.primaryContainer } : { backgroundColor: C.raised }]}>
                  <Text style={[s.label, { color: C.text, fontWeight: '700' }]}>{c.rank}</Text>
                </View>
                <View style={s.play}>
                  <MaterialIcons name="play-arrow" size={16} color={C.text} />
                </View>
                <Text style={s.dur}>{c.dur}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between', paddingVertical: 2 }}>
                <View>
                  <Text style={s.clipTitle} numberOfLines={2}>
                    {c.title}
                  </Text>
                  <Text style={[s.caption, { marginTop: 4 }]}>{c.meta}</Text>
                </View>
                <View style={{ gap: 6, paddingTop: 4 }}>
                  <View style={s.rowBetween}>
                    <View style={s.baseline}>
                      <Text style={s.headline}>{c.views}</Text>
                      <Text style={[s.caption, { marginLeft: 4 }]}>total views</Text>
                    </View>
                  </View>
                  <View style={s.legendHead}>
                    <MaterialIcons name="trending-up" size={14} color={C.success} />
                    <Text style={[s.label, { color: C.success, marginLeft: 2 }]}>{c.retention} retention</Text>
                  </View>
                  <View style={s.pills}>
                    {([['tt', c.tt], ['yt', c.yt], ['ig', c.ig]] as const).map(([k, v]) => (
                      <View key={k} style={s.miniPill}>
                        <View style={[s.miniDot, { backgroundColor: k === 'tt' ? C.cyan : k === 'yt' ? C.youtube : C.igMid }]} />
                        <Text style={s.caption}>{v}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ))}

          <Pressable style={s.cta}>
            <MaterialIcons name="analytics" size={19} color={C.primary} />
            <Text style={s.labelMd}>View Full Video Breakdown</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom tab bar */}
      <SafeAreaView style={s.navWrap}>
        <View style={s.nav}>
          {TABS.map((t) => {
            const on = t.label === 'Insights';
            return (
              <Pressable key={t.label} style={s.tab} onPress={() => !on && router.push(t.route as never)}>
                <MaterialIcons name={t.icon} size={24} color={on ? C.primaryContainer : C.muted} />
                <Text style={[s.label, { marginTop: 2, color: on ? C.primaryContainer : C.muted }]}>{t.label}</Text>
                {on ? <View style={s.tabDot} /> : null}
              </Pressable>
            );
          })}
        </View>
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
