import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
} as const;

const PREVIEW =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCFQCYwzRIf8JH_BvZ0vSQb4U9y1mejyWt50gpR1mYwmN4GzZY0NQ_yCqsLdibQQUVJFO_hoiR5YoJfGg4irO_r_Pp-vicWAZZjH94jiguPNgjc4eH80xZ1BBrDDqkJr2JRS3jiXK3qeOROoBuVfpLEiCWU4ZOepU3FJLKmPlUDgwgCqVLCecSgUuRtaLAONWp4En3DtPuJbeqAeyR3kOF8OZ0Js1ldpV1DCjuOaCqKiymTyMw86cWfWQ';

const TABS = ['Aggregated', 'TikTok', 'YouTube', 'Reels'] as const;
type Tab = (typeof TABS)[number];

const hero = [
  ['Likes', '98.4K'],
  ['Comments', '3.8K'],
  ['Shares', '14.2K'],
  ['Watch Time', '412h'],
] as const;

const platforms = [
  { key: 'TikTok', name: 'TikTok (Master Original)', dot: C.cyan, note: 'Avg Watch: 41s', noteColor: C.muted, stats: ['1.2M', '88K', '4.1K', '18.3K'], dim: false },
  { key: 'YouTube', name: 'YouTube Shorts', dot: C.youtube, note: '38s (90% Ret.)', noteColor: C.success, stats: ['780K', '62K', '2.4K', '9.1K'], dim: false },
  { key: 'Reels', name: 'Instagram Reels', dot: C.igMid, note: '', noteColor: C.danger, stats: ['--', '--', '--', '--'], dim: true },
] as const;

