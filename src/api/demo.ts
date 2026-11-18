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
  NotificationsResponse,
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
  Aspect,
  Edl,
  StudioProject,
  StudioProjectDetail,
  StudioRender,
  StudioTemplate,
  StudioTemplatesResponse,
  TemplateKind,
} from './types';
import TEMPLATE_CATALOGUE from './studio/templates.json';
import { TEMPLATE_LOOPS, TEMPLATE_POSTERS } from './studio/posters';
import { PLATFORMS } from './types';
import { FALLBACK_FLAGS, WEB_BASE_URL } from './config';

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
  plan: { name: 'free', clips_used: 3, clips_limit: 5, renews_at: null, billing_url: `${WEB_BASE_URL}/#pricing` },
  sync: { status: 'active', last_synced_at: iso(0.05) },
  preferences: { notifications_enabled: true, auto_sync: true, default_platforms: [], default_hashtags: [] },
  flags: { ...FALLBACK_FLAGS },
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
    options: null,
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

export function demoPosts(filter: PostFilter | string, q = '', platform: Platform | null = null): Post[] {
  const needle = q.trim().toLowerCase();
  return DEMO_POSTS.filter(
    (p) =>
      (filter === 'all' || !filter || p.status === filter || (filter === 'failed' && p.status === 'partial')) &&
      (!needle || `${p.title} ${p.caption ?? ''}`.toLowerCase().includes(needle)) &&
      (!platform || p.distributions.some((d) => d.platform === platform)),
  );
}

export const DEMO_NOTIFICATIONS: NotificationsResponse = {
  unread_count: 1,
  items: [
    {
      id: 'demo-1',
      type: 'distribution_published',
      title: 'Published to TikTok',
      body: 'Your clip is live on TikTok.',
      data: { postId: 102 },
      read_at: null,
      created_at: iso(0.1),
    },
    {
      id: 'demo-2',
      type: 'distribution_failed',
      title: 'Instagram upload failed',
      body: 'Instagram access token expired. Reconnect Meta and retry.',
      data: { postId: 103 },
      read_at: iso(0.5),
      created_at: iso(1),
    },
  ],
};

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

// ---------------- §17 Studio (guest / offline demo) ----------------
// The template catalogue is generated from clippipeline/motion/dist/templates.json,
// so the gallery works signed-out and before the server has Studio.

const CATALOGUE = (TEMPLATE_CATALOGUE as unknown as StudioTemplate[]).map((t) => ({ ...t, poster_source: TEMPLATE_POSTERS[t.slug], preview_source: TEMPLATE_LOOPS[t.slug] }));
const CATEGORY_ORDER = ['Kinetic type', 'Product UI', 'Phone', 'Charts', 'Diagrams', 'Shapes', 'Particles', 'Characters', 'Photos', 'Music', 'Code'];

export function demoTemplates(params: { category?: string | null; kind?: TemplateKind | null; aspect?: Aspect | null; sort?: 'popular' | 'new' } = {}): StudioTemplatesResponse {
  const categories = CATEGORY_ORDER.map((name) => ({ name, count: CATALOGUE.filter((t) => t.categories.includes(name)).length })).filter((c) => c.count > 0);
  let list = CATALOGUE.filter(
    (t) =>
      (!params.category || t.categories.includes(params.category)) &&
      (!params.kind || t.kind === params.kind) &&
      (!params.aspect || t.aspects.includes(params.aspect)),
  );
  list = params.sort === 'new' ? [...list].reverse() : [...list].sort((a, b) => b.uses_count - a.uses_count);
  return { total: CATALOGUE.length, categories, templates: list };
}

export function demoTemplate(slug: string): StudioTemplate | undefined {
  return CATALOGUE.find((t) => t.slug === slug);
}

