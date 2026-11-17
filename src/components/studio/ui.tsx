import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import type { PropSchema, PropsSchema, StudioAsset, StudioJob, StudioTemplate, TemplateKind } from '@/api/types';
import { AnimatedPressable } from '@/components/ui-kit';

// Kinetic Obsidian tokens (same as post/new.tsx)
export const C = {
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

export const KIND_LABEL: Record<TemplateKind, string> = { segment: 'Scene', overlay: 'Overlay', captions: 'Captions', transition: 'Transition' };

export const JOB_LABEL: Record<string, string> = {
  probe: 'Preparing clip',
  fetch_link: 'Downloading link',
  transcribe: 'Transcribing',
  analyze_reference: 'Analysing reference',
  auto_cut: 'Auto-cut',
  render_preview: 'Rendering preview',
  render_final: 'Rendering final video',
  render_template_preview: 'Template preview',
  explainer: 'Explainer',
};

export function secs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const s = Math.max(0, n);
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

export function Header({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && s.pressed]} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/studio')))}>
        <MaterialIcons name="arrow-back" size={24} color={C.text} />
      </Pressable>
      <View style={s.flex}>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.muted} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={s.headerRight}>{right}</View>
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, disabled, loading, style }: { label: string; icon?: keyof typeof MaterialIcons.glyphMap; onPress: () => void; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || loading} onPress={onPress} style={[s.primary, (disabled || loading) && s.disabled, style]}>
      <LinearGradient colors={[C.violet, C.violetEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {loading ? <ActivityIndicator color="#fff" /> : icon ? <MaterialIcons name={icon} size={20} color="#fff" /> : null}
      <Text style={s.primaryText} numberOfLines={1}>{label}</Text>
    </AnimatedPressable>
  );
}

export function GhostButton({ label, icon, onPress, disabled, danger, style }: { label: string; icon?: keyof typeof MaterialIcons.glyphMap; onPress: () => void; disabled?: boolean; danger?: boolean; style?: StyleProp<ViewStyle> }) {
  const color = danger ? C.danger : C.primary;
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.ghost, disabled && s.disabled, style]}>
      {icon ? <MaterialIcons name={icon} size={18} color={color} /> : null}
      <Text style={[s.ghostText, { color }]} numberOfLines={1}>{label}</Text>
    </AnimatedPressable>
  );
}

export function Chip({ label, active, count, onPress, icon }: { label: string; active?: boolean; count?: number; onPress?: () => void; icon?: keyof typeof MaterialIcons.glyphMap }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={({ pressed }) => [s.chip, active && s.chipActive, pressed && s.pressed]}>
      {icon ? <MaterialIcons name={icon} size={16} color={active ? '#0E0E12' : C.muted} /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
      {count != null ? <Text style={[s.chipCount, active && s.chipTextActive]}>{count}</Text> : null}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Progress({ value, color = C.violet }: { value: number; color?: string }) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.round(Math.max(0.03, Math.min(1, value)) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={[s.toggleRow, disabled && s.disabled]}>
      <View style={s.flex}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.muted}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.violet, false: C.containerHigh }} thumbColor="#fff" />
    </View>
  );
}

