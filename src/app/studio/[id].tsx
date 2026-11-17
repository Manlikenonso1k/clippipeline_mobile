import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, errorText } from '@/api/client';
import {
  uploadStudioAsset,
  useApplyReference,
  useAutoCut,
  useCancelStudioJob,
  useDeleteStudioAsset,
  useDeleteStudioProject,
  useIsGuest,
  useRenderProject,
  useStudioProject,
  useStudioRenders,
  useStudioTemplate,
  useUndoAutoCut,
  useUpdateStudioProject,
} from '@/api/hooks';
import type { AssetRole, Edl, EdlClip, EdlSegment, StudioAsset, StudioJob, StudioProjectDetail } from '@/api/types';
import { Sheet } from '@/components/sheet';
import { TrimBar } from '@/components/studio/TrimBar';
import { C, Card, Chip, GhostButton, Header, JobRow, PrimaryButton, PropsForm, SectionTitle, ToggleRow, s as ui, secs } from '@/components/studio/ui';
import { InlineMessage } from '@/components/ui-kit';
import { asProps, edlSeconds, moveSegment, removeSegment, segmentSeconds, splitClip, templateLabel, updateSegment } from '@/lib/studio';
import { useStudioStore } from '@/store/studioStore';
import { requireAccount } from '@/store/uiStore';

type Editing = { kind: 'segment'; id: string } | { kind: 'overlay'; id: string } | { kind: 'captions' } | null;

const ROLE_LABEL: Record<AssetRole, string> = { source: 'Clip', reference: 'Reference', music: 'Music', image: 'Image', logo: 'Logo' };

