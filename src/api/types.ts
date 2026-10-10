// API response types — mirror the Laravel backend (snake_case, integer counts,
// ISO-8601 times). Source of truth: clippipeline.com database migrations.

export type Platform = 'tiktok' | 'youtube' | 'instagram';
export type DistributionStatus = 'pending' | 'processing' | 'published' | 'failed';

export interface User {
  id: number;
  name: string;
  email: string | null;
  avatar: string | null;
}

export interface Me {
  user: User;
  // server-authoritative values the client must not derive
  server_time: string;
}

export interface SocialAccount {
  id: number;
  provider: Platform;
  handle: string | null;
  follower_count: number;
  connected: boolean;
  expires_at: string | null;
}

export interface PostDistribution {
  id: number;
  platform: Platform;
  external_id: string | null;
  status: DistributionStatus;
  error_message: string | null;
}

export interface PostAnalytic {
  platform: Platform;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watch_time: number;
  recorded_at: string;
}

export interface Post {
  id: number;
  title: string;
  caption: string | null;
  video_url: string;
  thumbnail: string | null;
  tiktok_id: string | null;
  published_at: string | null;
  distributions: PostDistribution[];
  analytics: PostAnalytic[];
}

export interface AnalyticsOverview {
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  posts_published: number;
  connected_accounts: number;
  trend: { date: string; views: number }[];
}