export function JobRow({ job, onCancel }: { job: StudioJob; onCancel?: () => void }) {
  const failed = job.status === 'failed';
  return (
    <View style={s.jobRow}>
      <View style={s.jobTop}>
        {job.status === 'running' ? <ActivityIndicator size="small" color={C.primary} /> : <MaterialIcons name={failed ? 'error-outline' : 'schedule'} size={18} color={failed ? C.danger : C.muted} />}
        <Text style={[s.label, s.flex]} numberOfLines={1}>{JOB_LABEL[job.type] ?? job.type}</Text>
        <Text style={s.muted}>{job.status === 'queued' ? 'Waiting for the render server' : `${Math.round(job.progress * 100)}%`}</Text>
        {onCancel && (job.status === 'queued' || job.status === 'running') ? (
          <Pressable accessibilityLabel="Cancel" hitSlop={8} onPress={onCancel}>
            <MaterialIcons name="close" size={18} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
      {job.status === 'running' ? <Progress value={job.progress} /> : null}
      {job.message && job.status === 'running' ? <Text style={s.mutedSmall}>{job.message}</Text> : null}
      {failed && job.error ? <Text style={[s.mutedSmall, { color: C.danger }]}>{job.error}</Text> : null}
    </View>
  );
}

/** Template tile: looping preview when allowed, else the poster (bundled or remote), else a gradient. */
export function TemplateTile({ t, play, width, onPress, selected }: { t: StudioTemplate; play: boolean; width: number; onPress: () => void; selected?: boolean }) {
  const preview = t.previews?.['9:16']?.video_url ?? t.preview_url;
  const poster = t.previews?.['9:16']?.poster_url ?? t.poster_url;
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={`${t.name}, ${KIND_LABEL[t.kind]}`} onPress={onPress} style={[s.tile, { width }, selected && s.tileSelected]}>
      <View style={[s.tileMedia, { height: width * 1.45 }]}>
        <LinearGradient colors={[C.violet, '#14141C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {play && (preview || t.preview_source) ? <LoopVideo source={preview ?? t.preview_source!} /> : poster || t.poster_source ? <Image source={poster ? { uri: poster } : t.poster_source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : (
          <View style={s.tileFallback}>
            <MaterialIcons name={t.kind === 'captions' ? 'subtitles' : t.kind === 'transition' ? 'swap-horiz' : t.kind === 'overlay' ? 'layers' : 'auto-awesome'} size={36} color="#fff" />
          </View>
        )}
        <View style={s.kindBadge}>
          <Text style={s.kindText}>{KIND_LABEL[t.kind]}</Text>
        </View>
      </View>
      <Text style={s.tileName} numberOfLines={1}>{t.name}</Text>
      <Text style={s.mutedSmall} numberOfLines={1}>{t.categories.join(' · ')}</Text>
    </AnimatedPressable>
  );
}

function LoopVideo({ source }: { source: string | number }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const SWATCHES = ['#7C5CFF', '#B14CFF', '#F5D90A', '#FF5A5F', '#28C76F', '#00B8D9', '#FF9F43', '#FFFFFF', '#0E0E12'];

/** Form for a template's props, rendered from its JSON Schema subset (CONTRACT §17.1). */
export function PropsForm({ schema, value, onChange, assets }: { schema: PropsSchema; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; assets: StudioAsset[] }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: 14 }}>
      {Object.entries(schema.properties ?? {}).map(([key, def]) => (
        <View key={key} style={{ gap: 6 }}>
          <Text style={s.fieldLabel}>{def.title ?? key}</Text>
          <Field def={def} value={value[key]} onChange={(v) => set(key, v)} assets={assets} />
        </View>
      ))}
    </View>
  );
}