export default function StudioProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const guest = useIsGuest();
  const q = useStudioProject(projectId);
  const renders = useStudioRenders(projectId);
  const update = useUpdateStudioProject();
  const autoCut = useAutoCut();
  const undo = useUndoAutoCut();
  const applyRef = useApplyReference();
  const render = useRenderProject();
  const cancelJob = useCancelStudioJob();
  const delAsset = useDeleteStudioAsset();
  const delProject = useDeleteStudioProject();
  const pending = useStudioStore((st) => st.pending[projectId]);
  const setPending = useStudioStore((st) => st.setPending);

  const p = q.data;
  const [editing, setEditing] = useState<Editing>(null);
  const [cutOpen, setCutOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone?: 'danger' } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [uploading, setUploading] = useState<{ label: string; progress: number } | null>(null);
  const [cutList, setCutList] = useState<string[] | null>(null);
  const runningSetup = useRef(false);

  const assets = useMemo(() => new Map((p?.assets ?? []).map((a) => [a.id, a])), [p?.assets]);
  const sources = (p?.assets ?? []).filter((a) => a.role === 'source');
  const busyJobs = (p?.active_jobs ?? []).filter((j) => ['probe', 'fetch_link', 'transcribe'].includes(j.type));
  const renderJobs = (p?.active_jobs ?? []).filter((j) => j.type.startsWith('render') || j.type === 'analyze_reference');

  /** Save an edited EDL (optimistic revision check: 409 → reload). */
  async function save(edl: Edl) {
    if (!p || guest) return;
    try {
      await update.mutateAsync({ id: p.id, edl, revision: p.revision });
      setConflict(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        q.refetch();
      } else setNotice({ text: errorText(e), tone: 'danger' });
    }
  }

  // Run what the wizard asked for once every clip is processed (and the reference analysed).
  useEffect(() => {
    if (!p || !pending || runningSetup.current || guest) return;
    const sourcesBusy = sources.some((a) => ['pending', 'fetching', 'processing'].includes(a.status)) || busyJobs.length > 0;
    const ref = p.assets.find((a) => a.role === 'reference');
    const waitingRef = pending.applyReference && ref && ref.status !== 'failed' && !p.style_profile;
    if (sourcesBusy || waitingRef || !sources.some((a) => a.status === 'ready')) return;
    runningSetup.current = true;
    (async () => {
      try {
        if (pending.applyReference && p.style_profile) {
          const r = await applyRef.mutateAsync(p.id);
          setNotice({ text: `Reference style applied: ${r.changes.join(', ') || 'no changes'}.` });
        }
        if (pending.autoCut) {
          const job = await autoCut.mutateAsync({ projectId: p.id, ...pending.autoCut });
          const result = job.result as { cut_list?: string[] } | null;
          setCutList(result?.cut_list ?? null);
        }
        setPending(p.id, null);
      } catch (e) {
        setNotice({ text: errorText(e), tone: 'danger' });
        setPending(p.id, null);
      } finally {
        runningSetup.current = false;
        q.refetch();
      }
    })();
  }, [p, pending, sources, busyJobs.length, guest, applyRef, autoCut, setPending, q]);

  async function startRender(quality: 'preview' | 'final') {
    if (!p || !requireAccount('Sign in to render videos.')) return;
    try {
      await render.mutateAsync({ projectId: p.id, quality });
      setNotice({ text: quality === 'final' ? 'Final render queued. We will notify you when it is ready.' : 'Preview render queued.' });
      q.refetch();
    } catch (e) {
      setNotice({ text: errorText(e), tone: 'danger' });
    }
  }

  async function addMedia(role: AssetRole) {
    if (!p || !requireAccount('Sign in to add media.')) return;
    try {
      let file: { uri: string; name: string; type: string } | null = null;
      if (role === 'music') {
        const res = await DocumentPicker.getDocumentAsync({ type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/*'], copyToCacheDirectory: true });
        if (res.canceled) return;
        const a = res.assets[0];
        file = { uri: a.uri, name: a.name, type: a.mimeType ?? 'audio/mpeg' };
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: role === 'source' || role === 'reference' ? ['videos'] : ['images'], allowsMultipleSelection: false });
        if (res.canceled || !res.assets.length) return;
        const a = res.assets[0];
        const name = a.fileName || a.uri.split('/').pop() || 'file';
        const ext = name.split('.').pop()?.toLowerCase();
        const type = a.mimeType ?? (a.type === 'image' ? (ext === 'png' ? 'image/png' : 'image/jpeg') : ext === 'mov' ? 'video/quicktime' : 'video/mp4');
        file = { uri: a.uri, name, type };
      }
      setUploading({ label: `Uploading ${ROLE_LABEL[role].toLowerCase()}`, progress: 0 });
      await uploadStudioAsset({ projectId: p.id, role, file }, (f) => setUploading({ label: `Uploading ${ROLE_LABEL[role].toLowerCase()}`, progress: f }));
      q.refetch();
    } catch (e) {
      setNotice({ text: errorText(e), tone: 'danger' });
    } finally {
      setUploading(null);
    }
  }

  function confirmDeleteProject() {
    if (!p) return;
    Alert.alert('Delete project?', 'Its clips and renders are deleted from ClipPipeline. Posts you already published stay up.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await delProject.mutateAsync(p.id);
            router.replace('/studio');
          } catch (e) {
            setNotice({ text: errorText(e), tone: 'danger' });
          }
        },
      },
    ]);
  }

  if (!p) {
    return (
      <SafeAreaView style={ui.safe} edges={['top']}>
        <Header title="Project" />
        <View style={st.center}>{q.isError ? <InlineMessage icon="error-outline" tone="danger" text={errorText(q.error)} /> : <ActivityIndicator color={C.primary} />}</View>
      </SafeAreaView>
    );
  }

  const edl = p.edl;
  const total = edlSeconds(edl);
  const last = renders.data?.[0] ?? p.last_render;
  const preparing = !!pending && !guest;

  return (
    <SafeAreaView style={ui.safe} edges={['top']}>
      <StatusBar style="light" />
      <Header
        title={p.title}
        subtitle={`${p.aspect} · ${secs(total)} · revision ${p.revision}`}
        right={
          <Pressable accessibilityLabel="Delete project" hitSlop={8} style={ui.iconBtn} onPress={confirmDeleteProject} disabled={guest}>
            <MaterialIcons name="delete-outline" size={22} color={C.muted} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={ui.page} refreshControl={<RefreshControl tintColor={C.primary} refreshing={q.isRefetching} onRefresh={() => !guest && q.refetch()} />}>
        {guest ? <InlineMessage icon="lock-outline" text="Sample project — sign in to edit and render your own." /> : null}
        {conflict ? <InlineMessage icon="sync-problem" tone="danger" text="This project changed on another device. We loaded the latest version; make your change again." /> : null}
        {notice ? <InlineMessage icon={notice.tone ? 'error-outline' : 'check-circle'} tone={notice.tone} text={notice.text} /> : null}

        {/* Preview */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={last ? 'Watch the latest render' : 'No render yet'}
          disabled={!last || guest}
          onPress={() => last && router.push({ pathname: '/studio/render/[id]', params: { id: String(last.id), projectId: String(p.id) } })}
          style={[st.preview, { aspectRatio: p.aspect === '9:16' ? 9 / 12 : p.aspect === '1:1' ? 1 : 16 / 9 }]}
        >
          <LinearGradient colors={[C.violet, '#141420']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {last?.poster_url || p.poster_url ? <Image source={{ uri: (last?.poster_url ?? p.poster_url)! }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
          <View style={st.previewCenter}>
            <MaterialIcons name={last ? 'play-circle-filled' : 'movie-creation'} size={56} color="#fff" />
            <Text style={st.previewText}>{last ? `Watch ${last.quality} render` : 'Render a preview to watch your edit'}</Text>
          </View>
        </Pressable>

        {preparing ? (
          <Card>
            <View style={st.row}>
              <ActivityIndicator color={C.primary} />
              <Text style={[ui.label, ui.flex]}>Preparing your clips</Text>
            </View>
            <Text style={ui.muted}>
              Studio is processing and transcribing the clips{pending?.applyReference ? ' and analysing the reference' : ''}. {pending?.autoCut ? 'Auto-cut runs as soon as they are ready.' : ''} You can leave this screen.
            </Text>
          </Card>
        ) : null}

        {cutList ? (
          <Card>
            <SectionTitle right={<Pressable onPress={() => setCutList(null)}><MaterialIcons name="close" size={20} color={C.muted} /></Pressable>}>Auto-cut result</SectionTitle>
            {cutList.map((line, i) => (
              <Text key={i} style={ui.muted}>• {line}</Text>
            ))}
          </Card>
        ) : null}

        {[...busyJobs, ...renderJobs].length ? (
          <Card>
            {[...busyJobs, ...renderJobs].map((j: StudioJob) => (
              <JobRow key={j.id} job={j} onCancel={j.type.startsWith('render') ? () => cancelJob.mutate(j.id) : undefined} />
            ))}
          </Card>
        ) : null}
        {uploading ? (
          <Card>
            <JobRow job={{ id: 'up', type: 'probe', status: 'running', progress: uploading.progress, message: uploading.label, error: null, project_id: p.id, asset_id: null, attempts: 1, result: null, created_at: '', started_at: null, finished_at: null }} />
          </Card>
        ) : null}

        {/* Actions */}
        <View style={st.actions}>
          <PrimaryButton style={ui.flex} label="Preview" icon="play-arrow" loading={render.isPending} disabled={guest || !edl.main.length} onPress={() => startRender('preview')} />
          <GhostButton style={[ui.flex, { height: 52 }]} label="Final MP4" icon="high-quality" disabled={guest || !edl.main.length} onPress={() => startRender('final')} />
        </View>
        <View style={ui.swatches}>
          {sources.length && !guest ? <Chip label="Auto-cut" icon="content-cut" onPress={() => setCutOpen(true)} /> : null}
          {p.has_style_profile && !guest ? (
            <Chip
              label="Apply reference style"
              icon="style"
              onPress={async () => {
                try {
                  const r = await applyRef.mutateAsync(p.id);
                  setNotice({ text: `Reference style applied: ${r.changes.join(', ') || 'no changes'}.` });
                } catch (e) {
                  setNotice({ text: errorText(e), tone: 'danger' });
                }
              }}
            />
          ) : null}
          {p.can_undo_auto_cut && !guest ? <Chip label="Undo auto-cut" icon="undo" onPress={() => undo.mutate(p.id, { onError: (e) => setNotice({ text: errorText(e), tone: 'danger' }) })} /> : null}
        </View>

        {/* Timeline */}
        <SectionTitle right={<Chip label="Templates" icon="auto-awesome" onPress={() => router.push({ pathname: '/studio/templates', params: { projectId: String(p.id) } })} />}>Timeline</SectionTitle>
        {edl.main.length === 0 ? <Text style={ui.muted}>Clips appear here once they are processed.</Text> : null}
        {edl.main.map((seg, i) => (
          <SegmentRow
            key={seg.id}
            seg={seg}
            asset={seg.type === 'clip' ? assets.get(seg.asset_id) : undefined}
            first={i === 0}
            last={i === edl.main.length - 1}
            onUp={() => save(moveSegment(edl, i, -1))}
            onDown={() => save(moveSegment(edl, i, 1))}
            onPress={() => setEditing({ kind: 'segment', id: seg.id })}
            disabled={guest}
          />
        ))}

        <SectionTitle>Overlays and captions</SectionTitle>
        <Card style={{ gap: 4, paddingVertical: 8 }}>
          <Pressable style={st.listRow} onPress={() => setEditing({ kind: 'captions' })} disabled={guest}>
            <MaterialIcons name="subtitles" size={20} color={edl.captions.enabled ? C.primary : C.muted} />
            <Text style={[ui.label, ui.flex]}>Captions</Text>
            <Text style={ui.muted}>{edl.captions.enabled ? templateLabel(edl.captions.template) : 'Off'}</Text>
            <MaterialIcons name="chevron-right" size={20} color={C.muted} />
          </Pressable>
          {edl.overlays.map((o) => (
            <Pressable key={o.id} style={st.listRow} onPress={() => setEditing({ kind: 'overlay', id: o.id })} disabled={guest}>
              <MaterialIcons name="layers" size={20} color={C.primary} />
              <Text style={[ui.label, ui.flex]}>{templateLabel(o.template)}</Text>
              <Text style={ui.muted}>{secs(o.duration)}</Text>
              <MaterialIcons name="chevron-right" size={20} color={C.muted} />
            </Pressable>
          ))}
        </Card>

        {/* Media */}
        <SectionTitle>Media</SectionTitle>
        <Card style={{ gap: 6 }}>
          {p.assets.map((a) => (
            <AssetRow key={a.id} a={a} onDelete={() => Alert.alert('Remove this file?', 'It is also removed from the timeline.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => delAsset.mutate(a.id) }])} disabled={guest} />
          ))}
          <View style={ui.swatches}>
            <Chip label="Clip" icon="add" onPress={() => addMedia('source')} />
            <Chip label="Music" icon="music-note" onPress={() => addMedia('music')} />
            <Chip label="Logo" icon="image" onPress={() => addMedia('logo')} />
            <Chip label="Image" icon="photo" onPress={() => addMedia('image')} />
            {!p.assets.some((a) => a.role === 'reference') ? <Chip label="Reference" icon="style" onPress={() => addMedia('reference')} /> : null}
          </View>
          <Text style={ui.mutedSmall}>Music comes from you: only use tracks you have the rights to.</Text>
        </Card>

        {/* Renders */}
        {(renders.data ?? []).length ? (
          <>
            <SectionTitle>Renders</SectionTitle>
            {(renders.data ?? []).map((r) => (
              <Pressable key={r.id} style={[ui.card, st.renderRow]} disabled={guest} onPress={() => router.push({ pathname: '/studio/render/[id]', params: { id: String(r.id), projectId: String(p.id) } })}>
                <MaterialIcons name={r.quality === 'final' ? 'high-quality' : 'slow-motion-video'} size={22} color={C.primary} />
                <View style={ui.flex}>
                  <Text style={ui.label}>{r.quality === 'final' ? 'Final' : 'Preview'} · {r.width}×{r.height}</Text>
                  <Text style={ui.mutedSmall}>
                    {secs(r.duration_seconds)} · {r.check?.lufs != null ? `${r.check.lufs} LUFS` : ''} {r.post_id ? '· cross-posted' : ''}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.muted} />
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>

      <AutoCutSheet
        visible={cutOpen}
        onClose={() => setCutOpen(false)}
        hasReference={p.has_style_profile}
        loading={autoCut.isPending}
        onRun={async (opts) => {
          try {
            const job = await autoCut.mutateAsync({ projectId: p.id, ...opts });
            setCutList((job.result as { cut_list?: string[] } | null)?.cut_list ?? null);
            setCutOpen(false);
          } catch (e) {
            setNotice({ text: errorText(e), tone: 'danger' });
            setCutOpen(false);
          }
        }}
      />
      {editing ? <EditSheet p={p} editing={editing} onClose={() => setEditing(null)} onSave={(e) => save(e).then(() => setEditing(null))} /> : null}
    </SafeAreaView>
  );
}

function SegmentRow({ seg, asset, first, last, onUp, onDown, onPress, disabled }: { seg: EdlSegment; asset?: StudioAsset; first: boolean; last: boolean; onUp: () => void; onDown: () => void; onPress: () => void; disabled?: boolean }) {
  const isClip = seg.type === 'clip';
  return (
    <View style={st.seg}>
      <Pressable style={st.segMain} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Edit ${isClip ? asset?.original_name ?? 'clip' : seg.template}`}>
        <View style={st.segThumb}>
          {isClip && asset?.poster_url ? <Image source={{ uri: asset.poster_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MaterialIcons name={isClip ? 'movie' : 'auto-awesome'} size={22} color={C.primary} />}
        </View>
        <View style={ui.flex}>
          <Text style={ui.label} numberOfLines={1}>{isClip ? asset?.original_name ?? `Clip ${seg.asset_id}` : templateLabel(seg.template)}</Text>
          <Text style={ui.mutedSmall} numberOfLines={1}>
            {secs(segmentSeconds(seg))}
            {isClip ? ` · ${secs(seg.in)}–${secs(seg.out)}` : ''}
            {isClip && (seg.zoom ?? 1) > 1 ? ' · zoom' : ''}
            {seg.transition_in ? ` · ${templateLabel(seg.transition_in.template).toLowerCase()} in` : ''}
          </Text>
        </View>
      </Pressable>
      <View style={st.segBtns}>
        <Pressable accessibilityLabel="Move up" hitSlop={6} disabled={first || disabled} onPress={onUp} style={[st.arrow, (first || disabled) && ui.disabled]}>
          <MaterialIcons name="keyboard-arrow-up" size={22} color={C.text} />
        </Pressable>
        <Pressable accessibilityLabel="Move down" hitSlop={6} disabled={last || disabled} onPress={onDown} style={[st.arrow, (last || disabled) && ui.disabled]}>
          <MaterialIcons name="keyboard-arrow-down" size={22} color={C.text} />
        </Pressable>
      </View>
    </View>
  );
}

function AssetRow({ a, onDelete, disabled }: { a: StudioAsset; onDelete: () => void; disabled?: boolean }) {
  const busy = ['pending', 'fetching', 'processing'].includes(a.status);
  return (
    <View style={st.listRow}>
      {busy ? <ActivityIndicator size="small" color={C.primary} /> : <MaterialIcons name={a.status === 'failed' ? 'error-outline' : a.role === 'music' ? 'music-note' : a.role === 'reference' ? 'style' : a.role === 'source' ? 'movie' : 'image'} size={20} color={a.status === 'failed' ? C.danger : C.primary} />}
      <View style={ui.flex}>
        <Text style={ui.label} numberOfLines={1}>{a.original_name ?? `#${a.id}`}</Text>
        <Text style={[ui.mutedSmall, a.status === 'failed' && { color: C.danger }]} numberOfLines={2}>
          {ROLE_LABEL[a.role]} · {a.status === 'failed' ? a.error ?? 'Failed' : busy ? 'Processing…' : [secs(a.duration_seconds), a.has_transcript ? 'transcribed' : null, a.role === 'reference' && a.style_profile ? `${a.style_profile.pace ?? ''} pace` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable accessibilityLabel="Remove" hitSlop={8} onPress={onDelete} disabled={disabled}>
        <MaterialIcons name="close" size={20} color={C.muted} />
      </Pressable>
    </View>
  );
}

function AutoCutSheet({ visible, onClose, onRun, hasReference, loading }: { visible: boolean; onClose: () => void; onRun: (o: { remove_silences: boolean; remove_fillers: boolean; silence_min_seconds: number; max_segment_seconds: number | null; use_reference_style: boolean; filler_words: string[] }) => void; hasReference: boolean; loading: boolean }) {
  const [silences, setSilences] = useState(true);
  const [fillers, setFillers] = useState(true);
  const [minPause, setMinPause] = useState(0.6);
  const [maxSeg, setMaxSeg] = useState<number | null>(null);
  const [useRef_, setUseRef] = useState(hasReference);
  const [words, setWords] = useState('um, uh, er, ehm, hmm');
  return (
    <Sheet visible={visible} onClose={onClose} title="Auto-cut" subtitle="Cuts on word boundaries. You can undo it once." scroll>
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <ToggleRow label="Remove silences" value={silences} onChange={setSilences} />
        {silences ? (
          <View style={ui.swatches}>
            {[0.4, 0.6, 1.0].map((v) => (
              <Chip key={v} label={`Pauses ≥ ${v} s`} active={minPause === v} onPress={() => setMinPause(v)} />
            ))}
          </View>
        ) : null}
        <ToggleRow label="Remove filler words" value={fillers} onChange={setFillers} />
        {fillers ? <TextInput style={ui.input} value={words} onChangeText={setWords} placeholder="um, uh" placeholderTextColor={C.muted} autoCapitalize="none" /> : null}
        <Text style={ui.fieldLabel}>Split long segments</Text>
        <View style={ui.swatches}>
          {[null, 2, 3, 5].map((v) => (
            <Chip key={String(v)} label={v ? `Every ~${v} s` : 'Off'} active={maxSeg === v} onPress={() => setMaxSeg(v)} />
          ))}
        </View>
        {hasReference ? <ToggleRow label="Use the reference pace" value={useRef_} onChange={setUseRef} /> : null}
        <PrimaryButton
          label="Run auto-cut"
          icon="content-cut"
          loading={loading}
          onPress={() =>
            onRun({
              remove_silences: silences,
              remove_fillers: fillers,
              silence_min_seconds: minPause,
              max_segment_seconds: maxSeg,
              use_reference_style: hasReference && useRef_,
              filler_words: words.split(',').map((w) => w.trim()).filter(Boolean).slice(0, 50),
            })
          }
        />
      </View>
    </Sheet>
  );
}

function EditSheet({ p, editing, onClose, onSave }: { p: StudioProjectDetail; editing: NonNullable<Editing>; onClose: () => void; onSave: (edl: Edl) => void }) {
  const edl = p.edl;
  const seg = editing.kind === 'segment' ? edl.main.find((x) => x.id === editing.id) : undefined;
  const overlay = editing.kind === 'overlay' ? edl.overlays.find((x) => x.id === editing.id) : undefined;
  const slug = seg?.type === 'template' ? seg.template : overlay?.template ?? (editing.kind === 'captions' ? edl.captions.template : null);
  const tq = useStudioTemplate(slug);
  const [props, setProps] = useState<Record<string, unknown>>(() => asProps(seg?.type === 'template' ? seg.props : overlay?.props ?? (editing.kind === 'captions' ? edl.captions.props : {})));
  const [clip, setClip] = useState<EdlClip | null>(seg?.type === 'clip' ? seg : null);
  const [duration, setDuration] = useState<number>(seg?.type === 'template' ? seg.duration : overlay?.duration ?? 3);
  const [captionsOn, setCaptionsOn] = useState(edl.captions.enabled);
  const asset = clip ? p.assets.find((a) => a.id === clip.asset_id) : undefined;
  const t = tq.data;

  function apply() {
    let next = edl;
    if (clip && seg) next = updateSegment(edl, seg.id, clip);
    else if (seg?.type === 'template') next = updateSegment(edl, seg.id, { props, duration } as Partial<EdlSegment>);
    else if (overlay) next = { ...edl, overlays: edl.overlays.map((o) => (o.id === overlay.id ? { ...o, props, duration } : o)) };
    else if (editing.kind === 'captions') next = { ...edl, captions: { ...edl.captions, enabled: captionsOn, props } };
    onSave(next);
  }

  function remove() {
    if (seg) onSave(removeSegment(edl, seg.id));
    else if (overlay) onSave({ ...edl, overlays: edl.overlays.filter((o) => o.id !== overlay.id) });
  }

  return (
    <Sheet visible onClose={onClose} title={clip ? asset?.original_name ?? 'Clip' : t?.name ?? slug ?? 'Edit'} scroll>
      <View style={{ gap: 14, paddingBottom: 12 }}>
        {clip && asset ? (
          <>
            <TrimBar asset={asset} inSec={clip.in} outSec={clip.out} onChange={(a, b) => setClip({ ...clip, in: a, out: b })} />
            <Text style={ui.fieldLabel}>Speed</Text>
            <View style={ui.swatches}>
              {[0.5, 1, 1.25, 1.5, 2].map((v) => (
                <Chip key={v} label={`${v}×`} active={(clip.speed ?? 1) === v} onPress={() => setClip({ ...clip, speed: v })} />
              ))}
            </View>
            <Text style={ui.fieldLabel}>Zoom</Text>
            <View style={ui.swatches}>
              {[1, 1.08, 1.15, 1.3].map((v) => (
                <Chip key={v} label={v === 1 ? 'None' : `${Math.round((v - 1) * 100)}%`} active={(clip.zoom ?? 1) === v} onPress={() => setClip({ ...clip, zoom: v })} />
              ))}
            </View>
            <Text style={ui.fieldLabel}>Volume</Text>
            <View style={ui.swatches}>
              {[-60, -12, -6, 0, 6].map((v) => (
                <Chip key={v} label={v === -60 ? 'Mute' : `${v > 0 ? '+' : ''}${v} dB`} active={(clip.volume_db ?? 0) === v} onPress={() => setClip({ ...clip, volume_db: v })} />
              ))}
            </View>
            <GhostButton label="Split in the middle" icon="call-split" onPress={() => onSave(splitClip(edl, clip.id, (clip.in + clip.out) / 2))} />
          </>
        ) : null}

        {editing.kind === 'captions' ? <ToggleRow label="Show captions" value={captionsOn} onChange={setCaptionsOn} /> : null}

        {t && !clip ? (
          <>
            {editing.kind !== 'captions' ? (
              <>
                <Text style={ui.fieldLabel}>Duration</Text>
                <View style={ui.swatches}>
                  {[1.5, 2.5, 3, 4, 5, 8].filter((v) => v >= t.min_duration && v <= t.max_duration).map((v) => (
                    <Chip key={v} label={`${v} s`} active={duration === v} onPress={() => setDuration(v)} />
                  ))}
                </View>
              </>
            ) : null}
            <PropsForm schema={t.props_schema} value={{ ...asProps(t.default_props), ...props }} onChange={setProps} assets={p.assets} />
          </>
        ) : !clip ? <ActivityIndicator color={C.primary} /> : null}

        <PrimaryButton label="Save" icon="check" onPress={apply} />
        {seg || overlay ? <GhostButton label="Remove from timeline" icon="delete-outline" danger onPress={remove} /> : null}
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  preview: { width: '100%', maxHeight: 420, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  previewCenter: { alignItems: 'center', gap: 8, padding: 16 },
  previewText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  seg: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  segMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  segThumb: { width: 48, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  segBtns: { gap: 2 },
  arrow: { width: 36, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.raised },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  renderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