const demoEdl = (aspect: Aspect): Edl => ({
  version: 2,
  aspect,
  fps: 30,
  theme: { accent: '#7C5CFF', accent2: '#B14CFF', bg: '#0E0E12', text: '#FFFFFF', font: 'Inter' },
  fit: 'blur',
  main: [
    { id: 'd1', type: 'template', template: 'kinetic-title', version: 1, duration: 2.5, props: { kicker: 'DAY IN THE LIFE', title: 'Lagos to Lekki', subtitle: '' } },
    { id: 'd2', type: 'clip', asset_id: 9001, in: 1.2, out: 9.8, volume_db: 0, speed: 1, zoom: 1 },
    { id: 'd3', type: 'clip', asset_id: 9002, in: 0.4, out: 6.1, volume_db: 0, speed: 1, zoom: 1.08, transition_in: { template: 'swipe', duration: 0.45 } },
    { id: 'd4', type: 'template', template: 'cta-outro', version: 1, duration: 3, props: { handle: '@ada.creates', cta: 'Follow for more' }, slot: 'outro' },
  ],
  overlays: [{ id: 'o1', template: 'lower-third', version: 1, anchor: 'd2', offset: 0.5, duration: 3, props: { name: 'Ada Obi', role: 'Creator' } }],
  captions: { enabled: true, template: 'captions-pop', version: 1, props: {}, fixes: {} },
  music: [],
  loudness: -14,
});

const demoRender = (projectId: number, id: number, quality: 'preview' | 'final'): StudioRender => ({
  id,
  project_id: projectId,
  quality,
  edl_revision: 4,
  duration_seconds: 22.4,
  size_bytes: quality === 'final' ? 18_400_000 : 3_100_000,
  width: quality === 'final' ? 1080 : 540,
  height: quality === 'final' ? 1920 : 960,
  url: '',
  download_url: '',
  poster_url: null,
  post_id: null,
  check: { lufs: -14.1, true_peak: -1.4, black_frames: 0, long_silences: 0 },
  created_at: iso(1),
});

export const DEMO_STUDIO_PROJECTS: StudioProject[] = [
  { id: 901, title: 'Lagos to Lekki vlog', aspect: '9:16', fps: 30, revision: 4, duration_seconds: 22.4, clip_count: 2, poster_url: null, reference_asset_id: null, has_style_profile: true, can_undo_auto_cut: true, last_render: demoRender(901, 71, 'final'), recipe: { status: 'done', style: 'vice-night', music: 'neon-drive', render_id: 71, caption: 'Lagos to Lekki in one day', hashtags: ['lagos', 'vlog', 'fyp'], headlines: ['Lekki', 'Traffic', 'Worth it'] }, created_at: iso(3), updated_at: iso(1) },
  { id: 902, title: 'Product launch teaser', aspect: '1:1', fps: 30, revision: 2, duration_seconds: 14.0, clip_count: 1, poster_url: null, reference_asset_id: null, has_style_profile: false, can_undo_auto_cut: false, last_render: null, recipe: null, created_at: iso(6), updated_at: iso(5) },
];

export function demoStudioProject(id: number): StudioProjectDetail | undefined {
  const base = DEMO_STUDIO_PROJECTS.find((p) => p.id === id) ?? DEMO_STUDIO_PROJECTS[0];
  const clip = (aid: number, name: string, dur: number) => ({
    id: aid, project_id: base.id, role: 'source' as const, origin: 'upload' as const, original_name: name, mime: 'video/mp4', size_bytes: 24_000_000,
    duration_seconds: dur, width: 1080, height: 1920, fps: 30, has_audio: true, status: 'ready' as const, error: null, url: null, preview_url: null,
    poster_url: null, waveform_url: null, thumbs_url: null, thumbs: null, has_transcript: true, transcript_language: 'en', style_profile: null, created_at: iso(3),
  });
  return {
    ...base,
    edl: demoEdl(base.aspect),
    style_profile: base.has_style_profile ? { pace: 'fast', avg_shot_seconds: 1.9, palette: ['#111111', '#F5D90A', '#FFFFFF'], suggested: { captions_template: 'captions-pop', accent: '#F5D90A', punch_in: true, max_segment_seconds: 2.2 } } : null,
    assets: [clip(9001, 'IMG_2041.MOV', 12.3), clip(9002, 'IMG_2044.MOV', 7.9)],
    active_jobs: [],
  };
}

export function demoStudioRenders(projectId: number): StudioRender[] {
  const p = DEMO_STUDIO_PROJECTS.find((x) => x.id === projectId);
  return p?.last_render ? [p.last_render, demoRender(projectId, 70, 'preview')] : [];
}
