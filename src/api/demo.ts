// Demo dataset for Guest / Preview mode (no auth token) ONLY. The data hooks in
// ./hooks serve these as placeholderData when signed-out; a logged-in user never
// sees them (real API data, empty states and zeros instead).
import type {
  AnalyticsOverview,
  AnalyticsPlatforms,
  AnalyticsTimeseries,
  Me,
  Metrics,
  MetricsChange,
  MetricsPoint,
  Period,
  Platform,
  Post,
  PostAnalytic,
  PostAnalyticsResponse,
  PostDistribution,
  PostFilter,
  SocialAccount,
  TopPost,
} from './types';
import { PLATFORMS } from './types';

const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);
const DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 };

const ZERO: Metrics = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, watch_time_seconds: 0 };

function addMetrics(a: Metrics, b: Metrics): Metrics {
  return {
    views: a.views + b.views,
    likes: a.likes + b.likes,
    comments: a.comments + b.comments,
    shares: a.shares + b.shares,
    saves: a.saves + b.saves,
    watch_time_seconds: a.watch_time_seconds + b.watch_time_seconds,
  };
}

function scale(m: Metrics, f: number): Metrics {
  return {
    views: Math.round(m.views * f),
    likes: Math.round(m.likes * f),
    comments: Math.round(m.comments * f),
    shares: Math.round(m.shares * f),
    saves: Math.round(m.saves * f),
    watch_time_seconds: Math.round(m.watch_time_seconds * f),
  };
}

function changeOf(cur: Metrics, prev: Metrics): MetricsChange {
  const c = (k: keyof Metrics) => (prev[k] === 0 ? null : Math.round(((cur[k] - prev[k]) / prev[k]) * 1000) / 10);
  return {
    views: c('views'),
    likes: c('likes'),
    comments: c('comments'),
    shares: c('shares'),
    saves: c('saves'),
    watch_time_seconds: c('watch_time_seconds'),
  };
}

export const DEMO_ME: Me = {
  user: { id: 1, name: 'Alex Rivera', email: 'alex@clippipeline.app', avatar: null },
  server_time: new Date(now).toISOString(),
};

function account(id: number, platform: Platform, handle: string, followers: number, status: SocialAccount['status'] = 'active'): SocialAccount {
  return {
    id,
    platform,
    provider: platform,
    connect_provider: platform === 'facebook' || platform === 'instagram' ? 'meta' : platform,
    handle,
    display_name: handle.replace(/^@/, ''),
    avatar_url: null,
    external_id: `demo_${id}`,
    follower_count: followers,
    status,
    connected: status === 'active',
    expires_at: iso(-60),
    last_synced_at: iso(0.1),
    error: status === 'active' ? null : 'Token expired — reconnect to keep publishing.',
  };
}

export const DEMO_ACCOUNTS: SocialAccount[] = [
  account(2, 'youtube', 'Alex Tech Shorts', 54_000),
  account(3, 'facebook', 'Alex Rivera Creates', 21_000),
  account(4, 'instagram', '@alex_reels', 38_000, 'needs_reauth'),
  account(1, 'tiktok', '@alexcreates', 128_000),
];

function m(views: number, likes: number, comments: number, shares: number, saves: number, watch: number): Metrics {
  return { views, likes, comments, shares, saves, watch_time_seconds: watch };
}

function dist(id: number, postId: number, platform: Platform, status: PostDistribution['status'], extra: Partial<PostDistribution> = {}): PostDistribution {
  return {
    id,
    post_id: postId,
    platform,
    status,
    external_id: status === 'published' ? `${platform}_${id}` : null,
    url: status === 'published' ? `https://clippipeline.app/demo/${platform}/${id}` : null,
    error_message: null,
    privacy: null,
    attempts: status === 'queued' ? 0 : 1,
    published_at: status === 'published' ? iso(2) : null,
    updated_at: iso(0.2),
    ...extra,
  };
}

function snap(platform: Platform, distribution_id: number, metrics: Metrics): PostAnalytic {
  return { platform, distribution_id, ...metrics, captured_on: day(0), recorded_at: iso(0.1) };
}

