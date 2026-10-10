import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePosts } from '@/api/hooks';
import type { Post as ApiPost, Platform } from '@/api/types';
import { AnimatedPressable, BounceIcon, InlineMessage, Skeleton } from '@/components/ui-kit';
import { captionBody, hashtagsOf, latestAnalytic, postStatus, timeAgo } from '@/components/post-utils';
import { formatCount } from '@/lib/format';

// Kinetic Obsidian tokens (see "post page step 6/DESIGN.md")
const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  containerLow: '#1B1B1F',
  containerHigh: '#2A292E',
  border: '#2A2A36',
  text: '#FFFFFF',
  muted: '#A1A1AE',
  outline: '#938EA1',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  violet: '#7C5CFF',
  violetEnd: '#B14CFF',
  onPrimary: '#1C0062',
  success: '#28C76F',
  warning: '#FF9F43',
  danger: '#EA5455',
  cyan: '#00F2EA',
  youtube: '#FF0000',
  igStart: '#F58529',
  igMid: '#DD2A7B',
  igEnd: '#8134AF',
} as const;

type MIcon = ComponentProps<typeof MaterialIcons>['name'];
type Status = 'published' | 'processing' | 'failed';
type Cell =
  | { kind: 'views'; value: string }
  | { kind: 'progress'; value: string }
  | { kind: 'queued' }
  | { kind: 'none' }
  | { kind: 'failed' };

interface Post {
  id: number;
  status: Status;
  thumbnail: string | null;
  meta: string;
  title: string;
  body: string;
  tags: string[];
  shorts: Cell;
  reels: Cell;
  retryMessage?: string;
}

function cellFor(p: ApiPost, platform: Platform): Cell {
  const d = (p.distributions ?? []).find((x) => x.platform === platform);
  if (!d) return { kind: 'none' };
  if (d.status === 'failed') return { kind: 'failed' };
  if (d.status === 'pending') return { kind: 'queued' };
  if (d.status === 'processing') return { kind: 'progress', value: 'Syncing' };
  const a = latestAnalytic(p, platform);
  return { kind: 'views', value: a ? formatCount(a.views) : 'Live' };
}

function toCard(p: ApiPost): Post {
  const failed = (p.distributions ?? []).find((x) => x.status === 'failed');
  return {
    id: p.id,
    status: postStatus(p),
    thumbnail: p.thumbnail ?? null,
    meta: `${timeAgo(p.published_at)} • Master TikTok`,
    title: p.title || 'Untitled clip',
    body: captionBody(p.caption),
    tags: hashtagsOf(p.caption).slice(0, 4),
    shorts: cellFor(p, 'youtube'),
    reels: cellFor(p, 'instagram'),
    retryMessage: failed ? failed.error_message || 'Syndication failed' : undefined,
  };
}

const FILTERS: { key: 'all' | Status; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'processing', label: 'Processing' },
  { key: 'failed', label: 'Failed' },
];

const TABS = [
  { key: 'home', label: 'Home', icon: 'dashboard', path: '/dashboard' },
  { key: 'posts', label: 'Posts', icon: 'movie', path: '/posts' },
  { key: 'connect', label: 'Connect', icon: 'sync-alt', path: '/connect' },
  { key: 'insights', label: 'Insights', icon: 'insights', path: '/insights' },
  { key: 'profile', label: 'Profile', icon: 'account-circle', path: '/profile' },
] as const;

