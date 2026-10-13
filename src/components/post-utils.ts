import type { DistributionStatus, Metrics, Platform, Post, PostAnalytic, PostStatus } from '@/api/types';

export type { PostStatus };

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube Shorts',
  instagram: 'Instagram Reels',
  facebook: 'Facebook Reels',
};

export const PLATFORM_SHORT: Record<Platform, string> = {
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

export const PLATFORM_COLOR: Record<Platform, string> = {
  tiktok: '#00F2EA',
  youtube: '#FF0000',
  instagram: '#DD2A7B',
  facebook: '#1877F2',
};

export const STATUS_LABEL: Record<PostStatus, string> = {
  scheduled: 'Scheduled',
  processing: 'Processing',
  published: 'Published',
  partial: 'Partial',
  failed: 'Failed',
};

export const DIST_LABEL: Record<DistributionStatus, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  processing: 'Processing',
  published: 'Published',
  failed: 'Failed',
};

/** Server-derived status (CONTRACT §1). */
export function postStatus(p: Post): PostStatus {
  return p.status ?? 'processing';
}

/** Latest analytics snapshot for a platform. */
export function latestAnalytic(p: Post, platform: Platform): PostAnalytic | undefined {
  const rows = (p.analytics ?? []).filter((a) => a.platform === platform);
  if (!rows.length) return undefined;
  return rows.reduce((a, b) => (new Date(b.recorded_at).getTime() >= new Date(a.recorded_at).getTime() ? b : a));
}

/** Post totals (server `totals`), with `watch` = watch_time_seconds. */
export function totalsFor(p: Post) {
  return metricsShort(p.totals);
}

export function metricsShort(t: Metrics | undefined | null) {
  return {
    views: t?.views ?? 0,
    likes: t?.likes ?? 0,
    comments: t?.comments ?? 0,
    shares: t?.shares ?? 0,
    saves: t?.saves ?? 0,
    watch: t?.watch_time_seconds ?? 0,
  };
}

/** Hashtags for display, with '#'. Falls back to tags inside the caption. */
export function postTags(p: Post): string[] {
  if (p.hashtags?.length) return p.hashtags.map((h) => `#${h.replace(/^#/, '')}`);
  return hashtagsOf(p.caption);
}

/** Human-readable privacy note for unaudited apps (YouTube private, TikTok SELF_ONLY). */
export function privacyNote(privacy: string | null | undefined): string | null {
  if (!privacy) return null;
  const v = privacy.toUpperCase();
  if (v === 'PRIVATE') return 'Published as private (app pending platform audit).';
  if (v === 'SELF_ONLY') return 'Visible only to you on TikTok (app pending audit).';
  if (v === 'UNLISTED') return 'Published as unlisted.';
  if (v === 'PUBLIC' || v === 'PUBLIC_TO_EVERYONE') return null;
  return `Privacy: ${privacy}`;
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
