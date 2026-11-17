import { MaterialIcons } from '@expo/vector-icons';
import { File as FSFile, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorText } from '@/api/client';
import { useDeleteStudioRender, useIsGuest, useSocialAccounts, useStudioProject, useStudioRenders } from '@/api/hooks';
import type { StudioRender } from '@/api/types';
import { C, Card, GhostButton, Header, PrimaryButton, s as ui, secs } from '@/components/studio/ui';
import { InlineMessage } from '@/components/ui-kit';

function Player({ uri, ratio }: { uri: string; ratio: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <View style={[st.player, { aspectRatio: ratio }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls accessibilityLabel="Rendered video" />
    </View>
  );
}

/** Download the render to the cache folder (signed URLs expire, so always fetch fresh). */
async function toLocalFile(r: StudioRender): Promise<FSFile> {
  const dest = new FSFile(Paths.cache, `clippipeline-${r.id}.mp4`);
  if (dest.exists) return dest;
  return FSFile.downloadFileAsync(r.download_url, dest, { idempotent: true });
}

export default function RenderScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  const guest = useIsGuest();
  const renders = useStudioRenders(Number(projectId));
  const project = useStudioProject(Number(projectId));
  const accounts = useSocialAccounts();
  const del = useDeleteStudioRender();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone?: 'danger' } | null>(null);
  const r = renders.data?.find((x) => x.id === Number(id));
  const connected = (accounts.data ?? []).some((a) => a.status === 'active');

  if (!r) {
    return (
      <SafeAreaView style={ui.safe} edges={['top']}>
        <Header title="Render" />
        <View style={st.center}>{renders.isLoading ? <ActivityIndicator color={C.primary} /> : <InlineMessage icon="error-outline" text="This render is no longer available." />}</View>
      </SafeAreaView>
    );
  }

  async function save() {
    setNotice(null);
    try {
      setBusy('Saving to your gallery');
      const perm = await MediaLibrary.requestPermissionsAsync(true, ['video']);
      if (!perm.granted) throw new Error('Allow ClipPipeline to save videos to your gallery.');
      const file = await toLocalFile(r!);
      await MediaLibrary.saveToLibraryAsync(file.uri);
      setNotice({ text: 'Saved to your gallery.' });
    } catch (e) {
      setNotice({ text: errorText(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setNotice(null);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      setBusy('Preparing the video');
      const file = await toLocalFile(r!);
      setBusy(null);
      await Sharing.shareAsync(file.uri, { mimeType: 'video/mp4', dialogTitle: 'Share video' });
    } catch (e) {
      setNotice({ text: errorText(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  const ratio = r.width && r.height ? r.width / r.height : 9 / 16;

  return (
    <SafeAreaView style={ui.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <Header title={project.data?.title ?? 'Render'} subtitle={`${r.quality === 'final' ? 'Final' : 'Preview'} · ${r.width}×${r.height} · ${secs(r.duration_seconds)}`} />
      <ScrollView contentContainerStyle={ui.page}>
        {r.url ? <Player uri={r.url} ratio={ratio} /> : <InlineMessage icon="info-outline" text="Sample render — sign in to watch your own." />}
        {notice ? <InlineMessage icon={notice.tone ? 'error-outline' : 'check-circle'} tone={notice.tone} text={notice.text} /> : null}

        <View style={st.row}>
          <PrimaryButton style={ui.flex} label={busy ?? 'Save to device'} icon="download" loading={!!busy} disabled={guest} onPress={save} />
          <GhostButton style={[ui.flex, { height: 52 }]} label="Share" icon="share" disabled={guest || !!busy} onPress={share} />
        </View>

        <Card>
          <Text style={ui.section}>Cross-post</Text>
          <Text style={ui.muted}>Publish this render to your connected channels with the usual post form.</Text>
          {r.post_id ? <Text style={[ui.mutedSmall, { color: C.success }]}>Already cross-posted. You can post it again.</Text> : null}
          <GhostButton
            label={connected ? 'Cross-post this video' : 'Connect a channel to cross-post'}
            icon="send"
            disabled={guest || !connected}
            onPress={() =>
              router.push({
                pathname: '/post/new',
                params: { renderId: String(r.id), renderUrl: r.url, renderTitle: project.data?.title ?? '', renderDuration: String(r.duration_seconds ?? ''), renderSize: String(r.size_bytes ?? '') },
              })
            }
          />
          {!connected && !guest ? <Text style={ui.mutedSmall}>Disabled: no connected account. Connect one on the Connect tab.</Text> : null}
        </Card>

        <Card>
          <Text style={ui.section}>Quality check</Text>
          <View style={st.metrics}>
            <Metric label="Loudness" value={r.check?.lufs != null ? `${r.check.lufs} LUFS` : '–'} />
            <Metric label="True peak" value={r.check?.true_peak != null ? `${r.check.true_peak} dBTP` : '–'} />
            <Metric label="Size" value={r.size_bytes ? `${(r.size_bytes / 1048576).toFixed(1)} MB` : '–'} />
          </View>
          {(r.check?.black_frames ?? 0) > 0 || (r.check?.long_silences ?? 0) > 0 ? (
            <Text style={[ui.mutedSmall, { color: C.warning }]}>
              {r.check?.black_frames ? `${r.check.black_frames} black-frame gap(s). ` : ''}
              {r.check?.long_silences ? `${r.check.long_silences} long silence(s).` : ''}
            </Text>
          ) : null}
        </Card>

        <GhostButton
          label="Delete this render"
          icon="delete-outline"
          danger
          disabled={guest}
          onPress={() =>
            Alert.alert('Delete render?', 'The project stays; you can render again.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => del.mutate(r.id, { onSuccess: () => router.back() }) },
            ])
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <MaterialIcons name="schedule" size={14} color={C.muted} />
          <Text style={ui.mutedSmall}>{r.quality === 'preview' ? 'Preview renders are kept for 14 days.' : 'Final renders stay until you delete them.'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={ui.mutedSmall}>{label}</Text>
      <Text style={ui.label}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  player: { width: '100%', maxHeight: 520, alignSelf: 'center', borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  row: { flexDirection: 'row', gap: 10 },
  metrics: { flexDirection: 'row', gap: 12 },
});
