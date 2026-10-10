import type { Platform, Post, PostAnalytic } from '@/api/types';

export type PostStatus = 'published' | 'processing' | 'failed';

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
};

export function postStatus(p: Post): PostStatus {
  const d = p.distributions ?? [];
  if (d.some((x) => x.status === 'failed')) return 'failed';
  if (d.some((x) => x.status === 'pending' || x.status === 'processing')) return 'processing';
  if (!p.published_at && d.length === 0) return 'processing';
  return 'published';
}

/** Latest analytics snapshot for a platform. */
export function latestAnalytic(p: Post, platform: Platform): PostAnalytic | undefined {
  const rows = (p.analytics ?? []).filter((a) => a.platform === platform);
  if (!rows.length) return undefined;
  return rows.reduce((a, b) => (new Date(b.recorded_at).getTime() >= new Date(a.recorded_at).getTime() ? b : a));
}

export function totalsFor(p: Post) {
  const out = { views: 0, likes: 0, comments: 0, shares: 0, watch: 0 };
  (['tiktok', 'youtube', 'instagram'] as Platform[]).forEach((pl) => {
    const a = latestAnalytic(p, pl);
    if (!a) return;
    out.views += a.views ?? 0;
    out.likes += a.likes ?? 0;
    out.comments += a.comments ?? 0;
    out.shares += a.shares ?? 0;
    out.watch += a.watch_time ?? 0;
  });
  return out;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export function hashtagsOf(caption: string | null | undefined): string[] {
  return (caption ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

export function captionBody(caption: string | null | undefined): string {
  return (caption ?? '').replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim();
}

/** Percent change of the second half of a trend vs the first half. null when not computable. */
export function trendDelta(trend: { views: number }[] | undefined): number | null {
  if (!trend || trend.length < 2) return null;
  const mid = Math.floor(trend.length / 2);
  const sum = (a: { views: number }[]) => a.reduce((n, x) => n + (x.views ?? 0), 0);
  const first = sum(trend.slice(0, mid));
  const second = sum(trend.slice(mid));
  if (first <= 0) return null;
  return ((second - first) / first) * 100;
}

/** Build a smooth SVG line path from a series in a 340x160 box. Returns null when fewer than 2 points. */
export function buildChart(
  values: number[],
  opts: { w?: number; top?: number; bottom?: number } = {},
) {
  const w = opts.w ?? 340;
  const top = opts.top ?? 24;
  const bottom = opts.bottom ?? 135;
  const n = values.length;
  if (n < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => ({ x: (i / (n - 1)) * w, y: bottom - (Math.max(0, v) / max) * (bottom - top) }));
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` C${cx.toFixed(1)},${p0.y.toFixed(1)} ${cx.toFixed(1)},${p1.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
    len += Math.hypot(p1.x - p0.x, p1.y - p0.y);
  }
  let peak = 0;
  values.forEach((v, i) => {
    if (v > values[peak]) peak = i;
  });
  return { d, len: Math.ceil(len * 1.15) + 10, peak, peakX: pts[peak].x, peakY: pts[peak].y };
}
