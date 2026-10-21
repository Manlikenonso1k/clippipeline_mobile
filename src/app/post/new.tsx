import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform as RNPlatform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, errorText } from '@/api/client';
import { useCreatePost, useCreatorInfo, useFlags, useIsGuest, useMe, useSocialAccounts } from '@/api/hooks';
import type { PlatformOptions, Platform, YouTubePrivacy } from '@/api/types';
import { PLATFORMS } from '@/api/types';
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/components/post-utils';
import { Sheet, SheetButton, SheetLabel, SheetLink, SheetRow, SheetText } from '@/components/sheet';
import { AnimatedPressable, InlineMessage, RetryMessage } from '@/components/ui-kit';
import { formatWatchTime } from '@/lib/format';
import { requireAccount } from '@/store/uiStore';

// Kinetic Obsidian tokens
const C = {
  bg: '#0E0E12',
  surface: '#16161D',
  raised: '#1E1E28',
  container: '#1F1F23',
  containerHigh: '#2A292E',
  border: '#2A2A36',
  text: '#FFFFFF',
  muted: '#A1A1AE',
  primary: '#CABEFF',
  primaryContainer: '#947DFF',
  violet: '#7C5CFF',
  violetEnd: '#B14CFF',
  success: '#28C76F',
  warning: '#FF9F43',
  danger: '#EA5455',
} as const;

const MAX_TITLE = 100;
const MAX_CAPTION = 2200;
const ALLOWED_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];
const ICON: Record<Platform, 'youtube' | 'facebook' | 'instagram' | 'tiktok'> = {
  youtube: 'youtube',
  facebook: 'facebook',
  instagram: 'instagram',
  tiktok: 'tiktok',
};

type Picked = { uri: string; name: string; type: string; size: number | null; duration: number | null };

const YT_TOS_URL = 'https://www.youtube.com/t/terms';
const YT_GUIDELINES_URL = 'https://www.youtube.com/howyoutubeworks/policies/community-guidelines/';
const TT_MUSIC_URL = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
const TT_BRANDED_URL = 'https://www.tiktok.com/legal/page/global/bc-policy/en';

const YT_PRIVACY: { key: YouTubePrivacy; label: string }[] = [
  { key: 'public', label: 'Public' },
  { key: 'unlisted', label: 'Unlisted' },
  { key: 'private', label: 'Private' },
];

const TT_PRIVACY_LABEL: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Everyone',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
};

const openUrl = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => undefined);

/** Client pre-check of per-platform duration / size caps (COMPLIANCE P-02). Server re-checks. */
function durationIssues(
  platforms: Platform[],
  seconds: number | null,
  bytes: number | null,
  tiktokMax: number | null,
): { block: string[]; warn: string[] } {
  const block: string[] = [];
  const warn: string[] = [];
  if (seconds != null) {
    if (platforms.includes('facebook') && (seconds < 3 || seconds > 90)) block.push('Facebook Reels must be 3–90 seconds long.');
    if (platforms.includes('instagram') && (seconds < 3 || seconds > 900)) block.push('Instagram Reels must be between 3 seconds and 15 minutes.');
    if (platforms.includes('youtube') && seconds > 180) warn.push('YouTube Shorts can be up to 3 minutes; longer videos upload as regular videos.');
    if (platforms.includes('tiktok') && tiktokMax && seconds > tiktokMax) {
      block.push(`Your TikTok account allows videos up to ${formatWatchTime(tiktokMax)}; this one is ${formatWatchTime(seconds)}.`);
    }
  }
  if (bytes != null) {
    if (platforms.includes('instagram') && bytes > 300 * 1024 * 1024) block.push('Instagram Reels must be 300 MB or smaller.');
    if (platforms.includes('tiktok') && bytes > 4 * 1024 * 1024 * 1024) block.push('TikTok videos must be 4 GB or smaller.');
  }
  return { block, warn };
}

function guessMime(name: string, mime?: string | null): string {
  if (mime && ALLOWED_MIME.includes(mime)) return mime;
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  return mime ?? 'video/mp4';
}

function parseHashtags(raw: string): string[] {
  const out = raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').trim())
    .filter(Boolean);
  return [...new Set(out)];
}

