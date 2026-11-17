import { MaterialIcons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorText } from '@/api/client';
import { useCustomizeTemplate, useIsGuest, useStudioProject, useStudioProjects, useStudioTemplates, useUpdateStudioProject } from '@/api/hooks';
import type { StudioTemplate, TemplateKind } from '@/api/types';
import { Sheet } from '@/components/sheet';
import { C, Chip, Header, KIND_LABEL, PrimaryButton, PropsForm, TemplateTile, s as ui } from '@/components/studio/ui';
import { InlineMessage } from '@/components/ui-kit';
import { addTemplate, asProps, PLACEMENT_LABEL, placements, type AddAs } from '@/lib/studio';
import { useStudioStore } from '@/store/studioStore';
import { requireAccount } from '@/store/uiStore';

const KINDS: (TemplateKind | null)[] = [null, 'segment', 'overlay', 'captions', 'transition'];
const SWATCH = ['#7C5CFF', '#F5D90A', '#FF5A5F', '#28C76F', '#00B8D9', '#FFFFFF'];

export default function TemplateGallery() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<string | null>(null);
  const [kind, setKind] = useState<TemplateKind | null>(null);
  const [sort, setSort] = useState<'popular' | 'new'>('popular');
  const [open, setOpen] = useState<StudioTemplate | null>(null);
  const [tapped, setTapped] = useState<Set<string>>(new Set());
  const paused = useStudioStore((st) => st.pausePreviews);
  const setPaused = useStudioStore((st) => st.setPausePreviews);
  const net = Network.useNetworkState();
  const onWifi = net.type === Network.NetworkStateType.WIFI || net.type === Network.NetworkStateType.ETHERNET;

  const q = useStudioTemplates({ category, kind, sort });
  const data = q.data;
  const cols = width >= 700 ? 3 : 2;
  const tileW = (width - 40 - (cols - 1) * 12) / cols;

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        <Chip label="All" count={data?.total} active={!category} onPress={() => setCategory(null)} />
        {(data?.categories ?? []).map((c) => (
          <Chip key={c.name} label={c.name} count={c.count} active={category === c.name} onPress={() => setCategory(c.name)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        {KINDS.map((k) => (
          <Chip key={String(k)} label={k ? KIND_LABEL[k] : 'Every kind'} active={kind === k} onPress={() => setKind(k)} />
        ))}
      </ScrollView>
      <View style={st.toolbar}>
        <View style={st.segmented}>
          {(['popular', 'new'] as const).map((s) => (
            <Pressable key={s} onPress={() => setSort(s)} style={[st.segBtn, sort === s && st.segOn]}>
              <Text style={[st.segText, sort === s && st.segTextOn]}>{s === 'popular' ? 'Popular' : 'New'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={st.pause}>
          <Text style={ui.mutedSmall}>Pause previews</Text>
          <Switch value={paused} onValueChange={setPaused} trackColor={{ true: C.violet, false: C.containerHigh }} thumbColor="#fff" />
        </View>
      </View>
      {!onWifi && !paused ? <Text style={ui.mutedSmall}>On mobile data: tap a template to play its preview.</Text> : null}
      {q.data?.demo ? <InlineMessage icon="info-outline" text="Showing the built-in template catalogue." /> : null}
    </View>
  );

  return (
    <SafeAreaView style={ui.safe} edges={['top']}>
      <StatusBar style="light" />
      <Header title="Templates" subtitle={projectId ? 'Tap one to add it to your project' : 'Motion graphics for your edits'} />
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : (
        <FlatList
          key={cols}
          data={data?.templates ?? []}
          numColumns={cols}
          keyExtractor={(t) => `${t.slug}@${t.version}`}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListHeaderComponent={header}
          contentContainerStyle={ui.page}
          renderItem={({ item }) => (
            <TemplateTile
              t={item}
              width={tileW}
              play={!paused && (onWifi || tapped.has(item.slug))}
              onPress={() => {
                setTapped((s) => new Set(s).add(item.slug));
                setOpen(item);
              }}
            />
          )}
          ListEmptyComponent={<Text style={ui.muted}>No templates match these filters.</Text>}
        />
      )}
      {open ? <TemplateSheet t={open} projectId={projectId ? Number(projectId) : null} onClose={() => setOpen(null)} /> : null}
    </SafeAreaView>
  );
}

function TemplateSheet({ t, projectId, onClose }: { t: StudioTemplate; projectId: number | null; onClose: () => void }) {
  const guest = useIsGuest();
  const projects = useStudioProjects();
  const [target, setTarget] = useState<number | null>(projectId);
  const project = useStudioProject(target ?? NaN);
  const update = useUpdateStudioProject();
  const customize = useCustomizeTemplate();
  const [props, setProps] = useState<Record<string, unknown>>(asProps(t.default_props));
  const [purpose, setPurpose] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function runCustomize() {
    if (!requireAccount('Sign in to customise templates.')) return;
    setError(null);
    try {
      const r = await customize.mutateAsync({ slug: t.slug, purpose: purpose.trim() || undefined, colors: color ? [color] : undefined, aspect: project.data?.aspect, text: purpose.trim().slice(0, 200) || undefined });
      setProps({ ...props, ...asProps(r.props) });
      setDone(r.source === 'ai' ? 'Filled in by AI. Check the fields below.' : 'Colours and text applied.');
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function add(as: AddAs) {
    if (!requireAccount('Sign in to add templates to a project.')) return;
    const p = project.data;
    if (!p) return setError('Choose a project first.');
    setError(null);
    try {
      await update.mutateAsync({ id: p.id, edl: addTemplate(p.edl, t, props, as), revision: p.revision });
      onClose();
      router.navigate({ pathname: '/studio/[id]', params: { id: String(p.id) } });
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <Sheet visible onClose={onClose} title={t.name} subtitle={`${KIND_LABEL[t.kind]} · ${t.categories.join(', ')}${t.credit ? ` · idea by ${t.credit.handle}` : ''}`} scroll>
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <Text style={ui.fieldLabel}>Customize</Text>
        <TextInput style={ui.input} value={purpose} onChangeText={setPurpose} maxLength={200} placeholder="What is it for? e.g. launch of my skincare line" placeholderTextColor={C.muted} />
        <View style={ui.swatches}>
          {SWATCH.map((c) => (
            <Pressable key={c} accessibilityLabel={`Colour ${c}`} onPress={() => setColor(color === c ? null : c)} style={[ui.swatch, { backgroundColor: c }, color === c && ui.swatchOn]} />
          ))}
        </View>
        <Chip label={customize.isPending ? 'Customizing…' : 'Apply'} icon="auto-fix-high" onPress={runCustomize} />
        {done ? <Text style={[ui.mutedSmall, { color: C.success }]}>{done}</Text> : null}

        <PropsForm schema={t.props_schema} value={props} onChange={setProps} assets={project.data?.assets ?? []} />

        {!projectId && !guest ? (
          <>
            <Text style={ui.fieldLabel}>Add to project</Text>
            <View style={ui.swatches}>
              {(projects.data ?? []).slice(0, 12).map((p) => (
                <Chip key={p.id} label={p.title} active={target === p.id} onPress={() => setTarget(p.id)} />
              ))}
            </View>
            {!projects.data?.length ? <Text style={ui.mutedSmall}>Create a project first.</Text> : null}
          </>
        ) : null}

        {error ? <InlineMessage icon="error-outline" tone="danger" text={error} /> : null}
        {placements(t).map((as) => (
          <PrimaryButton key={as} label={PLACEMENT_LABEL[as]} icon={as === 'captions' ? 'subtitles' : as === 'transition' ? 'swap-horiz' : 'add'} loading={update.isPending} disabled={guest ? false : !project.data} onPress={() => add(as)} />
        ))}
        {guest ? <Text style={[ui.mutedSmall, { textAlign: 'center' }]}>Sign in to use templates in your own videos.</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialIcons name="aspect-ratio" size={14} color={C.muted} />
          <Text style={ui.mutedSmall}>Works in {t.aspects.join(', ')}</Text>
        </View>
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  chips: { gap: 8, paddingRight: 20 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segmented: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.border },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  segOn: { backgroundColor: C.raised },
  segText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  segTextOn: { color: C.text },
  pause: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
