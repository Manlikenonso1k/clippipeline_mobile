import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

import { errorText } from '@/api/client';
import { useCreatePost, useIsGuest, useSocialAccounts } from '@/api/hooks';
import type { Platform } from '@/api/types';
import { PLATFORMS } from '@/api/types';
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/components/post-utils';
import { AnimatedPressable, InlineMessage } from '@/components/ui-kit';
import { formatWatchTime } from '@/lib/format';

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

export default function NewPostScreen() {
  const guest = useIsGuest();
  const accountsQ = useSocialAccounts();
  const create = useCreatePost();

  const [video, setVideo] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [selected, setSelected] = useState<Platform[] | null>(null);
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
  // Default: every active platform selected until the user changes it.
  const chosen = (selected ?? active).filter((p) => active.includes(p));
  const hashtags = parseHashtags(tagsRaw);
  const scheduledAt = scheduleOn ? parseLocal(date, time) : null;
  const uploading = create.isPending;
  const pct = Math.round(create.progress * 100);

  const toggle = (p: Platform) => {
    const base = selected ?? active;
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
    if (guest) return 'Sign in to publish your own videos.';
    if (!video) return 'Pick a video first.';
    if (!title.trim()) return 'Add a title.';
    if (title.length > MAX_TITLE) return `Title must be ${MAX_TITLE} characters or fewer.`;
    if (caption.length > MAX_CAPTION) return `Caption must be ${MAX_CAPTION} characters or fewer.`;
    if (!chosen.length) return 'Choose at least one connected platform.';
    if (scheduleOn) {
      if (!scheduledAt) return 'Enter the schedule as YYYY-MM-DD and HH:MM.';
      if (scheduledAt.getTime() <= now + 60_000) return 'Scheduled time must be in the future.';
    }
    return null;
  }

  function submit() {
    const v = validate(nowMs());
    if (v) {
      setError(v);
      return;
    }
    if (!video) return;
    setError(null);
    create.mutate(
      {
        video: { uri: video.uri, name: video.name, type: video.type },
        title: title.trim(),
        caption: caption.trim() || null,
        hashtags,
        platforms: chosen,
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      },
      {
        onSuccess: (post) => router.replace({ pathname: '/post/[id]', params: { id: String(post.id) } }),
        onError: (e) => setError(errorText(e)),
      },
    );
  }

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
            <InlineMessage icon="lock-outline" text="Preview mode — sign in to upload and publish your own videos." />
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
            {inactive.length ? (
              <Text style={[s.muted, { color: C.warning }]}>
                Needs re-auth: {inactive.map((p) => PLATFORM_LABEL[p]).join(', ')}. Reconnect on the Connect tab to publish there.
              </Text>
            ) : null}
          </View>

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
              <Text style={s.muted}>Keep the app open until the upload finishes.</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.dock}>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={scheduleOn ? 'Schedule post' : 'Publish now'}
          accessibilityState={{ busy: uploading, disabled: uploading }}
          style={[s.cta, (uploading || guest) && s.ctaDisabled]}
          onPress={submit}
          disabled={uploading}
        >
          <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          {uploading ? <ActivityIndicator color={C.text} /> : <MaterialIcons name={scheduleOn ? 'schedule-send' : 'rocket-launch'} size={20} color={C.text} />}
          <Text style={s.ctaText}>
            {uploading ? `Uploading ${pct}%` : scheduleOn ? 'Schedule' : `Publish to ${chosen.length || 0} ${chosen.length === 1 ? 'platform' : 'platforms'}`}
          </Text>
        </AnimatedPressable>
      </View>
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
