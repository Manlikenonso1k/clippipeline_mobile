// Formatting helpers — only for display at the UI edge.

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** 12 345 -> "12.3K", for stat tiles. */
export function formatCount(n: number): string {
  return compact.format(n ?? 0);
}

/** Money is integer minor units (kobo/cents). Format only here. */
export function formatMoney(minor: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format((minor ?? 0) / 100);
}

/** Seconds of watch time -> "1h 02m" / "3m 20s". */
export function formatWatchTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
