// API response types — mirror docs/CONTRACT.md (v1, go-live) EXACTLY.
// snake_case, integer counts (never null), ISO-8601 times, YYYY-MM-DD dates.

// ---- §1 Shared enums ----
export type Platform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
export type ConnectProvider = 'youtube' | 'meta' | 'tiktok';
export type AccountStatus = 'active' | 'needs_reauth' | 'error';
export type DistributionStatus = 'queued' | 'uploading' | 'processing' | 'published' | 'failed';
export type PostStatus = 'scheduled' | 'processing' | 'published' | 'partial' | 'failed';
export type Period = '7d' | '30d' | '90d';
export type PostFilter = 'all' | 'published' | 'processing' | 'failed' | 'scheduled';

export const PLATFORMS: Platform[] = ['youtube', 'facebook', 'instagram', 'tiktok'];

export interface Metrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watch_time_seconds: number;
}

/** Percentage change vs the previous equal-length window (1 decimal); null when previous is 0. */
export type MetricsChange = { [K in keyof Metrics]: number | null };

/** One day of metrics (timeseries / per-post points). */
export interface MetricsPoint extends Metrics {
  date: string;
}

// ---- §2 Auth ----
export interface User {
  id: number;
  name: string;
  email: string | null;
  avatar: string | null;
}

// ---- §9 Mobile sign-in broker ----
export type LoginProvider = 'google' | 'facebook' | 'tiktok';

export interface AuthStartResponse {
  provider: LoginProvider;
  auth_url: string;
  expires_at: string;
}

export interface AuthExchangeResponse {
  token: string;
  user: User;
}

// ---- §10 Me, preferences, account deletion ----
export type PlanName = 'free' | 'pro' | 'agency';

export interface Plan {
  name: PlanName;
  clips_used: number;
  /** null = unlimited */
  clips_limit: number | null;
  renews_at: string | null;
  billing_url: string;
}

export interface SyncState {
  status: 'active' | 'idle' | 'attention';
  last_synced_at: string | null;
}

export interface Preferences {
  notifications_enabled: boolean;
  auto_sync: boolean;
  default_platforms: Platform[];
  default_hashtags: string[];
}

export interface AppFlags {
  tiktok_audited: boolean;
  youtube_audited: boolean;
  support_email: string;
  privacy_url: string;
  terms_url: string;
  delete_account_url: string;
}

export interface Me {
  user: User;
  server_time: string;
  plan: Plan;
  sync: SyncState;
  preferences: Preferences;
  flags: AppFlags;
}

export interface DeleteMeResponse {
  status: 'scheduled';
  completes_by: string;
}

// ---- §11 Notifications ----
export type NotificationType = 'distribution_published' | 'distribution_failed' | 'account_needs_reauth';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { postId?: number; provider?: ConnectProvider };
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  unread_count: number;
  items: AppNotification[];
}

// ---- §13 TikTok creator info ----
export type TikTokPrivacyLevel = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';

export interface CreatorInfo {
  creator_nickname: string;
  creator_username: string;
  creator_avatar_url: string | null;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
  can_post: boolean;
  reason: string | null;
  audited: boolean;
}

// ---- §3 Connect & accounts ----
export interface ConnectStartResponse {
  provider: ConnectProvider;
  platform: 'web' | 'mobile';
  auth_url: string;
  expires_at: string;
}

export interface SocialAccount {
  id: number;
  platform: Platform;
  /** duplicates `platform` (back-compat) */
  provider: Platform;
  connect_provider: ConnectProvider;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  external_id: string | null;
  follower_count: number;
  status: AccountStatus;
  /** status === 'active' */
  connected: boolean;
  expires_at: string | null;
  last_synced_at: string | null;
  error: string | null;
}

export interface DeleteAccountResponse {
  deleted_ids: number[];
}

// ---- §4 Posts & publishing ----
export interface PostDistribution {
  id: number;
  post_id: number;
  platform: Platform;
  status: DistributionStatus;
  external_id: string | null;
  /** open-on-platform link, null until published */
  url: string | null;
  /** real platform error text when failed */
  error_message: string | null;
  /** e.g. "private" (YouTube unaudited), "SELF_ONLY" (TikTok unaudited) */
  privacy: string | null;
  attempts: number;
  published_at: string | null;
  updated_at: string;
  /** saved platform_options for this platform (§12) */
  options: Record<string, unknown> | null;
}

/** Latest snapshot per platform for this post. */
export interface PostAnalytic extends Metrics {
  platform: Platform;
  distribution_id: number;
  captured_on: string;
  recorded_at: string;
}

export interface Post {
  id: number;
  title: string;
  caption: string | null;
  /** without '#' */
  hashtags: string[];
  video_url: string;
  thumbnail: string | null;
  tiktok_id: string | null;
  source: 'upload' | 'tiktok_ingest';
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  distributions: PostDistribution[];
  analytics: PostAnalytic[];
  /** sum of `analytics` */
  totals: Metrics;
}

/** Local input for POST /posts (multipart). */
export interface CreatePostInput {
  video: { uri: string; name: string; type: string };
  title: string;
  caption?: string | null;
  hashtags?: string[];
  platforms: Platform[];
  scheduled_at?: string | null;
  /** client-measured duration (§12, P-02) */
  video_duration_seconds?: number | null;
  platform_options?: PlatformOptions;
}

export type YouTubePrivacy = 'public' | 'private' | 'unlisted';

export interface YouTubeOptions {
  privacy_status: YouTubePrivacy;
  guidelines_confirmed: boolean;
}

export interface TikTokOptions {
  privacy_level: string;
  disable_comment: boolean;
  disable_duet: boolean;
  disable_stitch: boolean;
  brand_organic_toggle: boolean;
  brand_content_toggle: boolean;
  is_aigc: boolean;
  music_consent: boolean;
}

export interface PlatformOptions {
  youtube?: YouTubeOptions;
  tiktok?: TikTokOptions;
}

/** GET /posts query (§4, §12). */
export interface PostsQuery {
  filter?: PostFilter;
  q?: string;
  platform?: Platform | null;
}

// ---- §5 Analytics ----
export interface AnalyticsOverview {
  period: Period;
  start: string;
  end: string;
  totals: Metrics;
  previous: Metrics;
  change: MetricsChange;
  followers: { total: number; change: number };
  posts_published: number;
  connected_accounts: number;
  // back-compat (equal totals.* and the timeseries views)
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  trend: { date: string; views: number }[];
}

export interface PlatformBreakdown {
  platform: Platform;
  connected: boolean;
  followers: number;
  posts_published: number;
  totals: Metrics;
  change: MetricsChange;
}

export interface AnalyticsPlatforms {
  period: Period;
  platforms: PlatformBreakdown[];
}

export interface AnalyticsTimeseries {
  period: Period;
  platform: Platform | 'all';
  points: MetricsPoint[];
}

export interface PostPlatformAnalytics {
  platform: Platform;
  distribution_id: number;
  status: DistributionStatus;
  url: string | null;
  /** null until the first snapshot exists */
  captured_on: string | null;
  metrics: Metrics;
  points: MetricsPoint[];
}

export interface PostAnalyticsResponse {
  post_id: number;
  totals: Metrics;
  platforms: PostPlatformAnalytics[];
}

export interface TopPost {
  post_id: number;
  title: string;
  thumbnail: string | null;
  platforms: Platform[];
  totals: Metrics;
}

// ---- §7 Push payloads ----
export interface PushPayload {
  type: 'distribution_published' | 'distribution_failed' | 'account_needs_reauth';
  screen: 'post' | 'connect';
  postId?: number;
  provider?: ConnectProvider;
}