/** Wall-clock time; only called from event handlers. */
const nowMs = () => Date.now();
const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Local date "YYYY-MM-DD" + time "HH:MM" -> Date, or null when invalid. */
function parseLocal(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dm || !tm) return null;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatBytes(n: number | null): string {
  if (!n) return '';
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ClipPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <View style={{ height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls accessibilityLabel="Preview of the selected clip" />
    </View>
  );
}

export default function NewPostScreen() {
  const guest = useIsGuest();
  const accountsQ = useSocialAccounts();
  const create = useCreatePost();
  const flags = useFlags();
  const prefs = useMe().data?.preferences;

  const [video, setVideo] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState<string | null>(null);
  const [selected, setSelected] = useState<Platform[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // YouTube (P-04)
  const [ytPrivacy, setYtPrivacy] = useState<YouTubePrivacy | null>(null);
  const [ytGuidelines, setYtGuidelines] = useState(false);
  // TikTok (T-02 … T-10): privacy has no default; interaction toggles start off.
  const [ttPrivacy, setTtPrivacy] = useState<string | null>(null);
  const [ttComment, setTtComment] = useState(false);
  const [ttDuet, setTtDuet] = useState(false);
  const [ttStitch, setTtStitch] = useState(false);
  const [ttDisclose, setTtDisclose] = useState(false);
  const [ttYourBrand, setTtYourBrand] = useState(false);
  const [ttBranded, setTtBranded] = useState(false);
  const [ttAigc, setTtAigc] = useState(false);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [date, setDate] = useState(() => toDateStr(new Date(Date.now() + 3_600_000)));
  const [time, setTime] = useState(() => toTimeStr(new Date(Date.now() + 3_600_000)));
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => PLATFORMS.filter((p) => (accountsQ.data ?? []).some((a) => a.platform === p && a.status === 'active')),
    [accountsQ.data],
  );
  const inactive = useMemo(
    () => (accountsQ.data ?? []).filter((a) => a.status !== 'active').map((a) => a.platform),
    [accountsQ.data],
  );
  // Default: the saved default platforms (or every active platform) until the user changes it.
  const defaultPlatforms = (prefs?.default_platforms ?? []).filter((p) => active.includes(p));
  const chosen = (selected ?? (defaultPlatforms.length ? defaultPlatforms : active)).filter((p) => active.includes(p));
  // Hashtags pre-fill from the saved defaults until the user edits the field.
  const tagsRaw = tagsInput ?? (prefs?.default_hashtags ?? []).map((t) => `#${t}`).join(' ');
  const setTagsRaw = (v: string) => setTagsInput(v);
  const hashtags = parseHashtags(tagsRaw);
  const ytOn = chosen.includes('youtube');
  const ttOn = chosen.includes('tiktok');
  // T-01: creator info is fetched every time the TikTok section is shown (never cached).
  const creatorQ = useCreatorInfo(ttOn);
  const creator = creatorQ.data;
  const ytForcedPrivate = !flags.youtube_audited;
  const ytPrivacyValue: YouTubePrivacy | null = ytForcedPrivate ? 'private' : ytPrivacy;
  const ttOptions = (creator?.privacy_level_options ?? []).filter((o) => flags.tiktok_audited || o === 'SELF_ONLY');
  const ttPrivacyValue = ttPrivacy && ttOptions.includes(ttPrivacy) ? ttPrivacy : null;
  const durationSec = video?.duration != null ? video.duration / 1000 : null;
  const issues = durationIssues(chosen, durationSec, video?.size ?? null, ttOn ? creator?.max_video_post_duration_sec ?? null : null);
  const ttMissingPrivacy = ttOn && !ttPrivacyValue;
  // TikTok content-sharing guidelines: disclosure ON with neither option ticked disables Publish.
  const ttDisclosureIncomplete = ttOn && ttDisclose && !ttYourBrand && !ttBranded;
  const publishBlocked = ttMissingPrivacy || ttDisclosureIncomplete;
  const scheduledAt = scheduleOn ? parseLocal(date, time) : null;
  const uploading = create.isPending;
  const pct = Math.round(create.progress * 100);

  const toggle = (p: Platform) => {
    const base = chosen;
    setSelected(base.includes(p) ? base.filter((x) => x !== p) : [...base, p]);
  };

  const preset = (d: Date) => {
    setScheduleOn(true);
    setDate(toDateStr(d));
    setTime(toTimeStr(d));
  };

  async function pickVideo() {
    setError(null);
    try {
      if (RNPlatform.OS === 'ios') {
        // Passthrough video export on iOS needs library permission (SDK 54+ default).
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError('Allow photo library access to pick a video.');
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const name = a.fileName || a.uri.split('/').pop() || `clip-${Date.now()}.mp4`;
      const type = guessMime(name, a.mimeType);
      if (!ALLOWED_MIME.includes(type)) {
        setError('Pick an MP4, MOV or WebM video.');
        return;
      }
      setVideo({ uri: a.uri, name, type, size: a.fileSize ?? null, duration: a.duration ?? null });
      if (!title) setTitle(name.replace(/\.[^.]+$/, '').slice(0, MAX_TITLE));
    } catch (e) {
      setError(errorText(e));
    }
  }

  function validate(now: number): string | null {
    if (!video) return 'Pick a video first.';
    if (!title.trim()) return 'Add a title.';
    if (title.length > MAX_TITLE) return `Title must be ${MAX_TITLE} characters or fewer.`;
    if (caption.length > MAX_CAPTION) return `Caption must be ${MAX_CAPTION} characters or fewer.`;
    if (!chosen.length) return 'Choose at least one connected platform.';
    if (scheduleOn) {
      if (!scheduledAt) return 'Enter the schedule as YYYY-MM-DD and HH:MM.';
      if (scheduledAt.getTime() <= now + 60_000) return 'Scheduled time must be in the future.';
    }
    if (ytOn) {
      if (!ytPrivacyValue) return 'Choose who can see the video on YouTube.';
      if (!ytGuidelines) return "Confirm the video follows YouTube's Community Guidelines.";
    }
    if (ttOn) {
      if (!creator) return creatorQ.isError ? "Couldn't load your TikTok settings — retry in the TikTok section." : 'Loading your TikTok settings…';
      if (!creator.can_post) return creator.reason || "TikTok says this account can't post right now. Try again later.";
      if (!ttPrivacyValue) return 'Choose who can view the video on TikTok.';
      if (ttDisclose && !ttYourBrand && !ttBranded) return 'You need to indicate if your content promotes yourself, a third party, or both.';
      if (ttBranded && ttPrivacyValue === 'SELF_ONLY') return "Branded content visibility can't be set to Only me.";
    }
    if (issues.block.length) return issues.block[0];
    return null;
  }

  /** P-01: nothing is sent until the user confirms destinations and settings. */
  function review() {
    if (!requireAccount('Sign in to upload a video and publish it to your channels.')) return;
    const v = validate(nowMs());
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setConfirmOpen(true);
  }

  function platformOptions(): PlatformOptions {
    const out: PlatformOptions = {};
    if (ytOn && ytPrivacyValue) out.youtube = { privacy_status: ytPrivacyValue, guidelines_confirmed: ytGuidelines };
    if (ttOn && ttPrivacyValue) {
      out.tiktok = {
        privacy_level: ttPrivacyValue,
        disable_comment: !ttComment,
        disable_duet: !ttDuet,
        disable_stitch: !ttStitch,
        brand_organic_toggle: ttDisclose && ttYourBrand,
        brand_content_toggle: ttDisclose && ttBranded,
        is_aigc: ttAigc,
        music_consent: true,
      };
    }
    return out;
  }

  function submit() {
    const v = validate(nowMs());
    if (v) {
      setConfirmOpen(false);
      setError(v);
      return;
    }
    if (!video) return;
    setError(null);
    setConfirmOpen(false);
    create.mutate(
      {
        video: { uri: video.uri, name: video.name, type: video.type },
        title: title.trim(),
        caption: caption.trim() || null,
        hashtags,
        platforms: chosen,
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
        video_duration_seconds: durationSec,
        platform_options: platformOptions(),
      },
      {
        onSuccess: (post) => router.replace({ pathname: '/post/[id]', params: { id: String(post.id) } }),
        onError: (e) => setError(errorText(e)),
      },
    );
  }

  const handleOf = (p: Platform) => {
    const a = (accountsQ.data ?? []).find((x) => x.platform === p);
    return a?.handle ?? a?.display_name ?? null;
  };
  const ttPrivacyDisabled = (o: string) => ttBranded && o === 'SELF_ONLY';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={s.bar}>
        <Pressable accessibilityLabel="Go back" style={({ pressed }) => [s.iconBtn, pressed && s.press]} onPress={() => router.back()} disabled={uploading}>
          <MaterialIcons name="close" size={24} color={C.muted} />
        </Pressable>
        <Text style={s.barTitle}>New Cross-Post</Text>
        <View style={s.iconBtn} />
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {guest ? (
            <Pressable accessibilityRole="button" onPress={() => requireAccount('Sign in to upload a video and publish it to your channels.')}>
              <InlineMessage icon="lock-outline" text="Preview mode — sign in to upload and publish your own videos." />
            </Pressable>
          ) : null}

          {/* Video picker */}
          <AnimatedPressable accessibilityRole="button" accessibilityLabel="Pick a video" style={s.picker} onPress={pickVideo} disabled={uploading}>
            <LinearGradient colors={['rgba(124,92,255,0.18)', 'rgba(177,76,255,0.06)'] as const} style={StyleSheet.absoluteFill} />
            <View style={s.pickerIcon}>
              <MaterialIcons name={video ? 'movie' : 'video-library'} size={26} color={C.primary} />
            </View>
            <View style={s.flexShrink}>
              <Text style={s.pickerTitle} numberOfLines={1}>
                {video ? video.name : 'Pick a video'}
              </Text>
              <Text style={s.muted} numberOfLines={1}>
                {video
                  ? [formatBytes(video.size), video.duration ? formatWatchTime(video.duration / 1000) : '', video.type.replace('video/', '').toUpperCase()]
                      .filter(Boolean)
                      .join(' • ')
                  : 'MP4, MOV or WebM — vertical 9:16 works best'}
              </Text>
            </View>
            <Text style={s.link}>{video ? 'Change' : 'Browse'}</Text>
          </AnimatedPressable>

          {video ? <ClipPreview uri={video.uri} /> : null}

          {/* Details */}
          <View style={s.card}>
            <Field label="Title" count={`${title.length}/${MAX_TITLE}`}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What's this clip about?"
                placeholderTextColor={C.muted}
                maxLength={MAX_TITLE}
                style={s.input}
                editable={!uploading}
              />
            </Field>
            <Field label="Caption" count={`${caption.length}/${MAX_CAPTION}`}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Write a caption…"
                placeholderTextColor={C.muted}
                maxLength={MAX_CAPTION}
                multiline
                style={[s.input, s.multiline]}
                editable={!uploading}
              />
            </Field>
            <Field label="Hashtags">
              <TextInput
                value={tagsRaw}
                onChangeText={setTagsRaw}
                placeholder="editing, creator, shorts"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={s.input}
                editable={!uploading}
              />
              {hashtags.length ? (
                <View style={s.tagRow}>
                  {hashtags.map((t) => (
                    <Text key={t} style={s.tag}>
                      #{t}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Field>
          </View>

          {/* Platforms */}
          <View style={s.card}>
            <Text style={s.section}>Publish to</Text>
            {accountsQ.isLoading ? <ActivityIndicator color={C.primary} /> : null}
            {accountsQ.isError && !accountsQ.data ? <InlineMessage tone="danger" icon="cloud-off" text="Couldn't load your accounts." /> : null}
            {!accountsQ.isLoading && active.length === 0 ? (
              <View style={s.emptyPlat}>
                <InlineMessage icon="link-off" text="No active connected accounts yet." />
                <AnimatedPressable style={s.secondaryBtn} onPress={() => router.push('/connect')}>
                  <MaterialIcons name="add-link" size={18} color={C.text} />
                  <Text style={s.secondaryText}>Connect accounts</Text>
                </AnimatedPressable>
              </View>
            ) : null}
            {active.map((p) => {
              const on = chosen.includes(p);
              return (
                <Pressable
                  key={p}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: uploading }}
                  onPress={() => toggle(p)}
                  disabled={uploading}
                  style={({ pressed }) => [s.platRow, on && s.platRowOn, pressed && s.press]}
                >
                  <View style={[s.platIcon, { borderColor: `${PLATFORM_COLOR[p]}66` }]}>
                    <FontAwesome5 name={ICON[p]} size={16} color={PLATFORM_COLOR[p]} />
                  </View>
                  <Text style={s.platName}>{PLATFORM_LABEL[p]}</Text>
                  <MaterialIcons name={on ? 'check-box' : 'check-box-outline-blank'} size={22} color={on ? C.primary : C.muted} />
                </Pressable>
              );
            })}
            {active.includes('youtube') ? (
              <Text style={s.muted}>
                Uploads to YouTube use YouTube API Services and are subject to the{' '}
                <Text accessibilityRole="link" style={s.link} onPress={() => openUrl(YT_TOS_URL)}>
                  YouTube Terms of Service
                </Text>
                .
              </Text>
            ) : null}
            {inactive.length ? (
              <Text style={[s.muted, { color: C.warning }]}>
                Needs re-auth: {inactive.map((p) => PLATFORM_LABEL[p]).join(', ')}. Reconnect on the Connect tab to publish there.
              </Text>
            ) : null}
          </View>

          {/* YouTube settings (P-04) */}
          {ytOn ? (
            <View style={s.card}>
              <Text style={s.section}>YouTube settings</Text>
              <Text style={s.label}>Visibility</Text>
              {YT_PRIVACY.map((o) => {
                const on = ytPrivacyValue === o.key;
                const disabled = uploading || (ytForcedPrivate && o.key !== 'private');
                return (
                  <Pressable
                    key={o.key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on, disabled }}
                    disabled={disabled}
                    onPress={() => setYtPrivacy(o.key)}
                    style={({ pressed }) => [s.platRow, on && s.platRowOn, pressed && s.press, disabled && s.ctaDisabled]}
                  >
                    <Text style={s.platName}>{o.label}</Text>
                    <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={on ? C.primary : C.muted} />
                  </Pressable>
                );
              })}
              {ytForcedPrivate ? (
                <InlineMessage icon="lock-outline" text="YouTube uploads stay private until ClipPipeline passes YouTube's audit." />
              ) : null}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ytGuidelines, disabled: uploading }}
                disabled={uploading}
                onPress={() => setYtGuidelines((v) => !v)}
                style={({ pressed }) => [s.rowBetween, pressed && s.press]}
              >
                <Text style={[s.muted, s.flexShrink]}>
                  I confirm this video follows{' '}
                  <Text accessibilityRole="link" style={s.link} onPress={() => openUrl(YT_GUIDELINES_URL)}>
                    YouTube&apos;s Community Guidelines
                  </Text>
                  .
                </Text>
                <MaterialIcons name={ytGuidelines ? 'check-box' : 'check-box-outline-blank'} size={22} color={ytGuidelines ? C.primary : C.muted} />
              </Pressable>
            </View>
          ) : null}

          {/* TikTok settings (T-01 … T-10) */}
          {ttOn ? (
            <View style={s.card}>
              <Text style={s.section}>TikTok settings</Text>
              {creatorQ.isLoading ? (
                <ActivityIndicator color={C.primary} />
              ) : creatorQ.isError && !creator ? (
                creatorQ.error instanceof ApiError && creatorQ.error.status === 404 ? (
                  <InlineMessage tone="danger" icon="link-off" text="Reconnect TikTok on the Connect tab to post there." />
                ) : (
                  <RetryMessage text="Couldn't load your TikTok settings — tap to retry" onRetry={() => void creatorQ.refetch()} />
                )
              ) : creator ? (
                <>
                  <View style={s.rowBetween}>
                    <View style={[s.platIcon, { borderColor: `${PLATFORM_COLOR.tiktok}66`, overflow: 'hidden' }]}>
                      {creator.creator_avatar_url ? (
                        <Image source={{ uri: creator.creator_avatar_url }} style={{ width: 32, height: 32 }} contentFit="cover" />
                      ) : (
                        <FontAwesome5 name="tiktok" size={16} color={PLATFORM_COLOR.tiktok} />
                      )}
                    </View>
                    <Text style={[s.platName, s.flexShrink]} numberOfLines={1}>
                      Posting to @{creator.creator_username || creator.creator_nickname}
                      {creator.creator_nickname ? <Text style={s.muted}>{`  ${creator.creator_nickname}`}</Text> : null}
                    </Text>
                  </View>

                  {!creator.can_post ? (
                    <InlineMessage tone="danger" icon="block" text={creator.reason || "TikTok says this account can't post right now. Try again later."} />
                  ) : null}

                  <Text style={s.label}>Who can view this video</Text>
                  {ttOptions.map((o) => {
                    const on = ttPrivacyValue === o;
                    const disabled = uploading || ttPrivacyDisabled(o);
                    return (
                      <Pressable
                        key={o}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled }}
                        disabled={disabled}
                        onPress={() => setTtPrivacy(o)}
                        style={({ pressed }) => [s.platRow, on && s.platRowOn, pressed && s.press, disabled && s.ctaDisabled]}
                      >
                        <View style={s.flexShrink}>
                          <Text style={s.platName}>{TT_PRIVACY_LABEL[o] ?? o}</Text>
                          {ttPrivacyDisabled(o) ? <Text style={s.muted}>Branded content visibility can&apos;t be set to Only me.</Text> : null}
                        </View>
                        <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={on ? C.primary : C.muted} />
                      </Pressable>
                    );
                  })}
                  {!ttPrivacyValue ? <Text style={[s.muted, { color: C.warning }]}>Choose who can view the video to publish.</Text> : null}
                  {!flags.tiktok_audited ? (
                    <InlineMessage icon="lock-outline" text="TikTok posts stay private until ClipPipeline passes TikTok's review." />
                  ) : null}

                  {(
                    [
                      ['Allow comments', ttComment, setTtComment, creator.comment_disabled],
                      ['Allow Duet', ttDuet, setTtDuet, creator.duet_disabled],
                      ['Allow Stitch', ttStitch, setTtStitch, creator.stitch_disabled],
                    ] as const
                  ).map(([label, value, set, off]) => (
                    <View key={label} style={s.rowBetween}>
                      <View style={s.flexShrink}>
                        <Text style={s.platName}>{label}</Text>
                        {off ? <Text style={s.muted}>Turned off in your TikTok settings</Text> : null}
                      </View>
                      <Switch
                        value={off ? false : value}
                        onValueChange={set}
                        disabled={uploading || off}
                        trackColor={{ false: C.containerHigh, true: C.primaryContainer }}
                        thumbColor={C.text}
                        ios_backgroundColor={C.containerHigh}
                        accessibilityLabel={label}
                      />
                    </View>
                  ))}

                  <View style={s.rowBetween}>
                    <View style={s.flexShrink}>
                      <Text style={s.platName}>Disclose video content</Text>
                      <Text style={s.muted}>Turn on if this video promotes yourself, a brand, product or service.</Text>
                    </View>
                    <Switch
                      value={ttDisclose}
                      onValueChange={(v) => {
                        setTtDisclose(v);
                        if (!v) {
                          setTtYourBrand(false);
                          setTtBranded(false);
                        }
                      }}
                      disabled={uploading}
                      trackColor={{ false: C.containerHigh, true: C.primaryContainer }}
                      thumbColor={C.text}
                      ios_backgroundColor={C.containerHigh}
                      accessibilityLabel="Disclose video content"
                    />
                  </View>
                  {ttDisclose ? (
                    <>
                      {(
                        [
                          ['Your brand', 'You are promoting yourself or your own business.', ttYourBrand, setTtYourBrand, false],
                          ['Branded content', 'You are promoting another brand or a third party.', ttBranded, setTtBranded, ttPrivacyValue === 'SELF_ONLY'],
                        ] as const
                      ).map(([label, sub, value, set, disabled]) => (
                        <Pressable
                          key={label}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: value, disabled }}
                          disabled={uploading || disabled}
                          onPress={() => set(!value)}
                          style={({ pressed }) => [s.platRow, value && s.platRowOn, pressed && s.press, disabled && s.ctaDisabled]}
                        >
                          <View style={s.flexShrink}>
                            <Text style={s.platName}>{label}</Text>
                            <Text style={s.muted}>{disabled ? "Branded content visibility can't be set to Only me." : sub}</Text>
                          </View>
                          <MaterialIcons name={value ? 'check-box' : 'check-box-outline-blank'} size={22} color={value ? C.primary : C.muted} />
                        </Pressable>
                      ))}
                      {ttBranded ? (
                        <Text style={s.muted}>Your photo/video will be labeled as &apos;Paid partnership&apos;</Text>
                      ) : ttYourBrand ? (
                        <Text style={s.muted}>Your photo/video will be labeled as &apos;Promotional content&apos;</Text>
                      ) : (
                        <Text style={[s.muted, { color: C.warning }]}>
                          You need to indicate if your content promotes yourself, a third party, or both.
                        </Text>
                      )}
                    </>
                  ) : null}

                  <View style={s.rowBetween}>
                    <View style={s.flexShrink}>
                      <Text style={s.platName}>AI-generated content</Text>
                      <Text style={s.muted}>Label this video as made or significantly edited with AI.</Text>
                    </View>
                    <Switch
                      value={ttAigc}
                      onValueChange={setTtAigc}
                      disabled={uploading}
                      trackColor={{ false: C.containerHigh, true: C.primaryContainer }}
                      thumbColor={C.text}
                      ios_backgroundColor={C.containerHigh}
                      accessibilityLabel="AI-generated content"
                    />
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {issues.block.map((m) => (
            <InlineMessage key={m} tone="danger" icon="timer-off" text={m} />
          ))}
          {issues.warn.map((m) => (
            <InlineMessage key={m} icon="info-outline" text={m} />
          ))}

          {/* Schedule */}
          <View style={s.card}>
            <View style={s.rowBetween}>
              <View style={s.flexShrink}>
                <Text style={s.section}>Schedule for later</Text>
                <Text style={s.muted}>{scheduleOn ? 'Publishes automatically at this local time.' : 'Off — publishes right after upload.'}</Text>
              </View>
              <Switch
                value={scheduleOn}
                onValueChange={setScheduleOn}
                disabled={uploading}
                trackColor={{ false: C.containerHigh, true: C.primaryContainer }}
                thumbColor={C.text}
                ios_backgroundColor={C.containerHigh}
                accessibilityLabel="Schedule for later"
              />
            </View>
            {scheduleOn ? (
              <>
                <View style={s.presetRow}>
                  <Chip label="In 1 hour" onPress={() => preset(new Date(Date.now() + 3_600_000))} />
                  <Chip
                    label="Tonight 8pm"
                    onPress={() => {
                      const d = new Date();
                      d.setHours(20, 0, 0, 0);
                      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
                      preset(d);
                    }}
                  />
                  <Chip
                    label="Tomorrow 9am"
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(9, 0, 0, 0);
                      preset(d);
                    }}
                  />
                </View>
                <View style={s.dateRow}>
                  <Field label="Date (YYYY-MM-DD)" style={s.flex}>
                    <TextInput value={date} onChangeText={setDate} placeholder="2026-10-14" placeholderTextColor={C.muted} style={s.input} keyboardType="numbers-and-punctuation" />
                  </Field>
                  <Field label="Time (HH:MM)" style={s.timeField}>
                    <TextInput value={time} onChangeText={setTime} placeholder="09:00" placeholderTextColor={C.muted} style={s.input} keyboardType="numbers-and-punctuation" />
                  </Field>
                </View>
                {scheduledAt ? (
                  <Text style={s.muted}>
                    {scheduledAt.toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Text>
                ) : (
                  <Text style={[s.muted, { color: C.danger }]}>Invalid date or time.</Text>
                )}
              </>
            ) : null}
          </View>

          {error ? <InlineMessage tone="danger" icon="error-outline" text={error} /> : null}

          {uploading ? (
            <View style={s.progressCard}>
              <View style={s.rowBetween}>
                <Text style={s.section}>{pct < 100 ? 'Uploading video…' : 'Creating post…'}</Text>
                <Text style={s.pct}>{pct}%</Text>
              </View>
              <View style={s.track}>
                <LinearGradient
                  colors={[C.violet, C.violetEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.fill, { width: `${Math.max(2, pct)}%` }]}
                />
              </View>
              <Text style={s.muted}>Keep the app open until the upload finishes. Each platform may take a few minutes to process the video after that.</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.dock}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={scheduleOn ? 'Schedule post' : 'Publish now'}
          accessibilityState={{ busy: uploading, disabled: uploading }}
          style={[s.cta, (uploading || guest || publishBlocked) && s.ctaDisabled]}
          onPress={review}
          disabled={uploading || publishBlocked}
        >
          <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          {uploading ? <ActivityIndicator color={C.text} /> : <MaterialIcons name={scheduleOn ? 'schedule-send' : 'rocket-launch'} size={20} color={C.text} />}
          <Text style={s.ctaText}>
            {uploading ? `Uploading ${pct}%` : scheduleOn ? 'Schedule' : `Publish to ${chosen.length || 0} ${chosen.length === 1 ? 'platform' : 'platforms'}`}
          </Text>
        </AnimatedPressable>
      </View>

      {/* P-01 — explicit confirm step */}
      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title={scheduleOn ? 'Confirm schedule' : 'Confirm and publish'} subtitle="Check where this video goes and how.">
        <SheetLabel>Video</SheetLabel>
        <SheetText>
          {title.trim() || 'Untitled'}
          {durationSec != null ? ` • ${formatWatchTime(durationSec)}` : ''}
        </SheetText>
        {caption.trim() ? <SheetText>{caption.trim().length > 160 ? `${caption.trim().slice(0, 160)}…` : caption.trim()}</SheetText> : null}
        {hashtags.length ? <SheetText>{hashtags.map((t) => `#${t}`).join(' ')}</SheetText> : null}
        <SheetText>
          {scheduledAt
            ? `Scheduled for ${scheduledAt.toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : 'Publishes right after upload'}
        </SheetText>

        <SheetLabel>Destinations</SheetLabel>
        {chosen.map((p) => {
          const parts: string[] = [];
          const h = handleOf(p);
          if (h) parts.push(h.startsWith('@') ? h : `@${h}`);
          if (p === 'youtube' && ytPrivacyValue) parts.push(`Visibility: ${YT_PRIVACY.find((o) => o.key === ytPrivacyValue)?.label}`);
          if (p === 'tiktok') {
            if (creator) parts.push(`@${creator.creator_username || creator.creator_nickname}`);
            if (ttPrivacyValue) parts.push(`Who can view: ${TT_PRIVACY_LABEL[ttPrivacyValue] ?? ttPrivacyValue}`);
            parts.push(`Comments ${ttComment ? 'on' : 'off'}, Duet ${ttDuet ? 'on' : 'off'}, Stitch ${ttStitch ? 'on' : 'off'}`);
            if (ttDisclose) parts.push(ttBranded ? "Labeled 'Paid partnership'" : "Labeled 'Promotional content'");
            if (ttAigc) parts.push('AI-generated');
          }
          return <SheetRow key={p} icon="check-circle" iconColor={PLATFORM_COLOR[p]} label={PLATFORM_LABEL[p]} sub={parts.join(' • ')} />;
        })}

        {ytOn && ytForcedPrivate ? <SheetText tone="warning">YouTube uploads stay private until ClipPipeline passes YouTube&apos;s audit.</SheetText> : null}
        {ttOn && !flags.tiktok_audited ? <SheetText tone="warning">TikTok posts stay private until ClipPipeline passes TikTok&apos;s review.</SheetText> : null}
        <SheetText>After upload, each platform may take a few minutes to process the video.</SheetText>
        {ttOn ? (
          <SheetText>
            By posting, you agree to TikTok&apos;s <SheetLink label="Music Usage Confirmation" onPress={() => openUrl(TT_MUSIC_URL)} />
            {ttDisclose && ttBranded ? (
              <>
                {' and '}
                <SheetLink label="Branded Content Policy" onPress={() => openUrl(TT_BRANDED_URL)} />
              </>
            ) : null}
            .
          </SheetText>
        ) : null}
        <SheetButton
          tone="primary"
          icon={scheduleOn ? 'schedule-send' : 'rocket-launch'}
          label={scheduleOn ? 'Schedule post' : `Publish to ${chosen.length} ${chosen.length === 1 ? 'platform' : 'platforms'}`}
          onPress={submit}
          disabled={uploading}
        />
        <SheetButton label="Back to edit" onPress={() => setConfirmOpen(false)} />
      </Sheet>
    </SafeAreaView>
  );
}

function Field({ label, count, children, style }: { label: string; count?: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[s.field, style]}>
      <View style={s.rowBetween}>
        <Text style={s.label}>{label}</Text>
        {count ? <Text style={s.count}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, pressed && s.press]}>
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  press: { opacity: 0.8 },
  bar: { height: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  barTitle: { color: C.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },
  page: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 16 },

  picker: {
    minHeight: 84,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${C.primaryContainer}88`,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  pickerIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: `${C.primaryContainer}33`, alignItems: 'center', justifyContent: 'center' },
  pickerTitle: { color: C.text, fontSize: 16, fontWeight: '600' },
  link: { color: C.primary, fontSize: 13, fontWeight: '600' },

  card: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  section: { color: C.text, fontSize: 15, fontWeight: '600' },
  muted: { color: C.muted, fontSize: 13, lineHeight: 18 },
  field: { gap: 6 },
  label: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  count: { color: C.muted, fontSize: 11 },
  input: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: C.container,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { color: C.primary, fontSize: 13, fontWeight: '600' },

  platRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: C.container,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  platRowOn: { borderColor: `${C.primaryContainer}88`, backgroundColor: `${C.primaryContainer}14` },
  platIcon: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  platName: { flex: 1, color: C.text, fontSize: 15, fontWeight: '500' },
  emptyPlat: { gap: 10 },
  secondaryBtn: { height: 44, borderRadius: 12, backgroundColor: C.containerHigh, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { color: C.text, fontSize: 14, fontWeight: '600' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.containerHigh },
  chipText: { color: C.text, fontSize: 13, fontWeight: '500' },
  dateRow: { flexDirection: 'row', gap: 10 },
  timeField: { width: 110 },

  progressCard: { backgroundColor: C.raised, borderRadius: 16, padding: 16, gap: 10 },
  pct: { color: C.primary, fontSize: 15, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: C.containerHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: `${C.bg}F2`, borderTopWidth: 1, borderTopColor: C.border },
  cta: { height: 52, borderRadius: 14, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: C.text, fontSize: 16, fontWeight: '700' },
});
