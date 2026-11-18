import { MaterialIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform as RNPlatform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorText } from '@/api/client';
import { uploadStudioAsset, useCreateExpress, useStudioStyles, useStudioTrends } from '@/api/hooks';
import { MUSIC_PREVIEWS, STYLE_POSTERS } from '@/api/studio/style-assets';
import type { StudioTrend, TrendPlatform } from '@/api/types';
import { C, Card, Chip, GhostButton, Header, PrimaryButton, Progress, s as ui, secs } from '@/components/studio/ui';
import { InlineMessage } from '@/components/ui-kit';
import { requireAccount } from '@/store/uiStore';

type Picked = { uri: string; name: string; type: string; duration: number | null };
const STEPS = ['Video', 'Style', 'Music', 'Topic', 'Finish'] as const;
const PLATFORMS: { key: TrendPlatform; label: string }[] = [
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'instagram', label: 'Instagram' },
];

function mimeOf(name: string, mime?: string | null): string {
  if (mime && ['video/mp4', 'video/quicktime', 'video/webm'].includes(mime)) return mime;
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
}

export default function MakeAVideo() {
  const catalogue = useStudioStyles();
  const create = useCreateExpress();
  const styles = catalogue.data?.styles ?? [];
  const music = catalogue.data?.music ?? [];

  const [step, setStep] = useState(0);
  const [video, setVideo] = useState<Picked | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [track, setTrack] = useState<string>('style');
  const [ownTrack, setOwnTrack] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [platform, setPlatform] = useState<TrendPlatform>('tiktok');
  const [trend, setTrend] = useState<StudioTrend | null>(null);
  const [hook, setHook] = useState('');
  const [handle, setHandle] = useState('');
  const [cta, setCta] = useState('');
  const [logo, setLogo] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const chosenStyle = styles.find((s) => s.slug === style) ?? null;

  // One preview player for the music step.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [playing, setPlaying] = useState<string | null>(null);
  /** Change step; leaving the music step stops the preview. */
  function goStep(n: number) {
    if (playing) {
      player.pause();
      setPlaying(null);
    }
    setStep(n);
  }
  function preview(slug: string) {
    if (playing === slug && status.playing) {
      player.pause();
      setPlaying(null);
      return;
    }
    const src = MUSIC_PREVIEWS[slug];
    if (!src) return;
    player.replace(src);
    player.play();
    setPlaying(slug);
  }

  async function pickVideo() {
    setError(null);
    try {
      if (RNPlatform.OS === 'ios') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return setError('Allow photo library access to pick a video.');
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false });
      if (res.canceled || !res.assets.length) return;
      const a = res.assets[0];
      const name = a.fileName || a.uri.split('/').pop() || 'video.mp4';
      setVideo({ uri: a.uri, name, type: mimeOf(name, a.mimeType), duration: a.duration != null ? a.duration / 1000 : null });
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function pickOwnTrack() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    setOwnTrack({ uri: a.uri, name: a.name, type: a.mimeType ?? 'audio/mpeg' });
    setTrack('own');
  }

  async function pickLogo() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false });
    if (res.canceled || !res.assets.length) return;
    const a = res.assets[0];
    const name = a.fileName || a.uri.split('/').pop() || 'logo.png';
    setLogo({ uri: a.uri, name, type: a.mimeType ?? (name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg') });
  }

  function next() {
    setError(null);
    if (step === 0 && !video) return setError('Pick the video you recorded.');
    if (step === 1 && !style) return setError('Choose a style.');
    goStep(Math.min(STEPS.length - 1, step + 1));
  }

  async function make() {
    if (!video || !style) return;
    if (playing) {
      player.pause();
      setPlaying(null);
    }
    if (!requireAccount('Sign in to make videos with Studio.')) return;
    setError(null);
    try {
      setBusy('Setting up');
      const project = await create.mutateAsync({
        style,
        music: track,
        platform,
        trend_id: trend?.id ?? null,
        topic: !trend && hook.trim() ? { title: hook.trim(), hook: hook.trim().slice(0, 24) } : null,
        handle: handle.trim() || undefined,
        cta: cta.trim() || undefined,
        title: (trend?.title ?? hook.trim()) || video.name.replace(/\.[^.]+$/, '').slice(0, 60),
      });
      if (logo) {
        setBusy('Uploading your logo');
        await uploadStudioAsset({ projectId: project.id, role: 'logo', file: logo }, setProgress);
      }
      if (track === 'own' && ownTrack) {
        setBusy('Uploading your music');
        await uploadStudioAsset({ projectId: project.id, role: 'music', file: ownTrack }, setProgress);
      }
      setBusy('Uploading your video');
      setProgress(0);
      await uploadStudioAsset({ projectId: project.id, role: 'source', file: video }, setProgress);
      router.replace({ pathname: '/studio/[id]', params: { id: String(project.id) } });
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={ui.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <Header title="Make a video" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} onBack={() => (step > 0 && !busy ? goStep(step - 1) : router.back())} />
      <View style={st.steps}>
        {STEPS.map((label, i) => (
          <View key={label} style={[st.stepBar, i <= step && { backgroundColor: chosenStyle?.theme.accent ?? C.violet }]} />
        ))}
      </View>

      <KeyboardAvoidingView style={ui.flex} behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <>
              <Text style={st.h}>Upload your video</Text>
              <Text style={ui.muted}>Talk to the camera like you normally would. Studio cuts the pauses, adds captions, headlines on your key words, music and an outro.</Text>
              <Pressable accessibilityRole="button" onPress={pickVideo} style={st.drop}>
                <MaterialIcons name={video ? 'check-circle' : 'video-call'} size={44} color={video ? C.success : C.primary} />
                <Text style={ui.label}>{video ? video.name : 'Choose a video'}</Text>
                <Text style={ui.mutedSmall}>{video ? `${secs(video.duration)} · tap to change` : 'MP4 or MOV, up to 10 minutes'}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={st.h}>Pick a style</Text>
              {catalogue.isLoading ? <ActivityIndicator color={C.primary} /> : null}
              <View style={st.grid}>
                {styles.map((s) => {
                  const on = style === s.slug;
                  return (
                    <Pressable key={s.slug} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setStyle(s.slug)} style={[st.styleCard, on && { borderColor: s.theme.accent }]}>
                      <View style={st.stylePoster}>
                        {STYLE_POSTERS[s.slug] ? <Image source={STYLE_POSTERS[s.slug]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                        {on ? (
                          <View style={[st.check, { backgroundColor: s.theme.accent }]}>
                            <MaterialIcons name="check" size={18} color="#0E0E12" />
                          </View>
                        ) : null}
                      </View>
                      <View style={st.swatchRow}>
                        {[s.theme.accent, s.theme.accent2 ?? s.theme.accent, s.theme.bg].map((c, i) => (
                          <View key={i} style={[st.dot, { backgroundColor: c }]} />
                        ))}
                        <Text style={[ui.label, { flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                      </View>
                      <Text style={ui.mutedSmall} numberOfLines={3}>{s.description}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={st.h}>Add music</Text>
              <Text style={ui.muted}>Original tracks made for ClipPipeline: free to post anywhere. Music gets quieter whenever you talk.</Text>
              <Card style={{ gap: 4, paddingVertical: 8 }}>
                <TrackRow label={`Style pick${chosenStyle?.music ? ` · ${music.find((m) => m.slug === chosenStyle.music)?.name ?? ''}` : ''}`} sub="Matches the style you chose" on={track === 'style'} onPress={() => setTrack('style')} />
                {music.map((m) => (
                  <TrackRow
                    key={m.slug}
                    label={m.name}
                    sub={`${m.mood} · ${m.bpm} BPM`}
                    on={track === m.slug}
                    onPress={() => setTrack(m.slug)}
                    playing={playing === m.slug && status.playing}
                    onPlay={() => preview(m.slug)}
                  />
                ))}
                <TrackRow label={ownTrack ? `My track · ${ownTrack.name}` : 'Use my own track'} sub="Only use music you have the rights to" on={track === 'own'} onPress={pickOwnTrack} icon="library-music" />
                <TrackRow label="No music" sub="Just your voice" on={track === 'none'} onPress={() => setTrack('none')} icon="music-off" />
              </Card>
            </>
          ) : null}

          {step === 3 ? <TopicStep platform={platform} setPlatform={setPlatform} trend={trend} setTrend={setTrend} hook={hook} setHook={setHook} /> : null}

          {step === 4 ? (
            <>
              <Text style={st.h}>Your outro</Text>
              <Text style={ui.muted}>The last 4 seconds: your name or brand, a button and your logo.</Text>
              <Card>
                <Text style={ui.fieldLabel}>Name or @handle</Text>
                <TextInput style={ui.input} value={handle} onChangeText={setHandle} maxLength={24} placeholder="@yourname" placeholderTextColor={C.muted} autoCapitalize="none" />
                <Text style={ui.fieldLabel}>Button text</Text>
                <TextInput style={ui.input} value={cta} onChangeText={setCta} maxLength={24} placeholder="Follow for more" placeholderTextColor={C.muted} />
                <GhostButton label={logo ? `Logo: ${logo.name}` : 'Add your logo (optional)'} icon="image" onPress={pickLogo} />
              </Card>
              <Card>
                <Text style={ui.section}>Summary</Text>
                <Text style={ui.muted}>Video: {video?.name}</Text>
                <Text style={ui.muted}>Style: {chosenStyle?.name}</Text>
                <Text style={ui.muted}>Music: {track === 'style' ? 'style pick' : track === 'own' ? ownTrack?.name ?? 'my track' : track === 'none' ? 'none' : music.find((m) => m.slug === track)?.name}</Text>
                <Text style={ui.muted}>Topic: {trend?.title ?? (hook.trim() || 'from what you say')}</Text>
                <Text style={ui.muted}>For: {PLATFORMS.find((p) => p.key === platform)?.label}</Text>
              </Card>
            </>
          ) : null}

          {error ? <InlineMessage icon="error-outline" tone="danger" text={error} /> : null}

          {busy ? (
            <Card>
              <Text style={ui.label}>{busy}…</Text>
              <Progress value={progress} color={chosenStyle?.theme.accent} />
              <Text style={ui.mutedSmall}>Keep the app open until the upload finishes. After that you can leave: we will notify you when the video is ready.</Text>
            </Card>
          ) : step < STEPS.length - 1 ? (
            <PrimaryButton label={step === 3 && !trend && !hook.trim() ? 'Skip' : 'Continue'} icon="arrow-forward" onPress={next} />
          ) : (
            <PrimaryButton label="Make my video" icon="auto-awesome" onPress={make} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TrackRow({ label, sub, on, onPress, playing, onPlay, icon = 'music-note' }: { label: string; sub: string; on: boolean; onPress: () => void; playing?: boolean; onPlay?: () => void; icon?: keyof typeof MaterialIcons.glyphMap }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} style={st.track}>
      <MaterialIcons name={on ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={on ? C.primary : C.muted} />
      <View style={ui.flex}>
        <Text style={ui.label} numberOfLines={1}>{label}</Text>
        <Text style={ui.mutedSmall} numberOfLines={1}>{sub}</Text>
      </View>
      {onPlay ? (
        <Pressable accessibilityLabel={playing ? `Pause ${label}` : `Play ${label}`} hitSlop={8} onPress={onPlay} style={st.play}>
          <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={24} color="#fff" />
        </Pressable>
      ) : (
        <MaterialIcons name={icon} size={22} color={C.muted} />
      )}
    </Pressable>
  );
}

function TopicStep({ platform, setPlatform, trend, setTrend, hook, setHook }: { platform: TrendPlatform; setPlatform: (p: TrendPlatform) => void; trend: StudioTrend | null; setTrend: (t: StudioTrend | null) => void; hook: string; setHook: (s: string) => void }) {
  const trends = useStudioTrends(platform);
  const list = trends.data?.trends ?? [];
  return (
    <>
      <Text style={st.h}>Ride a trend</Text>
      <Text style={ui.muted}>Pick where you will post and a trending topic. It becomes the opening hook and your hashtags.</Text>
      <View style={ui.swatches}>
        {PLATFORMS.map((p) => (
          <Chip key={p.key} label={p.label} active={platform === p.key} onPress={() => { setPlatform(p.key); setTrend(null); }} />
        ))}
      </View>
      <Card style={{ gap: 6 }}>
        {trends.isLoading ? <ActivityIndicator color={C.primary} /> : null}
        {!trends.isLoading && !list.length ? (
          <Text style={ui.mutedSmall}>{trends.isError ? 'Trends are not available right now.' : 'No trends for this platform yet.'} Type your own topic below.</Text>
        ) : null}
        {list.slice(0, 12).map((t) => (
          <Pressable key={t.id} accessibilityRole="radio" accessibilityState={{ checked: trend?.id === t.id }} onPress={() => { setTrend(trend?.id === t.id ? null : t); setHook(''); }} style={st.trend}>
            <MaterialIcons name={trend?.id === t.id ? 'check-circle' : 'trending-up'} size={22} color={trend?.id === t.id ? C.success : C.primary} />
            <View style={ui.flex}>
              <Text style={ui.label} numberOfLines={2}>{t.title}</Text>
              <Text style={ui.mutedSmall} numberOfLines={1}>
                {t.hashtags.slice(0, 4).map((h) => `#${h}`).join(' ')}
                {t.source === 'youtube' ? ' · live from YouTube' : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </Card>
      <Text style={ui.fieldLabel}>Or your own topic</Text>
      <TextInput style={ui.input} value={hook} onChangeText={(v) => { setHook(v); if (v) setTrend(null); }} maxLength={60} placeholder="e.g. GTA 6" placeholderTextColor={C.muted} />
      <Text style={ui.mutedSmall}>Leave it empty and Studio picks the hook from what you say.</Text>
    </>
  );
}

const st = StyleSheet.create({
  h: { color: C.text, fontSize: 24, fontWeight: '900' },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 8 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.containerHigh },
  drop: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, backgroundColor: C.surface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  styleCard: { width: '48%', gap: 8, padding: 8, borderRadius: 20, borderWidth: 2, borderColor: C.border, backgroundColor: C.surface },
  stylePoster: { width: '100%', aspectRatio: 9 / 13, borderRadius: 14, overflow: 'hidden', backgroundColor: C.raised },
  check: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  track: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.violet, alignItems: 'center', justifyContent: 'center' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
});
