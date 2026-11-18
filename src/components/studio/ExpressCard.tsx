import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { errorText } from '@/api/client';
import { useRemakeExpress, useStudioRenders, useStudioStyles } from '@/api/hooks';
import type { StudioProjectDetail } from '@/api/types';
import { Sheet } from '@/components/sheet';
import { C, Card, Chip, GhostButton, PrimaryButton, Progress, s as ui } from './ui';

const STAGES = ['Processing your video', 'Listening to what you say', 'Adding graphics, captions and music', 'Rendering in HD'] as const;

/** "Make a video" progress and result (CONTRACT §17.5). */
export function ExpressCard({ p, guest }: { p: StudioProjectDetail; guest: boolean }) {
  const recipe = p.recipe!;
  const renders = useStudioRenders(p.id);
  const remake = useRemakeExpress();
  const catalogue = useStudioStyles();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<string | undefined>(recipe.style);
  const [music, setMusic] = useState<string | undefined>(recipe.music);
  const [error, setError] = useState<string | null>(null);

  const jobs = p.active_jobs;
  const job = (t: string) => jobs.find((j) => j.type === t);
  const stage = recipe.status === 'rendering' ? 3 : job('transcribe') ? 1 : job('probe') || job('fetch_link') ? 0 : 2;
  const renderJob = job('render_final');
  const render = renders.data?.find((r) => r.id === recipe.render_id) ?? (recipe.status === 'done' ? renders.data?.[0] : undefined);

  async function doRemake(input: { style?: string; music?: string }) {
    setError(null);
    try {
      await remake.mutateAsync({ projectId: p.id, ...input });
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (recipe.status === 'waiting' || recipe.status === 'rendering') {
    return (
      <Card>
        <View style={st.row}>
          <ActivityIndicator color={C.primary} />
          <Text style={[ui.section, ui.flex]}>Making your video</Text>
        </View>
        {STAGES.map((label, i) => (
          <View key={label} style={st.row}>
            <MaterialIcons name={i < stage ? 'check-circle' : i === stage ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={i < stage ? C.success : i === stage ? C.primary : C.muted} />
            <Text style={[ui.label, i > stage && { color: C.muted }]}>{label}</Text>
          </View>
        ))}
        {stage === 3 ? <Progress value={renderJob?.progress ?? 0.02} /> : null}
        {renderJob?.status === 'queued' ? <Text style={ui.mutedSmall}>Waiting for the render server…</Text> : null}
        <Text style={ui.mutedSmall}>Usually 1–3 minutes. You can leave this screen; we will notify you.</Text>
      </Card>
    );
  }

  if (recipe.status === 'failed') {
    return (
      <Card>
        <View style={st.row}>
          <MaterialIcons name="error-outline" size={22} color={C.danger} />
          <Text style={[ui.section, ui.flex]}>We couldn&apos;t finish this video</Text>
        </View>
        {recipe.error ? <Text style={ui.muted}>{recipe.error}</Text> : null}
        {error ? <Text style={[ui.mutedSmall, { color: C.danger }]}>{error}</Text> : null}
        <PrimaryButton label="Try again" icon="refresh" loading={remake.isPending} disabled={guest} onPress={() => doRemake({})} />
      </Card>
    );
  }

  const hashtags = recipe.hashtags ?? [];
  return (
    <Card>
      <View style={st.row}>
        <MaterialIcons name="celebration" size={24} color={C.success} />
        <Text style={[ui.section, ui.flex]}>Your video is ready</Text>
      </View>
      {recipe.headlines?.length ? <Text style={ui.mutedSmall}>Headlines: {[recipe.hook, ...recipe.headlines].filter(Boolean).join(' · ')}</Text> : null}
      <View style={st.row}>
        <PrimaryButton
          style={ui.flex}
          label="Download"
          icon="download"
          disabled={guest || !render}
          onPress={() => render && router.push({ pathname: '/studio/render/[id]', params: { id: String(render.id), projectId: String(p.id) } })}
        />
        <GhostButton
          style={[ui.flex, { height: 52 }]}
          label="Publish"
          icon="send"
          disabled={guest || !render}
          onPress={() =>
            render &&
            router.push({
              pathname: '/post/new',
              params: {
                renderId: String(render.id),
                renderUrl: render.url,
                renderTitle: p.title,
                renderDuration: String(render.duration_seconds ?? ''),
                renderSize: String(render.size_bytes ?? ''),
                caption: recipe.caption ?? '',
                hashtags: hashtags.join(','),
                platform: recipe.platform ?? '',
              },
            })
          }
        />
      </View>
      <GhostButton label="Try another style or music" icon="palette" disabled={guest} onPress={() => setOpen(true)} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Make it again" subtitle="Same video, new look. Takes a minute or two." scroll>
        <View style={{ gap: 12, paddingBottom: 12 }}>
          <Text style={ui.fieldLabel}>Style</Text>
          <View style={ui.swatches}>
            {(catalogue.data?.styles ?? []).map((s) => (
              <Chip key={s.slug} label={s.name} active={style === s.slug} onPress={() => setStyle(s.slug)} />
            ))}
          </View>
          <Text style={ui.fieldLabel}>Music</Text>
          <View style={ui.swatches}>
            <Chip label="Style pick" active={music === 'style'} onPress={() => setMusic('style')} />
            {(catalogue.data?.music ?? []).map((m) => (
              <Chip key={m.slug} label={m.name} active={music === m.slug} onPress={() => setMusic(m.slug)} />
            ))}
            <Chip label="No music" active={music === 'none'} onPress={() => setMusic('none')} />
          </View>
          {error ? <Text style={[ui.mutedSmall, { color: C.danger }]}>{error}</Text> : null}
          <PrimaryButton label="Make it again" icon="auto-awesome" loading={remake.isPending} onPress={() => doRemake({ style, music })} />
        </View>
      </Sheet>
    </Card>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