// Sparkline: exact path data from the design's 320x32 viewBox.
const SPARK_D = 'M0 28 C 30 26, 60 20, 90 22 C 120 24, 150 12, 180 14 C 210 16, 240 6, 270 4 C 290 3, 310 1, 320 2';
const SPARK_AREA_D = `${SPARK_D} L 320 32 L 0 32 Z`;
const SPARK_LEN = 340;
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function PostDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  void id; // Sample content from the design is shown; id reserved for usePost wiring.

  const [tab, setTab] = useState<Tab>('Aggregated');
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState<'idle' | 'busy' | 'queued'>('idle');
  const [resync, setResync] = useState<'idle' | 'busy' | 'done'>('idle');

  const pulse = useSharedValue(1);
  const ping = useSharedValue(0);
  const spin = useSharedValue(0);
  const spinBtn = useSharedValue(0);
  const glow = useSharedValue(0.4);
  const bars = useSharedValue(0);
  const velocity = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
    ping.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
    spin.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false);
    glow.value = withRepeat(withTiming(0.8, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
    bars.value = withDelay(200, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    velocity.value = withDelay(500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [pulse, ping, spin, glow, bars, velocity]);

  useEffect(() => {
    spinBtn.value = 0;
    if (retry === 'busy' || resync === 'busy') {
      spinBtn.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, false);
    }
  }, [retry, resync, spinBtn]);

  const sparkLineProps = useAnimatedProps(() => ({ strokeDashoffset: SPARK_LEN * (1 - velocity.value) }));
  const sparkAreaProps = useAnimatedProps(() => ({ opacity: Math.min(1, Math.max(0, (velocity.value - 0.5) * 2)) }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.6 }));
  const pingStyle = useAnimatedStyle(() => ({ opacity: 0.75 * (1 - ping.value), transform: [{ scale: 1 + ping.value * 2 }] }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const spinBtnStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinBtn.value * 360}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const copy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const doRetry = () => {
    if (retry !== 'idle') return;
    setRetry('busy');
    setTimeout(() => setRetry('queued'), 1200);
  };
  const doResync = () => {
    if (resync !== 'idle') return;
    setResync('busy');
    setTimeout(() => {
      setResync('done');
      setTimeout(() => setResync('idle'), 2000);
    }, 1000);
  };

  const showTikTok = tab === 'Aggregated' || tab === 'TikTok';
  const showYouTube = tab === 'Aggregated' || tab === 'YouTube';
  const showReels = tab === 'Aggregated' || tab === 'Reels';

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
          <Pressable accessibilityLabel="Share post" style={({ pressed }) => [s.iconBtn, pressed && s.press]}>
            <MaterialIcons name="share" size={22} color={C.muted} />
          </Pressable>
          <Pressable accessibilityLabel="More options" style={({ pressed }) => [s.iconBtn, pressed && s.press]}>
            <MaterialIcons name="more-vert" size={22} color={C.muted} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        {/* Video card */}
        <View style={s.glow} pointerEvents="none" />
        <View style={s.videoCard}>
          <View style={s.stage}>
            <Image source={{ uri: PREVIEW }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['#0E0E1299', '#0E0E1200', '#0E0E12']} style={StyleSheet.absoluteFill} />
            <View style={s.badges}>
              <View style={s.badge}>
                <Animated.View style={[s.badgeDot, dotStyle]} />
                <Text style={s.badgeText}>@alexcreates</Text>
              </View>
              <View style={s.badge}>
                <MaterialIcons name="schedule" size={14} color={C.muted} />
                <Text style={s.badgeCaption}>2d ago</Text>
              </View>
            </View>
            <Pressable accessibilityLabel="Play master video preview" style={({ pressed }) => [s.play, pressed && s.press]}>
              <View style={s.playTint} />
              <MaterialIcons name="play-arrow" size={32} color={C.primary} />
            </Pressable>
            <View style={s.stageBottom}>
              <Text style={s.time}>0:42</Text>
              <View style={s.res}>
                <MaterialIcons name="hd" size={13} color={C.cyan} />
                <Text style={s.resText}>1080p • 60fps</Text>
              </View>
            </View>
          </View>

          <View style={s.summary}>
            <View style={s.titleRow}>
              <Text style={s.title} numberOfLines={2}>5 productivity tools that felt illegal to know in 2024</Text>
              <Pressable accessibilityLabel="Copy caption" style={({ pressed }) => [s.copyBtn, pressed && s.press]} onPress={copy}>
                <MaterialIcons name={copied ? 'done' : 'content-copy'} size={18} color={copied ? C.success : C.muted} />
              </Pressable>
            </View>
            <Text style={s.caption}>
              Stop doing manual data entry in your workflows and let sync pipelines do the heavy lifting. Full breakdown of tools linked in bio! ⚡
            </Text>
            <Text style={s.tags}>#tech #ai #automation #productivity</Text>

            <View style={s.source}>
              <View style={s.sourceLeft}>
                <View style={s.sourceAvatar}>
                  <Text style={s.sourceTk}>Tk</Text>
                </View>
                <View>
                  <Text style={s.sourceTitle}>Master Source: TikTok</Text>
                  <Text style={s.sourceSub}>Clean sync • No watermark</Text>
                </View>
              </View>
              <View style={s.sourceRight}>
                <Text style={s.sourceNum}>142.8K</Text>
                <Text style={s.sourceSub}>source views</Text>
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
              <Text style={s.secNote}>• 2 Target Channels</Text>
            </View>
            <Pressable style={s.manage}>
              <MaterialIcons name="sync-alt" size={16} color={C.primary} />
              <Text style={s.manageText}>Manage Sync</Text>
            </Pressable>
          </View>

          {/* YouTube */}
          <View style={s.chCard}>
            <View style={s.chRow}>
              <View style={s.chLeft}>
                <View style={[s.chIcon, { backgroundColor: C.raised }]}>
                  <FontAwesome5 name="youtube" size={18} color={C.youtube} />
                </View>
                <View>
                  <View style={s.chNameRow}>
                    <Text style={s.chName}>YouTube Shorts</Text>
                    <MaterialIcons name="check-circle" size={14} color={C.success} />
                  </View>
                  <Text style={s.chSub}>Oct 24, 14:32 • ID: #yt-892f1a</Text>
                </View>
              </View>
              <View style={[s.pill, { backgroundColor: '#28C76F26' }]}>
                <View style={[s.pillDot, { backgroundColor: C.success }]} />
                <Text style={[s.pillText, { color: C.success }]}>Published</Text>
              </View>
            </View>
            <View style={s.chFoot}>
              <Text style={s.chSub}>Transcode: 1080x1920 • 60fps</Text>
              <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.press]}>
                <Text style={s.linkText}>Shorts Link</Text>
                <MaterialIcons name="north-east" size={15} color={C.muted} />
              </Pressable>
            </View>
          </View>

          {/* Instagram */}
          <View style={s.chCard}>
            <View style={s.chRow}>
              <View style={s.chLeft}>
                <LinearGradient colors={[C.igStart, C.igMid, C.igEnd]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={s.chIcon}>
                  <FontAwesome5 name="instagram" size={18} color={C.text} />
                </LinearGradient>
                <View>
                  <View style={s.chNameRow}>
                    <Text style={s.chName}>Instagram Reels</Text>
                    <MaterialIcons name="error-outline" size={14} color={C.danger} />
                  </View>
                  <Text style={s.chSub}>Scheduled attempt failed</Text>
                </View>
              </View>
              <View style={[s.pill, { backgroundColor: '#EA545526' }]}>
                <Animated.View style={[s.pillDot, { backgroundColor: C.danger }, dotStyle]} />
                <Text style={[s.pillText, { color: C.danger }]}>Failed</Text>
              </View>
            </View>
            <View style={s.diag}>
              <View style={s.diagRow}>
                <MaterialIcons name="warning-amber" size={18} color={C.danger} style={{ marginTop: 2 }} />
                <Text style={s.diagText}>
                  Token expired on Instagram Reels (Meta Graph API Error 190: OAuthException). Account permissions need refreshing.
                </Text>
              </View>
              <View style={s.diagBtns}>
                <Pressable
                  style={({ pressed }) => [s.retry, retry === 'queued' && { backgroundColor: C.warning }, pressed && s.press]}
                  onPress={doRetry}
                >
                  <Animated.View style={retry === 'busy' ? spinBtnStyle : undefined}>
                    <MaterialIcons name={retry === 'idle' ? 'replay' : retry === 'busy' ? 'refresh' : 'check'} size={16} color={retry === 'queued' ? C.bg : C.text} />
                  </Animated.View>
                  <Text style={[s.retryText, retry === 'queued' && { color: C.bg }]}>
                    {retry === 'idle' ? 'Retry Syndication' : retry === 'busy' ? 'Re-dispatching...' : 'Queued for Reels'}
                  </Text>
                </Pressable>
                <Pressable style={({ pressed }) => [s.reauth, pressed && s.press]}>
                  <MaterialIcons name="vpn-key" size={16} color={C.text} />
                  <Text style={s.retryText}>Re-authorize</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Analytics */}
        <View style={s.section}>
          <View style={s.secHead}>
            <View style={s.secTitleRow}>
              <View style={[s.secBar, { backgroundColor: C.primaryContainer }]} />
              <Text style={s.secTitle}>Cross-Platform Analytics</Text>
            </View>
            <View style={s.live}>
              <View style={s.liveWrap}>
                <Animated.View style={[s.liveRing, pingStyle]} />
                <View style={s.liveDot} />
              </View>
              <Text style={s.liveText}>Live Sync</Text>
            </View>
          </View>

          <View style={s.tabs}>
            {TABS.map((t) => (
              <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'Aggregated' && (
            <View style={s.heroCard}>
              <View style={s.heroGlow} />
              <View style={s.heroHead}>
                <Text style={s.heroLabel}>Combined Total Reach</Text>
                <View style={s.delta}>
                  <MaterialIcons name="trending-up" size={13} color={C.success} />
                  <Text style={s.deltaText}>+34.2% vs avg</Text>
                </View>
              </View>
              <View style={s.heroNumRow}>
                <Text style={s.heroNum}>1.2M</Text>
                <Text style={s.heroUnit}>Gross Views</Text>
              </View>
              <View style={s.cluster}>
                {hero.map(([label, val]) => (
                  <View key={label} style={s.clusterCell}>
                    <Text style={s.cap}>{label}</Text>
                    <Text style={s.clusterVal}>{val}</Text>
                  </View>
                ))}
              </View>
              <View style={s.velocity}>
                <View style={s.velHead}>
                  <Text style={s.cap}>Syndication Velocity</Text>
                  <Text style={s.cap}>1.8k views/hr</Text>
                </View>
                <View style={s.spark}>
                  <Svg width="100%" height={32} viewBox="0 0 320 32" preserveAspectRatio="none">
                    <AnimatedPath d={SPARK_AREA_D} fill={C.primary} fillOpacity={0.08} animatedProps={sparkAreaProps} />
                    <AnimatedPath
                      d={SPARK_D}
                      fill="none"
                      stroke={C.primary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeDasharray={SPARK_LEN}
                      animatedProps={sparkLineProps}
                    />
                  </Svg>
                </View>
              </View>
            </View>
          )}

          <View style={s.platList}>
            {platforms
              .filter((p) => (p.key === 'TikTok' ? showTikTok : p.key === 'YouTube' ? showYouTube : showReels))
              .map((p) => (
                <View key={p.key} style={[s.platCard, p.dim && { opacity: 0.85 }]}>
                  <View style={s.platHead}>
                    <View style={s.platName}>
                      <View style={[s.platDot, { backgroundColor: p.dot }]} />
                      <Text style={s.chName}>{p.name}</Text>
                    </View>
                    {p.key === 'Reels' ? (
                      <View style={s.syncBad}>
                        <MaterialIcons name="sync-problem" size={13} color={C.danger} />
                        <Text style={s.syncBadText}>Sync Incomplete</Text>
                      </View>
                    ) : (
                      <Text style={[s.platNote, { color: p.noteColor }]}>{p.note}</Text>
                    )}
                  </View>
                  <View style={s.statGrid}>
                    {['Views', 'Likes', 'Comments', 'Shares'].map((label, i) => (
                      <View key={label} style={s.statCell}>
                        <Text style={s.cap}>{label}</Text>
                        <Text style={[s.statVal, p.dim && { color: C.muted }]}>{p.stats[i]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
          </View>
        </View>

        {/* Sync heartbeat */}
        <View style={s.heartbeat}>
          <View style={s.hbLeft}>
            <Animated.View style={spinStyle}>
              <MaterialIcons name="autorenew" size={15} color={C.primary} />
            </Animated.View>
            <Text style={s.cap}>Last synced: Just now</Text>
          </View>
          <Text style={s.cap}>Auto-refreshes every 15m</Text>
        </View>
      </ScrollView>

      {/* Bottom dock */}
      <View style={s.dock}>
        <Pressable style={({ pressed }) => [s.editBtn, pressed && s.press]}>
          <MaterialIcons name="edit-note" size={18} color={C.text} />
          <Text style={s.dockText}>Edit Caption</Text>
        </Pressable>
        <View style={s.resyncWrap}>
          <Animated.View style={[s.resyncGlow, glowStyle]} />
          <Pressable style={({ pressed }) => [s.resync, pressed && s.pressCta]} onPress={doResync}>
            <LinearGradient colors={[C.primary, C.primaryContainer]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Animated.View style={resync === 'busy' ? spinBtnStyle : undefined}>
              <MaterialIcons name={resync === 'done' ? 'done-all' : 'sync'} size={19} color={C.onPrimaryFixed} />
            </Animated.View>
            <Text style={s.resyncText}>{resync === 'done' ? 'Pipelines Synced!' : 'Re-sync All Channels'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
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
