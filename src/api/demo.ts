// Demo dataset for Guest / Preview mode (no auth token). The data hooks serve
// these instead of hitting the API so the app is fully explorable signed-out.
import type { AnalyticsOverview, Me, Post, SocialAccount } from './types';

const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

export const DEMO_ME: Me = {
  user: { id: 1, name: 'Alex Rivera', email: 'alex@clippipeline.app', avatar: null },
  server_time: new Date(now).toISOString(),
};

export const DEMO_ACCOUNTS: SocialAccount[] = [
  { id: 1, provider: 'tiktok', handle: '@alexcreates', follower_count: 128_000, connected: true, expires_at: null },
  { id: 2, provider: 'youtube', handle: 'Alex Tech Shorts', follower_count: 54_000, connected: true, expires_at: null },
  { id: 3, provider: 'instagram', handle: '@alex_reels', follower_count: 38_000, connected: false, expires_at: null },
];

// 30-day views trend with a believable peak around day 6 (Oct 24-style spike).
export const DEMO_OVERVIEW: AnalyticsOverview = {
  total_views: 2_400_000,
  total_likes: 385_000,
  total_comments: 14_800,
  total_shares: 42_300,
  posts_published: 48,
  connected_accounts: 2,
  trend: Array.from({ length: 30 }, (_, i) => {
    const base = 55_000 + i * 2_600;
    const spike = i >= 22 && i <= 26 ? (5 - Math.abs(24 - i)) * 24_000 : 0;
    const wobble = Math.round(Math.sin(i * 1.3) * 9_000);
    return { date: iso(29 - i).slice(0, 10), views: Math.max(12_000, base + spike + wobble) };
  }),
};

function analytics(platform: Post['analytics'][number]['platform'], views: number, likes: number, comments: number, shares: number, watch: number): Post['analytics'][number] {
  return { platform, views, likes, comments, shares, watch_time: watch, recorded_at: iso(1) };
}

export const DEMO_POSTS: Post[] = [
  {
    id: 101,
    title: '3 editing tricks that doubled my retention',
    caption: 'The hook is everything — here’s how I open every clip now. #editing #creator #retention',
    video_url: 'https://clippipeline.app/demo/101.mp4',
    tiktok_id: '7390000000000000001',
    published_at: iso(2),
    distributions: [
      { id: 1, platform: 'tiktok', external_id: 'tt_101', status: 'published', error_message: null },
      { id: 2, platform: 'youtube', external_id: 'yt_101', status: 'published', error_message: null },
      { id: 3, platform: 'instagram', external_id: 'ig_101', status: 'published', error_message: null },
    ],
    analytics: [
      analytics('tiktok', 680_000, 92_000, 4_100, 12_800, 540),
      analytics('youtube', 340_000, 31_000, 2_200, 5_400, 820),
      analytics('instagram', 194_000, 22_500, 1_900, 3_100, 410),
    ],
  },
  {
    id: 102,
    title: 'Behind the scenes of a 1M view clip',
    caption: 'Raw footage → polished short in 8 minutes. #bts #shorts',
    video_url: 'https://clippipeline.app/demo/102.mp4',
    tiktok_id: '7390000000000000002',
    published_at: iso(4),
    distributions: [
      { id: 4, platform: 'tiktok', external_id: 'tt_102', status: 'published', error_message: null },
      { id: 5, platform: 'youtube', external_id: null, status: 'processing', error_message: null },
      { id: 6, platform: 'instagram', external_id: null, status: 'pending', error_message: null },
    ],
    analytics: [analytics('tiktok', 420_000, 51_000, 2_700, 7_900, 480)],
  },
  {
    id: 103,
    title: 'Why your reels aren’t getting views',
    caption: 'Fix these 3 settings today. #instagram #reels #growth',
    video_url: 'https://clippipeline.app/demo/103.mp4',
    tiktok_id: '7390000000000000003',
    published_at: iso(6),
    distributions: [
      { id: 7, platform: 'tiktok', external_id: 'tt_103', status: 'published', error_message: null },
      { id: 8, platform: 'instagram', external_id: null, status: 'failed', error_message: 'Token expired on Instagram Reels' },
    ],
    analytics: [analytics('tiktok', 256_000, 28_400, 1_500, 4_200, 390)],
  },
  {
    id: 104,
    title: 'My full cross-posting workflow',
    caption: 'Post once, everywhere. Here’s the whole pipeline. #workflow #automation',
    video_url: 'https://clippipeline.app/demo/104.mp4',
    tiktok_id: '7390000000000000004',
    published_at: iso(9),
    distributions: [
      { id: 9, platform: 'tiktok', external_id: 'tt_104', status: 'published', error_message: null },
      { id: 10, platform: 'youtube', external_id: 'yt_104', status: 'published', error_message: null },
    ],
    analytics: [
      analytics('tiktok', 512_000, 60_000, 3_000, 9_100, 500),
      analytics('youtube', 288_000, 26_000, 1_700, 4_600, 760),
    ],
  },
];

export function demoPosts(filter: string): Post[] {
  if (filter === 'all' || !filter) return DEMO_POSTS;
  return DEMO_POSTS.filter((p) => p.distributions.some((d) => d.status === filter));
}

export function demoPost(id: number): Post {
  return DEMO_POSTS.find((p) => p.id === id) ?? DEMO_POSTS[0];
}
