import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
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

const AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD05nthWKn36NBvj5vUwBxW_v7q2cGEXrWGS8TuQQK-uheJKVzk7YLL6T4qnrqUeEA9CINgZP-ub9WLuuNsvRfHqkMBlAzAv-Ftgs32saNCEnteIJQJEkvkQeuNJTWcD22bfI5XQLJt0VvAmU9wMbHhg9EO0pC704BwIDjlGogbx-nwGkW_AafINQlWYEZxuYrsm_LTdeK5Fvp7p4Hgm9MRs15G6lXN3r8d0bcQtvDC6kQMWoC_mQdqnA';

const posts = [
  {
    title: '5 productivity tools that felt illegal to know 🚀',
    sub: 'Stop doing manual data entry in 2024...',
    dur: '0:42',
    ago: 'Syndicated 2d ago',
    tt: '1.2M',
    yt: '780K',
    ig: '420K',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMlxr3jPuJSCsRK9nFmr3WEzGMZq2lFSdjQZyVeoxgkyvoBeTfgssCkLiIsgtm-hl4OSco6NuOR5tkpeJeZ4moTogV4SYjxVoAr396YarT4kUlWx0FF-lZoGohlTZvF2Bb-x8K9aHHmgA6R4s_lxENIYQ0JUt9L4OyEM6rriMV9dj7PStjEEdR9PwEC7EroujojCBl-vAnEirhy9ppfxRoaFZkHFHHJVfYfIstVhoFJc1NHwfuBWUFzQ',
  },
  {
    title: 'Why 99% of podcasts fail in their first 3 episodes',
    sub: "Here's the distribution breakdown...",
    dur: '0:35',
    ago: 'Syndicated 4d ago',
    tt: '450K',
    yt: '290K',
    ig: '185K',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOlzQQl2G0MOpCTWFgbzZjWPAItAU2Nyi3pg98CNDj9grzlbtCd3Ga1eCyWbEUCsyrVwRK1J4neAuMoejhcqkCfG_rjSHf-4wDTdZWkGGanAZN4WblRvjyaCZ0HI6lR3nF2ahU4z8BwBpbiHHKCJLnVbrVREllfiyx6n0YDU_4-tnmt8oUwx64rcn-1cF03EpS3LuCyy5rTVEBH6HAmaai3_oHssB8utwMIsUPL5NvnYkybZL5Br2YsQ',
  },
  {
    title: 'My entire content workflow automated in 10 mins',
    sub: 'Setup guide for multi-channel syndication...',
    dur: '0:58',
    ago: 'Syndicated 6d ago',
    tt: '310K',
    yt: '160K',
    ig: '95K',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdtCvxGTKJCOI5XcEGshxH6ypEn6myKq_OOcTh7GiAMdIsODMUKXa7n99szajCrsEPg47MesrZ04CEX0Y1r_U2GIULn59PmtkOogUnInoIs--9gDHPjP3wdCcdipM_luaymiYjfHrDZ2Egk5i94P9FwyCTabgJsyd7f6Cz9DmtKz3lv9CWEDG6d3UdCUJQgnbEnk6MckfX4wiuOudrxC8JYY7gAIQZlepP-1spVCXjSzugyT1fhXUR1Q',
  },
] as const;

const tabs = [
  { key: 'home', label: 'Home', icon: 'dashboard', href: '/dashboard' },
  { key: 'posts', label: 'Posts', icon: 'movie', href: '/posts' },
  { key: 'connect', label: 'Connect', icon: 'sync-alt', href: '/connect' },
  { key: 'insights', label: 'Insights', icon: 'insights', href: '/insights' },
  { key: 'profile', label: 'Profile', icon: 'account-circle', href: '/profile' },
] as const;

const ranges = ['7d', '30d', '90d'] as const;
const axis = ['Oct 01', 'Oct 08', 'Oct 16', 'Oct 24', 'Oct 30'] as const;

// Chart geometry: the design's exact 340x160 viewBox and path data.
const VW = 340;
const VH = 160;
const LINE_D = 'M0,135 C30,130 50,110 80,105 C110,100 130,115 160,85 C190,55 210,65 240,24 C270,55 310,40 340,30';
const AREA_D = `${LINE_D} L340,160 L0,160 Z`;
const LINE_LEN = 420;
const AnimatedPath = Animated.createAnimatedComponent(Path);

