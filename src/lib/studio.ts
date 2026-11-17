import type { Edl, EdlOverlay, EdlSegment, StudioTemplate } from '@/api/types';

export const newId = (prefix = 's') => `${prefix}${Math.random().toString(36).slice(2, 10)}`;

export function segmentSeconds(seg: EdlSegment): number {
  return seg.type === 'clip' ? Math.max(0, (seg.out - seg.in) / (seg.speed || 1)) : seg.duration;
}

export function edlSeconds(edl: Edl): number {
  return edl.main.reduce((t, seg, i) => t + segmentSeconds(seg) - (i > 0 && seg.transition_in ? seg.transition_in.duration : 0), 0);
}

export type AddAs = 'intro' | 'outro' | 'overlay' | 'captions' | 'transition';

/** Where a template can go, from its kind. */
export function placements(t: StudioTemplate): AddAs[] {
  if (t.kind === 'segment') return ['intro', 'outro'];
  if (t.kind === 'overlay') return ['overlay'];
  if (t.kind === 'captions') return ['captions'];
  return ['transition'];
}

export const PLACEMENT_LABEL: Record<AddAs, string> = {
  intro: 'Add as intro',
  outro: 'Add as outro',
  overlay: 'Add as overlay',
  captions: 'Use for captions',
  transition: 'Use between clips',
};

/** Add a template to an EDL (returns a new EDL). */
export function addTemplate(edl: Edl, t: StudioTemplate, props: Record<string, unknown>, as: AddAs): Edl {
  const next: Edl = JSON.parse(JSON.stringify(edl));
  if (as === 'intro' || as === 'outro') {
    const seg = { id: newId(), type: 'template' as const, template: t.slug, version: t.version, duration: t.default_duration, props, ...(as === 'outro' ? { slot: 'outro' } : {}) };
    if (as === 'intro') next.main.unshift(seg);
    else next.main.push(seg);
  } else if (as === 'overlay') {
    const firstClip = next.main.find((s) => s.type === 'clip');
    const o: EdlOverlay = { id: newId('o'), template: t.slug, version: t.version, anchor: firstClip?.id ?? null, offset: firstClip ? 0.5 : 0, duration: t.default_duration, props };
    next.overlays.push(o);
  } else if (as === 'captions') {
    next.captions = { ...next.captions, enabled: true, template: t.slug, version: t.version, props };
  } else {
    // Between every pair of clips.
    next.main = next.main.map((s, i) => (i > 0 ? { ...s, transition_in: { template: t.slug, duration: t.default_duration } } : s));
  }
  return next;
}

export function moveSegment(edl: Edl, index: number, dir: -1 | 1): Edl {
  const j = index + dir;
  if (j < 0 || j >= edl.main.length) return edl;
  const main = [...edl.main];
  [main[index], main[j]] = [main[j], main[index]];
  return { ...edl, main };
}

export function removeSegment(edl: Edl, id: string): Edl {
  return { ...edl, main: edl.main.filter((s) => s.id !== id), overlays: edl.overlays.map((o) => (o.anchor === id ? { ...o, anchor: null } : o)) };
}

export function updateSegment(edl: Edl, id: string, patch: Partial<EdlSegment>): Edl {
  return { ...edl, main: edl.main.map((s) => (s.id === id ? ({ ...s, ...patch } as EdlSegment) : s)) };
}

/** Split a clip at a source time (seconds). */
export function splitClip(edl: Edl, id: string, at: number): Edl {
  const i = edl.main.findIndex((s) => s.id === id);
  const seg = edl.main[i];
  if (!seg || seg.type !== 'clip' || at <= seg.in + 0.3 || at >= seg.out - 0.3) return edl;
  const a = { ...seg, out: at };
  const b = { ...seg, id: newId(), in: at, transition_in: null };
  const main = [...edl.main];
  main.splice(i, 1, a, b);
  return { ...edl, main };
}

/** PHP sends an empty props object as []: normalise to {}. */
export function asProps(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** "kinetic-title" → "Kinetic title" (template names for lists). */
export function templateLabel(slug: string): string {
  const t = slug.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