export default function PostsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | Status>('all');
  const listQ = usePosts(filter);
  const allQ = usePosts('all');
  const visible = (listQ.data ?? []).map(toCard);
  const allCards = (allQ.data ?? []).map((p) => postStatus(p));
  const counts: Record<'all' | Status, number> = {
    all: allCards.length,
    published: allCards.filter((x) => x === 'published').length,
    processing: allCards.filter((x) => x === 'processing').length,
    failed: allCards.filter((x) => x === 'failed').length,
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView style={s.flex} edges={['top']}>
        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.brandRow}>
              <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logo}>
                <MaterialIcons name="videocam" size={20} color={C.text} />
              </LinearGradient>
              <Text style={s.screenTitle}>Posts</Text>
            </View>
            <View style={s.headerActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={({ pressed }) => [s.iconBtn, pressed && s.pressSoft]}>
                <MaterialIcons name="notifications" size={22} color={C.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Account" style={({ pressed }) => [s.avatar, pressed && s.pressSoft]}>
                <MaterialIcons name="person" size={20} color={C.text} />
              </Pressable>
            </View>
          </View>

          {/* Sub-header */}
          <View style={s.subHeader}>
            <View style={s.subTitleRow}>
              <Text style={s.subTitle}>All Activity</Text>
              <View style={s.countPill}>
                <Text style={s.countPillText}>{counts.all} {counts.all === 1 ? 'clip' : 'clips'}</Text>
              </View>
            </View>
            <View style={s.subActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Search clips" style={({ pressed }) => [s.iconBtnBordered, pressed && s.pressSoft]}>
                <MaterialIcons name="search" size={20} color={C.muted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Filter channels" style={({ pressed }) => [s.iconBtnBordered, pressed && s.pressSoft]}>
                <MaterialIcons name="tune" size={20} color={C.muted} />
              </Pressable>
            </View>
          </View>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {FILTERS.map((f) => (
              <FilterChip key={f.key} label={f.label} count={counts[f.key]} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>

          {/* Feed */}
          <View style={s.feed}>
            {listQ.isLoading ? (
              <>
                <Skeleton height={190} radius={20} />
                <Skeleton height={190} radius={20} />
              </>
            ) : listQ.isError && !listQ.data ? (
              <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load data" />
            ) : visible.length === 0 ? (
              <InlineMessage
                icon="movie"
                text={filter === 'all' ? 'No posts yet — new clips will appear here.' : 'No clips in this state yet.'}
              />
            ) : (
              visible.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <NewCrossPostFab bottomOffset={64 + insets.bottom + 16} />
      <TabBar bottomInset={insets.bottom} />
    </View>
  );
}

function FilterChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [s.chip, !active && s.chipIdle, pressed && s.pressSoft]}
    >
      {active ? <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, s.chipFill]} /> : null}
      <Text style={[s.chipLabel, active && s.chipLabelActive]}>{label}</Text>
      <View style={[s.chipCount, active && s.chipCountActive]}>
        <Text style={[s.chipCountText, active && s.chipCountTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function PostCard({ post }: { post: Post }) {
  const processing = post.status === 'processing';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={post.title}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(post.id) } })}
      style={({ pressed }) => [s.card, pressed && s.pressCard]}
    >
      <View style={s.cardTop}>
        <Thumbnail post={post} />

        <View style={s.info}>
          <View style={s.metaRow}>
            <View style={s.metaLeft}>
              {processing ? <PulseDot color={C.warning} /> : null}
              <Text style={[s.meta, processing && s.metaWarning]} numberOfLines={1}>
                {post.meta}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={8} style={s.moreBtn}>
              <MaterialIcons name="more-horiz" size={20} color={C.muted} />
            </Pressable>
          </View>
          <Text style={s.title} numberOfLines={3}>
            {post.title}
          </Text>
          <Text style={s.body} numberOfLines={2}>
            {post.body}
          </Text>
          <View style={s.tags}>
            {post.tags.map((tag) => (
              <Text key={tag} style={s.tag}>
                {tag}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* Syndication row */}
      <View style={s.synd}>
        <Destination label="TikTok" icon="music-note" iconColor={C.cyan} iconBg={C.raised}>
          <Pill tone="success" icon={<MaterialIcons name="check-circle" size={12} color={C.success} />} label="Imported" />
        </Destination>
        <View style={s.syndDivider} />
        <Destination label="Shorts" icon="ondemand-video" iconColor={C.youtube} iconBg="rgba(255,0,0,0.12)">
          <CellStatus cell={post.shorts} />
        </Destination>
        <View style={s.syndDivider} />
        <Destination label="Reels" icon="play-circle-outline" iconColor={C.text} gradient>
          <CellStatus cell={post.reels} />
        </Destination>
      </View>

      {post.retryMessage ? (
        <View style={s.retry}>
          <View style={s.retryMsg}>
            <MaterialIcons name="sync-problem" size={16} color={C.danger} />
            <Text style={s.retryText} numberOfLines={1}>
              {post.retryMessage}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry" style={({ pressed }) => [s.retryBtn, pressed && s.pressSoft]}>
            <MaterialIcons name="refresh" size={14} color={C.danger} />
            <Text style={s.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

function Thumbnail({ post }: { post: Post }) {
  const processing = post.status === 'processing';
  const failed = post.status === 'failed';
  const published = post.status === 'published';

  return (
    <View style={s.thumb}>
      {post.thumbnail ? <Image source={{ uri: post.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      <LinearGradient colors={['rgba(148,125,255,0.35)', 'rgba(0,0,0,0.6)'] as const} style={StyleSheet.absoluteFill} />
      {processing ? <BreathingOverlay /> : null}

      {published ? (
        <View style={s.playWrap}>
          <View style={s.playCircle}>
            <MaterialIcons name="play-arrow" size={20} color={C.text} />
          </View>
        </View>
      ) : null}

      {processing ? (
        <View style={s.syncBadge}>
          <PulseDot color={C.primary} size={6} />
          <Text style={s.syncText}>SYNCING</Text>
        </View>
      ) : null}

      {failed ? (
        <View style={s.alertBadge}>
          <MaterialIcons name="priority-high" size={16} color={C.text} />
        </View>
      ) : null}

    </View>
  );
}

function Destination({
  label,
  icon,
  iconColor,
  iconBg,
  gradient,
  children,
}: {
  label: string;
  icon: MIcon;
  iconColor: string;
  iconBg?: string;
  gradient?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={s.dest}>
      <View style={[s.destIcon, { backgroundColor: iconBg ?? C.raised }]}>
        {gradient ? (
          <LinearGradient
            colors={[C.igStart, C.igMid, C.igEnd] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <MaterialIcons name={icon} size={16} color={iconColor} />
      </View>
      <View style={s.destCopy}>
        <Text style={s.destLabel} numberOfLines={1}>
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
}

function CellStatus({ cell }: { cell: Cell }) {
  switch (cell.kind) {
    case 'views':
      return (
        <Pill
          tone="success"
          icon={<MaterialIcons name="visibility" size={12} color={C.success} />}
          label={cell.value}
        />
      );
    case 'progress':
      return (
        <Pill
          tone="warning"
          icon={<SpinningIcon name="autorenew" color={C.warning} />}
          label={cell.value}
        />
      );
    case 'none':
      return <Pill tone="warning" icon={<MaterialIcons name="remove" size={12} color={C.muted} />} label="—" />;
    case 'queued':
      return <Pill tone="warning" icon={<MaterialIcons name="schedule" size={12} color={C.warning} />} label="Queued" />;
    case 'failed':
      return <Pill tone="danger" icon={<MaterialIcons name="error" size={12} color={C.danger} />} label="Failed" />;
  }
}

function Pill({ tone, icon, label }: { tone: 'success' | 'warning' | 'danger'; icon: ReactNode; label: string }) {
  const palette = {
    success: { fg: C.success, bg: 'rgba(40,199,111,0.15)' },
    warning: { fg: C.warning, bg: 'rgba(255,159,67,0.15)' },
    danger: { fg: C.danger, bg: 'rgba(234,84,85,0.15)' },
  }[tone];

  return (
    <View style={[s.pill, { backgroundColor: palette.bg }]}>
      {icon}
      <Text style={[s.pillText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

// Continuous ping ring used on live/processing indicators.
function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const ping = useSharedValue(0);

  useEffect(() => {
    ping.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
  }, [ping]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - ping.value),
    transform: [{ scale: 1 + ping.value * 1.6 }],
  }));

  return (
    <View style={[s.dotWrap, { width: size + 4, height: size + 4 }]}>
      <Animated.View style={[s.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ringStyle]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// Soft violet wash over a processing thumbnail that breathes in and out.
function BreathingOverlay() {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [breath]);

  const style = useAnimatedStyle(() => ({ opacity: 0.2 + breath.value * 0.25 }));

  return <Animated.View style={[StyleSheet.absoluteFill, s.overlay, style]} />;
}

function SpinningIcon({ name, color }: { name: MIcon; color: string }) {
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [rot]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  return (
    <Animated.View style={style}>
      <MaterialIcons name={name} size={12} color={color} />
    </Animated.View>
  );
}

function NewCrossPostFab({ bottomOffset }: { bottomOffset: number }) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.15 + breath.value * 0.2 }));

  return (
    <View style={[s.fabWrap, { bottom: bottomOffset }]}>
      <Animated.View style={[s.fabGlow, glowStyle]} />
      <AnimatedPressable accessibilityRole="button" style={s.fab}>
        <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, s.fabFill]} />
        <MaterialIcons name="add" size={20} color={C.text} />
        <Text style={s.fabText}>New cross-post</Text>
      </AnimatedPressable>
    </View>
  );
}

function TabBar({ bottomInset }: { bottomInset: number }) {
  return (
    <View style={[s.tabbar, { paddingBottom: bottomInset }]}>
      {TABS.map((tab) => {
        const active = tab.key === 'posts';
        const color = active ? C.primaryContainer : C.muted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => router.replace(tab.path)}
            style={({ pressed }) => [s.tab, pressed && s.pressSoft]}
          >
            <BounceIcon active={active}>
              <MaterialIcons name={tab.icon} size={24} color={color} />
            </BounceIcon>
            <Text style={[s.tabLabel, { color }]}>{tab.label}</Text>
            {active ? <View style={s.tabDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  page: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 140 },
  pressSoft: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  pressCard: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  pressFab: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.36 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center' },

  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  subTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  subTitle: { color: C.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.18 },
  countPill: { backgroundColor: C.raised, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { color: C.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  subActions: { flexDirection: 'row', gap: 8 },
  iconBtnBordered: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  chips: { gap: 8, paddingVertical: 12 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  chipIdle: { backgroundColor: C.surface },
  chipFill: { borderRadius: 999 },
  chipLabel: { color: C.muted, fontSize: 14, fontWeight: '600' },
  chipLabelActive: { color: C.text },
  chipCount: { backgroundColor: C.containerHigh, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, minWidth: 22, alignItems: 'center' },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  chipCountText: { color: C.muted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chipCountTextActive: { color: C.text },

  feed: { gap: 16 },
  empty: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 32 },

  card: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 12, gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12 },

  thumb: { width: 100, aspectRatio: 9 / 16, borderRadius: 12, overflow: 'hidden', backgroundColor: C.raised },
  overlay: { backgroundColor: C.violet },
  playWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  syncBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(124,92,255,0.35)',
  },
  syncText: { color: C.primary, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  alertBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  durationText: { color: C.text, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },

  info: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  meta: { color: C.muted, fontSize: 12, fontWeight: '500', flexShrink: 1 },
  metaWarning: { color: C.warning },
  moreBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 16, fontWeight: '600', lineHeight: 22, letterSpacing: -0.16 },
  body: { color: C.muted, fontSize: 13, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  tag: { color: C.primary, fontSize: 12, fontWeight: '500' },

  dotWrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },

  synd: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.containerLow,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  syndDivider: { width: 1, alignSelf: 'stretch', backgroundColor: C.containerHigh, marginHorizontal: 6 },
  dest: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  destIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  destCopy: { flex: 1, gap: 3 },
  destLabel: { color: C.muted, fontSize: 11, fontWeight: '600' },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', height: 22, paddingHorizontal: 8, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },

  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(234,84,85,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(234,84,85,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  retryMsg: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  retryText: { color: C.danger, fontSize: 12, fontWeight: '500', flexShrink: 1 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(234,84,85,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234,84,85,0.25)',
  },
  retryBtnText: { color: C.danger, fontSize: 12, fontWeight: '600' },

  fabWrap: { position: 'absolute', right: 16 },
  fabGlow: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderRadius: 999, backgroundColor: C.violet },
  fab: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    shadowColor: C.violet,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabFill: { borderRadius: 999 },
  fabText: { color: C.text, fontSize: 15, fontWeight: '600' },

  tabbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  tab: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  tabDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: C.primaryContainer },
});
