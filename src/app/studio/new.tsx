import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform as RNPlatform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorText } from '@/api/client';
import { uploadStudioAsset, useAddStudioLink, useCreateStudioProject, useStudioTemplate, useUpdateStudioProject } from '@/api/hooks';
import type { Aspect, Edl } from '@/api/types';
import { C, Card, Chip, GhostButton, Header, PrimaryButton, Progress, ToggleRow, s as ui, secs } from '@/components/studio/ui';
import { InlineMessage } from '@/components/ui-kit';
import { newId } from '@/lib/studio';
import { useStudioStore } from '@/store/studioStore';
import { requireAccount } from '@/store/uiStore';

type Picked = { uri: string; name: string; type: string; duration: number | null };
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

function mimeOf(name: string, mime?: string | null): string {
  if (mime && VIDEO_TYPES.includes(mime)) return mime;
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
}

async function pickVideos(multiple: boolean): Promise<Picked[]> {
  if (RNPlatform.OS === 'ios') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Allow photo library access to pick videos.');
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: multiple, selectionLimit: multiple ? 10 : 1 });
  if (res.canceled) return [];
  return res.assets.map((a) => {
    const name = a.fileName || a.uri.split('/').pop() || `clip-${a.assetId ?? Math.random().toString(36).slice(2)}.mp4`;
    return { uri: a.uri, name, type: mimeOf(name, a.mimeType), duration: a.duration != null ? a.duration / 1000 : null };
  });
}

const STEPS = ['Clips', 'Reference', 'Format', 'Clean-up', 'Graphics'] as const;
const ASPECTS: { key: Aspect; label: string; hint: string; w: number; h: number }[] = [
  { key: '9:16', label: 'Vertical', hint: 'TikTok, Reels, Shorts', w: 27, h: 48 },
  { key: '1:1', label: 'Square', hint: 'Feed posts', w: 40, h: 40 },
  { key: '16:9', label: 'Landscape', hint: 'YouTube, web', w: 56, h: 32 },
];