function post(p: Omit<Post, 'totals' | 'source' | 'tiktok_id' | 'video_url' | 'created_at' | 'scheduled_at'> & { scheduled_at?: string | null; daysAgo: number }): Post {
  const { daysAgo, ...rest } = p;
  return {
    source: 'upload',
    tiktok_id: null,
    video_url: `https://clippipeline.app/demo/${p.id}.mp4`,
    created_at: iso(daysAgo),
    scheduled_at: p.scheduled_at ?? null,
    ...rest,
    totals: p.analytics.reduce<Metrics>((acc, a) => addMetrics(acc, a), { ...ZERO }),
  };
}

export const DEMO_POSTS: Post[] = [
  post({
    id: 101,
    daysAgo: 2,
    title: '3 editing tricks that doubled my retention',
    caption: 'The hook is everything — here’s how I open every clip now.',
    hashtags: ['editing', 'creator', 'retention'],
    thumbnail: 'https://picsum.photos/seed/clip101/360/640',
    status: 'published',
    published_at: iso(2),
    distributions: [dist(1, 101, 'tiktok', 'published'), dist(2, 101, 'youtube', 'published'), dist(3, 101, 'instagram', 'published'), dist(11, 101, 'facebook', 'published')],
    analytics: [
      snap('tiktok', 1, m(680_000, 92_000, 4_100, 12_800, 3_200, 540_000)),
      snap('youtube', 2, m(340_000, 31_000, 2_200, 5_400, 0, 820_000)),
      snap('instagram', 3, m(194_000, 22_500, 1_900, 3_100, 2_100, 410_000)),
      snap('facebook', 11, m(88_000, 6_400, 700, 1_200, 0, 150_000)),
    ],
  }),
  post({
    id: 102,
    daysAgo: 0,
    title: 'Behind the scenes of a 1M view clip',
    caption: 'Raw footage → polished short in 8 minutes.',
    hashtags: ['bts', 'shorts'],
    thumbnail: 'https://picsum.photos/seed/clip102/360/640',
    status: 'processing',
    published_at: iso(0.1),
    distributions: [dist(4, 102, 'tiktok', 'published', { privacy: 'SELF_ONLY' }), dist(5, 102, 'youtube', 'uploading'), dist(6, 102, 'instagram', 'queued')],
    analytics: [snap('tiktok', 4, m(42_000, 5_100, 270, 790, 120, 48_000))],
  }),
  post({
    id: 103,
    daysAgo: 6,
    title: 'Why your reels aren’t getting views',
    caption: 'Fix these 3 settings today.',
    hashtags: ['instagram', 'reels', 'growth'],
    thumbnail: 'https://picsum.photos/seed/clip103/360/640',
    status: 'partial',
    published_at: iso(6),
    distributions: [
      dist(7, 103, 'youtube', 'published', { privacy: 'private' }),
      dist(8, 103, 'instagram', 'failed', { error_message: 'Instagram access token expired. Reconnect Meta and retry.', attempts: 3 }),
    ],
    analytics: [snap('youtube', 7, m(256_000, 28_400, 1_500, 4_200, 0, 390_000))],
  }),
  post({
    id: 104,
    daysAgo: -1,
    title: 'My full cross-posting workflow',
    caption: 'Post once, everywhere. Here’s the whole pipeline.',
    hashtags: ['workflow', 'automation'],
    thumbnail: 'https://picsum.photos/seed/clip104/360/640',
    status: 'scheduled',
    scheduled_at: iso(-1),
    published_at: null,
    distributions: [dist(9, 104, 'tiktok', 'queued'), dist(10, 104, 'youtube', 'queued')],
    analytics: [],
  }),
];

export function demoPosts(filter: PostFilter | string): Post[] {
  if (filter === 'all' || !filter) return DEMO_POSTS;
  return DEMO_POSTS.filter((p) => p.status === filter);
}

export function demoPost(id: number): Post {
  return DEMO_POSTS.find((p) => p.id === id) ?? DEMO_POSTS[0];
}

// Shares of total reach per platform (guest charts).
const SHARE: Record<Platform, number> = { youtube: 0.28, facebook: 0.08, instagram: 0.19, tiktok: 0.45 };

