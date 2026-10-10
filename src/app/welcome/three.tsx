import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  containerLow: '#1B1B1F',
  track: '#2A292E',
  inactive: '#353439',
  text: '#FFFFFF',
  subtle: '#C9C4D8',
  muted: '#A1A1AE',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  onPrimary: '#1C0062',
  success: '#28C76F',
  cyan: '#00F2EA',
  tiktokRed: '#FE2C55',
  youtube: '#FF0000',
  igStart: '#F58529',
  igMid: '#DD2A7B',
  igEnd: '#8134AF',
} as const;

const metrics = [
  ['Total Views', '1.2M', '+34%'],
  ['Watch Time', '840h', '+18%'],
  ['Likes', '184K', '+42%'],
] as const;

const checks = [
  ['Side-by-side platform metrics', 'Instant comparison without switching accounts'],
  ['Growth & viral spike alerts', 'Smart detection when a video starts trending fast'],
  ['Top performing hooks', 'Find out which opening 3 seconds drive retentions'],
] as const;

export default function WelcomeThree() {
  // "Step 3 of 3" dot pulse, realtime ping, staggered distribution-bar fills, CTA glow.
  const pulse = useSharedValue(1);
  const ping = useSharedValue(0);
  const glow = useSharedValue(0.4);
  const tk = useSharedValue(0);
  const yt = useSharedValue(0);
  const ig = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.3, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
    ping.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    glow.value = withRepeat(withTiming(0.75, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
    const fill = (v: typeof tk, to: number, delay: number) =>
      (v.value = withDelay(delay, withTiming(to, { duration: 1100, easing: Easing.out(Easing.cubic) })));
    fill(tk, 56, 250);
    fill(yt, 28, 400);
    fill(ig, 16, 550);
  }, [pulse, ping, glow, tk, yt, ig]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6 }));
  const pingStyle = useAnimatedStyle(() => ({ opacity: 0.75 * (1 - ping.value), transform: [{ scale: 1 + ping.value * 2 }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const tkStyle = useAnimatedStyle(() => ({ width: `${tk.value}%` }));
  const ytStyle = useAnimatedStyle(() => ({ width: `${yt.value}%` }));
  const igStyle = useAnimatedStyle(() => ({ width: `${ig.value}%` }));

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={s.top}>
          <Pressable style={({ pressed }) => [s.back, pressed && s.press]} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={C.text} />
          </Pressable>
          <View style={s.step}>
            <Animated.View style={[s.stepDot, dotStyle]} />
            <Text style={s.stepText}>Step 3 of 3</Text>
          </View>
          <Pressable style={s.skipWrap} onPress={() => router.replace('/login')}>
            <Text style={s.skip}>Skip</Text>
          </Pressable>
        </View>

        {/* Hero analytics card */}
        <View style={s.heroWrap}>
          <LinearGradient
            colors={['#CABEFF33', '#00F2EA26', '#DD2A7B33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.heroGlow}
          />
          <View style={s.card}>
            <LinearGradient colors={[C.cyan, C.primary, C.igMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accent} />

            <View style={s.feed}>
              <View style={s.feedName}>
                <View style={s.liveWrap}>
                  <Animated.View style={[s.pingRing, pingStyle]} />
                  <View style={s.liveDot} />
                </View>
                <Text style={s.feedText}>Unified Feed Realtime</Text>
              </View>
              <Text style={s.allPill}>All Channels Active</Text>
            </View>

            <View style={s.metrics}>
              {metrics.map(([name, num, growth]) => (
                <View style={s.metric} key={name}>
                  <Text numberOfLines={1} style={s.metricName}>{name}</Text>
                  <Text style={s.metricNum}>{num}</Text>
                  <View style={s.trend}>
                    <MaterialIcons name="trending-up" size={13} color={C.success} />
                    <Text style={s.growth}>{growth}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={s.dist}>
              <View style={s.distHead}>
                <Text style={s.distTitle}>Cross-Platform Distribution</Text>
                <Text style={s.distTime}>Past 7 Days</Text>
              </View>

              <Bar name="TikTok" value="680K views (56%)" dot={C.cyan} widthStyle={tkStyle} colors={[C.cyan, C.tiktokRed]} />
              <Bar name="YouTube Shorts" value="340K views (28%)" dot={C.youtube} widthStyle={ytStyle} colors={[C.youtube, C.youtube]} />
              <Bar name="Instagram Reels" value="194K views (16%)" dot={C.igMid} widthStyle={igStyle} colors={[C.igStart, C.igMid, C.igEnd]} last />
            </View>
          </View>
        </View>

        {/* Value prop */}
        <View style={s.copy}>
          <Text style={s.title}>Unified Insights at a Single Glance.</Text>
          <Text style={s.desc}>Compare views, watch time, likes, and engagement across all channels in one consolidated creator dashboard.</Text>
        </View>

        {/* Checklist */}
        <View style={s.checks}>
          {checks.map(([title, detail]) => (
            <View style={s.check} key={title}>
              <View style={s.checkIcon}>
                <MaterialIcons name="check" size={18} color={C.primary} />
              </View>
              <View style={s.checkCopy}>
                <Text style={s.checkTitle}>{title}</Text>
                <Text style={s.checkDetail}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.dots}>
            <View style={s.dot} />
            <View style={s.dot} />
            <View style={s.active} />
          </View>
          <View style={s.ctaWrap}>
            <Animated.View style={[s.ctaGlow, glowStyle]}>
              <LinearGradient colors={[C.primary, '#E1B6FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Pressable style={({ pressed }) => [s.cta, pressed && s.pressCta]} onPress={() => router.replace('/login')}>
              <LinearGradient colors={[C.primary, C.primaryContainer]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, s.ctaFill]} />
              <Text style={s.ctaText}>Get Started</Text>
              <MaterialIcons name="arrow-forward" size={20} color={C.onPrimary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bar({ name, value, dot, widthStyle, colors, last }: { name: string; value: string; dot: string; widthStyle: any; colors: readonly [string, string, ...string[]]; last?: boolean }) {
  return (
    <View style={[s.barBlock, last && { marginBottom: 0 }]}>
      <View style={s.barLabels}>
        <View style={s.barName}>
          <View style={[s.platformDot, { backgroundColor: dot }]} />
          <Text style={s.nameText}>{name}</Text>
        </View>
        <Text style={s.barValue}>{value}</Text>
      </View>
      <View style={s.barTrack}>
        <Animated.View style={[s.barFill, widthStyle]}>
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.containerLow, alignItems: 'center', justifyContent: 'center' },
  press: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#1F1F23' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  stepText: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  skipWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skip: { color: C.muted, fontSize: 12, fontWeight: '600' },

  heroWrap: { position: 'relative', marginVertical: 16 },
  heroGlow: { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 24, opacity: 0.6 },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16, overflow: 'hidden' },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },

  feed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 8 },
  feedName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pingRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: C.success },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.success },
  feedText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  allPill: { color: C.primary, backgroundColor: '#CABEFF1A', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 13, fontWeight: '500' },

  metrics: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  metric: { flex: 1, backgroundColor: C.raised, borderRadius: 12, padding: 10 },
  metricName: { color: C.muted, fontSize: 13 },
  metricNum: { color: C.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  growth: { color: C.success, fontSize: 12, fontWeight: '600' },

  dist: { backgroundColor: C.containerLow, borderRadius: 12, padding: 12, marginTop: 8 },
  distHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  distTitle: { color: C.muted, fontSize: 12, fontWeight: '600' },
  distTime: { color: C.muted, fontSize: 13 },
  barBlock: { marginBottom: 10 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  platformDot: { width: 8, height: 8, borderRadius: 4 },
  nameText: { color: C.text, fontSize: 13, fontWeight: '500' },
  barValue: { color: C.text, fontSize: 13, fontWeight: '600' },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: C.track, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, overflow: 'hidden' },

  copy: { marginTop: 8 },
  title: { color: C.text, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  desc: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },

  checks: { gap: 10, marginTop: 16 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 12, padding: 12 },
  checkIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CABEFF26' },
  checkCopy: { flex: 1 },
  checkTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  checkDetail: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },

  footer: { marginTop: 'auto', paddingTop: 16, gap: 20 },
  dots: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.inactive },
  active: { width: 24, height: 8, borderRadius: 4, backgroundColor: C.primary },
  ctaWrap: { position: 'relative' },
  ctaGlow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 14, overflow: 'hidden' },
  cta: { height: 48, borderRadius: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaFill: { borderRadius: 12 },
  pressCta: { opacity: 0.95, transform: [{ scale: 0.98 }] },
  ctaText: { color: C.onPrimary, fontSize: 18, fontWeight: '700' },
});