function Stat({ label, badge, icon, value, unit, children }: { label: string; badge?: string; icon?: 'electric-bolt'; value: string; unit: string; children?: React.ReactNode }) {
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
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<(typeof ranges)[number]>('30d');
  const [chartW, setChartW] = useState(0);

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
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: LINE_LEN * (1 - reveal.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (reveal.value - 0.55) / 0.45)) }));
  const popStyle = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ translateY: (1 - pop.value) * 6 }] }));
  const b0 = useAnimatedStyle(() => ({ opacity: bars[0].value, transform: [{ scaleX: 0.4 + 0.6 * bars[0].value }] }));
  const b1 = useAnimatedStyle(() => ({ opacity: bars[1].value, transform: [{ scaleX: 0.4 + 0.6 * bars[1].value }] }));
  const b2 = useAnimatedStyle(() => ({ opacity: bars[2].value, transform: [{ scaleX: 0.4 + 0.6 * bars[2].value }] }));
  const barStyles = [b0, b1, b2];

  const chartH = 144;
  const sx = chartW / VW;
  const sy = chartH / VH;
  const hx = 240 * sx;
  const hy = 24 * sy;

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
              <Image source={{ uri: AVATAR }} style={s.avatar} />
              <View style={s.online}>
                <View style={s.onlineIn} />
              </View>
            </View>
            <View style={s.flex}>
              <View style={s.nameRow}>
                <Text numberOfLines={2} style={s.name}>Good morning, Alex</Text>
                <Text style={s.wave}>👋</Text>
              </View>
              <Text style={s.handle}>@alexcreates • Pro Tier</Text>
            </View>
          </View>
          <View style={s.sync}>
            <Animated.View style={[s.syncDot, pulseStyle]} />
            <Text style={s.syncText}>Auto-sync{'\n'}active</Text>
          </View>
        </View>

        {/* Metrics */}
        <View style={s.grid}>
          <Stat label="Total Views" badge="14.2%" value="2.4M" unit="views" />
          <Stat label="Total Likes" badge="8.5%" value="385K" unit="likes" />
          <Stat label="Published" icon="electric-bolt" value="48" unit="clips" />
          <Stat label="Connected" value="3 of 3" unit="hubs">
            <View style={s.dots}>
              <View style={[s.dotC, { backgroundColor: C.cyan }]} />
              <View style={[s.dotC, s.dotOverlap, { backgroundColor: C.youtube }]} />
              <View style={[s.dotC, s.dotOverlap, { backgroundColor: C.igMid }]} />
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
                    <AnimatedPath d={AREA_D} fill="url(#dashPerfFill)" animatedProps={areaProps} />
                    <AnimatedPath
                      d={LINE_D}
                      fill="none"
                      stroke={C.primary}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray={LINE_LEN}
                      animatedProps={lineProps}
                    />
                  </Svg>
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
                        <Text style={s.tipText}>Oct 24 • 142.5K views</Text>
                      </View>
                    </View>
                  </Animated.View>
                </>
              )}
            </View>
            <View style={s.axis}>
              {axis.map((a, i) => (
                <Text key={a} style={[s.axisText, i === 3 && s.axisOn]}>{a}</Text>
              ))}
            </View>
          </View>
        </View>

        {/* Top posts */}
        <View style={s.postsSec}>
          <View style={s.postsHead}>
            <View style={s.titleRow}>
              <Text style={s.h2}>Top Posts</Text>
              <Text style={s.active}>3 active</Text>
            </View>
            <Pressable style={s.viewAll} onPress={() => router.push('/posts' as never)}>
              <Text style={s.viewAllText}>View all</Text>
              <MaterialIcons name="chevron-right" size={16} color={C.primary} />
            </Pressable>
          </View>

          {posts.map((p) => (
            <View style={s.post} key={p.title}>
              <View style={s.postTop}>
                <View style={s.thumb}>
                  <Image source={{ uri: p.img }} style={s.thumbImg} />
                  <LinearGradient colors={['#13131700', '#131317CC'] as const} style={StyleSheet.absoluteFill} />
                  <View style={s.playWrap}>
                    <View style={s.play}>
                      <MaterialIcons name="play-arrow" size={14} color={C.text} />
                    </View>
                  </View>
                  <Text style={s.dur}>{p.dur}</Text>
                </View>
                <View style={s.postBody}>
                  <View>
                    <View style={s.postTitleRow}>
                      <Text numberOfLines={2} style={s.postTitle}>{p.title}</Text>
                      <Text style={s.published}>Published</Text>
                    </View>
                    <Text numberOfLines={1} style={s.postSub}>{p.sub}</Text>
                  </View>
                  <Text style={s.ago}>{p.ago}</Text>
                </View>
              </View>
              <View style={s.dist}>
                {(
                  [
                    ['TIKTOK', p.tt, C.cyan],
                    ['SHORTS', p.yt, C.youtube],
                    ['REELS', p.ig, C.igMid],
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
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom tab bar */}
      <SafeAreaView style={s.nav}>
        <View style={s.navRow}>
          {tabs.map((t) => {
            const on = t.key === 'home';
            return (
              <Pressable
                key={t.key}
                style={({ pressed }) => [s.tab, pressed && s.press]}
                onPress={() => (on ? undefined : router.replace(t.href as never))}
              >
                <MaterialIcons name={t.icon} size={24} color={on ? C.primaryContainer : C.muted} />
                <Text style={[s.tabText, { color: on ? C.primaryContainer : C.muted }]}>{t.label}</Text>
                {on && <View style={s.tabDot} />}
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
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