function dailyViews(i: number, n: number): number {
  const base = 55_000 + (i / Math.max(1, n - 1)) * 75_000;
  const spike = i === n - 6 ? 120_000 : i === n - 5 ? 90_000 : i === n - 7 ? 50_000 : 0;
  const wobble = Math.round(Math.sin(i * 1.3) * 9_000);
  return Math.max(12_000, Math.round(base + spike + wobble));
}

function demoPoints(period: Period, platform: Platform | 'all'): MetricsPoint[] {
  const n = DAYS[period];
  const f = platform === 'all' ? 1 : SHARE[platform];
  return Array.from({ length: n }, (_, i) => {
    const v = Math.round(dailyViews(i, n) * f);
    return {
      date: day(n - 1 - i),
      views: v,
      likes: Math.round(v * 0.12),
      comments: Math.round(v * 0.006),
      shares: Math.round(v * 0.018),
      saves: Math.round(v * 0.004),
      watch_time_seconds: Math.round(v * 1.6),
    };
  });
}

function sumPoints(points: MetricsPoint[]): Metrics {
  return points.reduce<Metrics>((acc, p) => addMetrics(acc, p), { ...ZERO });
}

export function demoTimeseries(period: Period, platform: Platform | 'all' = 'all'): AnalyticsTimeseries {
  return { period, platform, points: demoPoints(period, platform) };
}

export function demoOverview(period: Period): AnalyticsOverview {
  const points = demoPoints(period, 'all');
  const totals = sumPoints(points);
  const previous = scale(totals, 0.82);
  return {
    period,
    start: points[0].date,
    end: points[points.length - 1].date,
    totals,
    previous,
    change: changeOf(totals, previous),
    followers: { total: DEMO_ACCOUNTS.reduce((n, a) => n + a.follower_count, 0), change: 2_400 },
    posts_published: period === '7d' ? 3 : period === '30d' ? 12 : 31,
    connected_accounts: DEMO_ACCOUNTS.filter((a) => a.connected).length,
    total_views: totals.views,
    total_likes: totals.likes,
    total_comments: totals.comments,
    total_shares: totals.shares,
    trend: points.map((p) => ({ date: p.date, views: p.views })),
  };
}

export function demoPlatforms(period: Period): AnalyticsPlatforms {
  const totals = sumPoints(demoPoints(period, 'all'));
  return {
    period,
    platforms: PLATFORMS.map((platform) => {
      const acct = DEMO_ACCOUNTS.find((a) => a.platform === platform);
      const t = scale(totals, SHARE[platform]);
      return {
        platform,
        connected: !!acct?.connected,
        followers: acct?.follower_count ?? 0,
        posts_published: Math.round((period === '7d' ? 3 : period === '30d' ? 12 : 31) * (platform === 'facebook' ? 0.5 : 1)),
        totals: t,
        change: changeOf(t, scale(t, 0.8 + SHARE[platform] * 0.3)),
      };
    }),
  };
}

export function demoTopPosts(limit = 5): TopPost[] {
  return DEMO_POSTS.filter((p) => p.totals.views > 0)
    .sort((a, b) => b.totals.views - a.totals.views)
    .slice(0, limit)
    .map((p) => ({
      post_id: p.id,
      title: p.title,
      thumbnail: p.thumbnail,
      platforms: p.distributions.map((d) => d.platform),
      totals: p.totals,
    }));
}

export function demoPostAnalytics(id: number): PostAnalyticsResponse {
  const p = demoPost(id);
  return {
    post_id: p.id,
    totals: p.totals,
    platforms: p.analytics.map((a) => {
      const d = p.distributions.find((x) => x.id === a.distribution_id);
      const { platform, distribution_id, captured_on, views, likes, comments, shares, saves, watch_time_seconds } = a;
      const metrics = { views, likes, comments, shares, saves, watch_time_seconds };
      return {
        platform,
        distribution_id,
        status: d?.status ?? 'published',
        url: d?.url ?? null,
        captured_on,
        metrics,
        points: Array.from({ length: 30 }, (_, i) => ({ date: day(29 - i), ...scale(metrics, i >= 27 ? 0.25 : 0.01) })),
      };
    }),
  };
}