function Field({ def, value, onChange, assets }: { def: PropSchema; value: unknown; onChange: (v: unknown) => void; assets: StudioAsset[] }) {
  if (def.format === 'color') {
    const v = typeof value === 'string' ? value : '';
    return (
      <View style={s.swatches}>
        <Pressable accessibilityLabel="Use the project colour" onPress={() => onChange('')} style={[s.swatch, s.swatchTheme, v === '' && s.swatchOn]}>
          <Text style={s.mutedSmall}>Theme</Text>
        </Pressable>
        {SWATCHES.map((c) => (
          <Pressable key={c} accessibilityLabel={`Colour ${c}`} onPress={() => onChange(c)} style={[s.swatch, { backgroundColor: c }, v.toUpperCase() === c && s.swatchOn]} />
        ))}
      </View>
    );
  }
  if (def.format?.startsWith('asset:')) {
    const want = def.format === 'asset:video' ? 'video/' : 'image/';
    const options = assets.filter((a) => (a.mime ?? '').startsWith(want) && a.status === 'ready');
    const current = (value as { asset_id?: number } | null)?.asset_id ?? null;
    if (!options.length) return <Text style={s.mutedSmall}>{want === 'image/' ? 'Add an image or logo to this project to use it here.' : 'Add a clip to this project to use it here.'}</Text>;
    return (
      <View style={s.swatches}>
        <Chip label="None" active={current == null} onPress={() => onChange(null)} />
        {options.map((a) => (
          <Chip key={a.id} label={a.original_name ?? `#${a.id}`} active={current === a.id} onPress={() => onChange({ asset_id: a.id })} />
        ))}
      </View>
    );
  }
  if (def.enum) {
    return (
      <View style={s.swatches}>
        {def.enum.map((o) => (
          <Chip key={String(o)} label={String(o)} active={value === o} onPress={() => onChange(o)} />
        ))}
      </View>
    );
  }
  if (def.type === 'boolean') {
    return <Switch value={!!value} onValueChange={onChange} trackColor={{ true: C.violet, false: C.containerHigh }} thumbColor="#fff" />;
  }
  if (def.type === 'number' || def.type === 'integer') {
    const n = typeof value === 'number' ? value : Number(def.default ?? 0);
    const min = def.minimum ?? 0;
    const max = def.maximum ?? 100;
    const step = max - min <= 3 ? 0.1 : max - min <= 100 ? 1 : Math.pow(10, Math.max(0, Math.floor(Math.log10(max - min)) - 2));
    const clamp = (x: number) => Math.min(max, Math.max(min, Math.round(x / step) * step));
    return (
      <View style={s.stepper}>
        <Pressable accessibilityLabel="Less" style={s.stepBtn} onPress={() => onChange(Number(clamp(n - step).toFixed(2)))}>
          <MaterialIcons name="remove" size={20} color={C.text} />
        </Pressable>
        <TextInput
          style={[s.input, s.stepInput]}
          keyboardType="numeric"
          value={String(n)}
          onChangeText={(t) => {
            const x = Number(t.replace(',', '.'));
            if (Number.isFinite(x)) onChange(clamp(x));
          }}
        />
        <Pressable accessibilityLabel="More" style={s.stepBtn} onPress={() => onChange(Number(clamp(n + step).toFixed(2)))}>
          <MaterialIcons name="add" size={20} color={C.text} />
        </Pressable>
        <Text style={s.mutedSmall}>{min}–{max}</Text>
      </View>
    );
  }
  if (def.type === 'array') {
    const list = Array.isArray(value) ? (value as string[]) : [];
    return (
      <TextInput
        style={[s.input, { minHeight: 64 }]}
        multiline
        placeholder="One per line"
        placeholderTextColor={C.muted}
        value={list.join('\n')}
        onChangeText={(t) => onChange(t.split('\n').slice(0, def.maxItems ?? 10).map((x) => x.slice(0, def.items?.maxLength ?? 60)))}
      />
    );
  }
  const str = typeof value === 'string' ? value : '';
  return (
    <TextInput
      style={[s.input, (def.maxLength ?? 0) > 120 && { minHeight: 90, textAlignVertical: 'top' }]}
      multiline={(def.maxLength ?? 0) > 120}
      maxLength={def.maxLength}
      value={str}
      placeholderTextColor={C.muted}
      onChangeText={onChange}
    />
  );
}

export const s = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: C.bg },
  page: { padding: 20, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  muted: { color: C.muted, fontSize: 14 },
  mutedSmall: { color: C.muted, fontSize: 12 },
  label: { color: C.text, fontSize: 15, fontWeight: '600' },
  fieldLabel: { color: C.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  section: { color: C.text, fontSize: 17, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  primary: { height: 52, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ghost: { height: 44, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  ghostText: { fontSize: 14, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#0E0E12' },
  chipCount: { color: C.muted, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.containerHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  jobRow: { gap: 8 },
  jobTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { gap: 6 },
  tileSelected: { opacity: 0.85 },
  tileMedia: { borderRadius: 16, overflow: 'hidden', backgroundColor: C.raised },
  tileFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileName: { color: C.text, fontSize: 14, fontWeight: '700' },
  kindBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(14,14,18,0.75)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  kindText: { color: C.text, fontSize: 11, fontWeight: '700' },
  input: { backgroundColor: C.raised, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  swatchTheme: { width: 64, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderColor: C.primary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  stepInput: { width: 96, textAlign: 'center' },
});