export default function NewStudioProject() {
  const create = useCreateStudioProject();
  const update = useUpdateStudioProject();
  const addLink = useAddStudioLink();
  const setPending = useStudioStore((st) => st.setPending);
  const titleT = useStudioTemplate('kinetic-title');
  const outroT = useStudioTemplate('cta-outro');
  const lowerT = useStudioTemplate('lower-third');

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [clips, setClips] = useState<Picked[]>([]);
  const [refFile, setRefFile] = useState<Picked | null>(null);
  const [refLink, setRefLink] = useState('');
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [silences, setSilences] = useState(true);
  const [fillers, setFillers] = useState(true);
  const [captions, setCaptions] = useState<'none' | 'captions-pop' | 'captions-clean'>('captions-pop');
  const [matchRef, setMatchRef] = useState(true);
  const [intro, setIntro] = useState(true);
  const [introText, setIntroText] = useState('');
  const [outro, setOutro] = useState(false);
  const [handle, setHandle] = useState('');
  const [lower, setLower] = useState(false);
  const [lowerName, setLowerName] = useState('');
  const [lowerRole, setLowerRole] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const hasRef = !!refFile || refLink.trim().length > 0;
  const total = clips.reduce((t, c) => t + (c.duration ?? 0), 0);

  async function addClips() {
    setError(null);
    try {
      const picked = await pickVideos(true);
      if (!picked.length) return;
      const bad = picked.find((p) => !VIDEO_TYPES.includes(p.type));
      if (bad) return setError(`${bad.name}: pick MP4, MOV or WebM videos.`);
      setClips((c) => [...c, ...picked].slice(0, 10));
      if (!title) setTitle(picked[0].name.replace(/\.[^.]+$/, '').slice(0, 60));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function pickReference() {
    setError(null);
    try {
      const [p] = await pickVideos(false);
      if (p) {
        setRefFile(p);
        setRefLink('');
      }
    } catch (e) {
      setError(errorText(e));
    }
  }

  function next() {
    setError(null);
    if (step === 0 && !clips.length) return setError('Add at least one clip.');
    if (step === 1 && refLink.trim() && !/^https:\/\//i.test(refLink.trim())) return setError('Paste an https:// link, or upload the reference file instead.');
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function createProject() {
    if (!requireAccount('Sign in to create a Studio project.')) return;
    setError(null);
    try {
      setBusy('Creating project');
      const project = await create.mutateAsync({ title: title.trim() || 'Untitled project', aspect });

      // Templates and captions go into the EDL first; the server inserts each clip as it is processed.
      const edl: Edl = JSON.parse(JSON.stringify(project.edl));
      const introDuration = titleT.data?.default_duration ?? 2.5;
      if (intro) {
        edl.main.push({ id: newId(), type: 'template', template: 'kinetic-title', version: titleT.data?.version ?? 1, duration: introDuration, props: { ...(titleT.data?.default_props ?? {}), title: (introText.trim() || title.trim() || 'New video').slice(0, 60), kicker: '', subtitle: '' } });
      }
      if (outro) {
        edl.main.push({ id: newId(), type: 'template', template: 'cta-outro', version: outroT.data?.version ?? 1, duration: outroT.data?.default_duration ?? 3, slot: 'outro', props: { ...(outroT.data?.default_props ?? {}), handle: (handle.trim() || '@you').slice(0, 40) } });
      }
      if (lower && lowerName.trim()) {
        edl.overlays.push({ id: newId('o'), template: 'lower-third', version: lowerT.data?.version ?? 1, anchor: null, offset: (intro ? introDuration : 0) + 0.6, duration: lowerT.data?.default_duration ?? 3.5, props: { ...(lowerT.data?.default_props ?? {}), name: lowerName.trim().slice(0, 40), role: lowerRole.trim().slice(0, 60) } });
      }
      edl.captions = { ...edl.captions, enabled: captions !== 'none', template: captions === 'none' ? edl.captions.template : captions, version: 1, props: {} };
      if (edl.main.length || edl.overlays.length || captions !== 'none') {
        await update.mutateAsync({ id: project.id, edl, revision: project.revision });
      }

      for (let i = 0; i < clips.length; i++) {
        setBusy(`Uploading clip ${i + 1} of ${clips.length}`);
        setProgress(0);
        await uploadStudioAsset({ projectId: project.id, role: 'source', file: clips[i] }, setProgress);
      }
      if (refFile) {
        setBusy('Uploading reference');
        setProgress(0);
        await uploadStudioAsset({ projectId: project.id, role: 'reference', file: refFile }, setProgress);
      } else if (refLink.trim()) {
        setBusy('Adding reference link');
        try {
          await addLink.mutateAsync({ projectId: project.id, url: refLink.trim(), role: 'reference' });
        } catch (e) {
          setError(`Reference skipped: ${errorText(e)}`);
        }
      }

      setPending(project.id, {
        autoCut: silences || fillers ? { remove_silences: silences, remove_fillers: fillers, use_reference_style: hasRef && matchRef } : null,
        applyReference: hasRef && matchRef,
      });
      router.replace({ pathname: '/studio/[id]', params: { id: String(project.id) } });
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={ui.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <Header title="New Studio project" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} onBack={() => (step > 0 && !busy ? setStep(step - 1) : router.back())} />
      <View style={st.steps}>
        {STEPS.map((label, i) => (
          <View key={label} style={[st.stepBar, i <= step && st.stepOn]} />
        ))}
      </View>

      <KeyboardAvoidingView style={ui.flex} behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <>
              <Text style={st.h}>Pick your clips</Text>
              <Text style={ui.muted}>Up to 10 videos. They are joined in this order; you can reorder later.</Text>
              <Card>
                {clips.map((c, i) => (
                  <View key={`${c.uri}-${i}`} style={st.clipRow}>
                    <MaterialIcons name="movie" size={20} color={C.primary} />
                    <Text style={[ui.label, ui.flex]} numberOfLines={1}>{c.name}</Text>
                    <Text style={ui.mutedSmall}>{secs(c.duration)}</Text>
                    <Pressable accessibilityLabel={`Remove ${c.name}`} hitSlop={8} onPress={() => setClips((x) => x.filter((_, j) => j !== i))}>
                      <MaterialIcons name="close" size={20} color={C.muted} />
                    </Pressable>
                  </View>
                ))}
                <GhostButton label={clips.length ? 'Add more clips' : 'Choose videos'} icon="video-library" onPress={addClips} />
                {clips.length ? <Text style={ui.mutedSmall}>{clips.length} clip{clips.length === 1 ? '' : 's'} · {secs(total)} in total</Text> : null}
              </Card>
              <Text style={ui.fieldLabel}>Project name</Text>
              <TextInput style={ui.input} value={title} onChangeText={setTitle} maxLength={120} placeholder="My video" placeholderTextColor={C.muted} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={st.h}>Match a style (optional)</Text>
              <Text style={ui.muted}>Add a video whose editing style you like. Studio measures its pace, captions and colours. The reference is only analysed, never used in your video, and it is deleted after analysis.</Text>
              <Card>
                <GhostButton label={refFile ? `Reference: ${refFile.name}` : 'Upload a reference video'} icon="style" onPress={pickReference} />
                <Text style={[ui.mutedSmall, { textAlign: 'center' }]}>or paste a direct link to a video file</Text>
                <TextInput style={ui.input} value={refLink} onChangeText={(t) => { setRefLink(t); if (t) setRefFile(null); }} placeholder="https://…/video.mp4" placeholderTextColor={C.muted} autoCapitalize="none" keyboardType="url" />
                <Text style={ui.mutedSmall}>{"TikTok, Instagram, YouTube and Facebook links can't be downloaded: save the video and upload it."}</Text>
                {hasRef ? <GhostButton label="Remove reference" icon="delete-outline" danger onPress={() => { setRefFile(null); setRefLink(''); }} /> : null}
              </Card>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={st.h}>Choose the format</Text>
              <Text style={ui.muted}>Clips of another shape get a blurred background fill.</Text>
              <View style={st.aspects}>
                {ASPECTS.map((a) => (
                  <Pressable key={a.key} accessibilityRole="radio" accessibilityState={{ checked: aspect === a.key }} onPress={() => setAspect(a.key)} style={[st.aspect, aspect === a.key && st.aspectOn]}>
                    <View style={[st.frame, { width: a.w, height: a.h }, aspect === a.key && { borderColor: C.primary }]} />
                    <Text style={ui.label}>{a.label}</Text>
                    <Text style={ui.mutedSmall}>{a.key}</Text>
                    <Text style={[ui.mutedSmall, { textAlign: 'center' }]}>{a.hint}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={st.h}>Clean-up and captions</Text>
              <Card>
                <ToggleRow label="Remove silences" hint="Cuts pauses longer than 0.6 s, on word boundaries" value={silences} onChange={setSilences} />
                <ToggleRow label="Remove filler words" hint="um, uh, er, ehm, hmm" value={fillers} onChange={setFillers} />
                {hasRef ? <ToggleRow label="Match the reference style" hint="Pace, caption style, accent colour, punch-in zooms" value={matchRef} onChange={setMatchRef} /> : null}
              </Card>
              <Text style={ui.fieldLabel}>Captions</Text>
              <View style={ui.swatches}>
                <Chip label="Pop (word by word)" active={captions === 'captions-pop'} onPress={() => setCaptions('captions-pop')} />
                <Chip label="Clean subtitles" active={captions === 'captions-clean'} onPress={() => setCaptions('captions-clean')} />
                <Chip label="No captions" active={captions === 'none'} onPress={() => setCaptions('none')} />
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={st.h}>Add motion graphics</Text>
              <Card>
                <ToggleRow label="Intro title" value={intro} onChange={setIntro} />
                {intro ? <TextInput style={ui.input} value={introText} onChangeText={setIntroText} maxLength={60} placeholder={title || 'Your title'} placeholderTextColor={C.muted} /> : null}
              </Card>
              <Card>
                <ToggleRow label="Name lower third" value={lower} onChange={setLower} />
                {lower ? (
                  <>
                    <TextInput style={ui.input} value={lowerName} onChangeText={setLowerName} maxLength={40} placeholder="Name" placeholderTextColor={C.muted} />
                    <TextInput style={ui.input} value={lowerRole} onChangeText={setLowerRole} maxLength={60} placeholder="Role or tagline" placeholderTextColor={C.muted} />
                  </>
                ) : null}
              </Card>
              <Card>
                <ToggleRow label="Follow outro" value={outro} onChange={setOutro} />
                {outro ? <TextInput style={ui.input} value={handle} onChangeText={setHandle} maxLength={40} placeholder="@yourhandle" placeholderTextColor={C.muted} autoCapitalize="none" /> : null}
              </Card>
              <Text style={ui.mutedSmall}>More templates (charts, phone mockups, transitions…) are in the gallery once the project exists.</Text>
            </>
          ) : null}

          {error ? <InlineMessage icon="error-outline" tone="danger" text={error} /> : null}

          {busy ? (
            <Card>
              <Text style={ui.label}>{busy}…</Text>
              <Progress value={progress} />
              <Text style={ui.mutedSmall}>Keep the app open while uploading.</Text>
            </Card>
          ) : step < STEPS.length - 1 ? (
            <PrimaryButton label={step === 1 && !hasRef ? 'Skip' : 'Continue'} icon="arrow-forward" onPress={next} />
          ) : (
            <PrimaryButton label="Create and upload" icon="cloud-upload" onPress={createProject} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  h: { color: C.text, fontSize: 24, fontWeight: '900' },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 8 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.containerHigh },
  stepOn: { backgroundColor: C.violet },
  clipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  aspects: { flexDirection: 'row', gap: 10 },
  aspect: { flex: 1, alignItems: 'center', gap: 6, padding: 14, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  aspectOn: { borderColor: C.primary, backgroundColor: C.raised },
  frame: { borderRadius: 6, borderWidth: 2, borderColor: C.muted, marginBottom: 6 },
});
