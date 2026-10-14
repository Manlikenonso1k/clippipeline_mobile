import { QueryClient, keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, apiFetch, apiUpload } from './client';
import { API_BASE_URL, FALLBACK_FLAGS } from './config';
import { useAuthStore } from '@/store/authStore';
import {
  DEMO_ACCOUNTS,
  DEMO_ME,
  DEMO_NOTIFICATIONS,
  demoOverview,
  demoPlatforms,
  demoPost,
  demoPostAnalytics,
  demoPosts,
  demoTimeseries,
  demoTopPosts,
} from './demo';
import type {
  AnalyticsOverview,
  AnalyticsPlatforms,
  AnalyticsTimeseries,
  ConnectProvider,
  AppFlags,
  ConnectStartResponse,
  CreatePostInput,
  CreatorInfo,
  DeleteAccountResponse,
  DeleteMeResponse,
  DistributionStatus,
  Me,
  NotificationsResponse,
  Preferences,
  Period,
  Platform,
  Post,
  PostAnalyticsResponse,
  PostDistribution,
  PostFilter,
  PostsQuery,
  SocialAccount,
  TopPost,
} from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// Query keys follow CONTRACT §7 so push payloads can invalidate them:
// ['posts'], ['post', id], ['analytics'], ['social-accounts'].
export const keys = {
  me: ['me'] as const,
  accounts: ['social-accounts'] as const,
  postsAll: ['posts'] as const,
  posts: (filter: string, q = '', platform: string | null = null) => ['posts', filter, q, platform ?? 'all'] as const,
  notifications: ['notifications'] as const,
  creatorInfo: ['tiktok', 'creator-info'] as const,
  post: (id: number) => ['post', id] as const,
  analytics: ['analytics'] as const,
  overview: (period: Period) => ['analytics', 'overview', period] as const,
  platforms: (period: Period) => ['analytics', 'platforms', period] as const,
  timeseries: (period: Period, platform: string) => ['analytics', 'timeseries', period, platform] as const,
  topPosts: (period: Period, limit: number) => ['analytics', 'top-posts', period, limit] as const,
  postAnalytics: (id: number) => ['analytics', 'post', id] as const,
};

export const IN_FLIGHT: DistributionStatus[] = ['queued', 'uploading', 'processing'];

// Guest / Preview mode: with no auth token we don't hit the API — the queries
// are disabled and `placeholderData` serves the demo dataset instead. Once a
// token exists the demo data is NEVER used: real API data, empty states, zeros.
export function useIsGuest(): boolean {
  return !useAuthStore((s) => s.token);
}

/** Throws for guest-mode mutations (nothing to send without an account). */
function requireToken() {
  if (!useAuthStore.getState().token) throw new Error('Sign in to do this.');
}

// ---------------- Queries ----------------

// GET /me
export function useMe() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.me,
    queryFn: () => apiFetch<Me>('/me'),
    enabled: !!token,
    placeholderData: token ? undefined : DEMO_ME,
  });
}

// GET /social-accounts
export function useSocialAccounts() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.accounts,
    queryFn: () => apiFetch<SocialAccount[]>('/social-accounts'),
    enabled: !!token,
    placeholderData: token ? undefined : DEMO_ACCOUNTS,
  });
}

/** Contract flags from GET /me, with safe defaults until the server sends them. */
export function useFlags(): AppFlags {
  const me = useMe();
  return { ...FALLBACK_FLAGS, ...(me.data?.flags ?? {}) };
}

// GET /posts?filter=&q=&platform=  (§4, §12)
export function usePosts(filter: PostFilter = 'all', query: Omit<PostsQuery, 'filter'> = {}) {
  const token = useAuthStore((s) => s.token);
  const q = (query.q ?? '').trim();
  const platform = query.platform ?? null;
  const qs = `filter=${filter}${q ? `&q=${encodeURIComponent(q)}` : ''}${platform ? `&platform=${platform}` : ''}`;
  return useQuery({
    queryKey: keys.posts(filter, q, platform),
    queryFn: () => apiFetch<Post[]>(`/posts?${qs}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoPosts(filter, q, platform),
    // Faster while anything is still in flight.
    refetchInterval: (q) => {
      if (!token) return false;
      const rows = q.state.data;
      return rows?.some((p) => p.distributions.some((d) => IN_FLIGHT.includes(d.status))) ? 10_000 : 30_000;
    },
  });
}

/** True while any distribution of the post is queued / uploading / processing. */
export function isPostInFlight(p: Post | undefined): boolean {
  return !!p?.distributions?.some((d) => IN_FLIGHT.includes(d.status));
}

// GET /posts/{id} — polls every 5s while any distribution is in flight, stops otherwise.
export function usePost(id: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.post(id),
    queryFn: () => apiFetch<Post>(`/posts/${id}`),
    enabled: !!token && Number.isFinite(id),
    placeholderData: token ? undefined : demoPost(id),
    refetchInterval: (q) => (token && isPostInFlight(q.state.data) ? 5_000 : false),
  });
}

// GET /posts/{id}/analytics
export function usePostAnalytics(id: number, opts: { poll?: boolean } = {}) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.postAnalytics(id),
    queryFn: () => apiFetch<PostAnalyticsResponse>(`/posts/${id}/analytics`),
    enabled: !!token && Number.isFinite(id),
    placeholderData: token ? undefined : demoPostAnalytics(id),
    refetchInterval: token && opts.poll ? 15_000 : false,
  });
}

// GET /analytics/overview?period=
export function useOverview(period: Period = '7d') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.overview(period),
    queryFn: () => apiFetch<AnalyticsOverview>(`/analytics/overview?period=${period}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoOverview(period),
    refetchInterval: token ? 60_000 : false,
  });
}

// GET /analytics/platforms?period=
export function usePlatformAnalytics(period: Period = '7d') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.platforms(period),
    queryFn: () => apiFetch<AnalyticsPlatforms>(`/analytics/platforms?period=${period}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoPlatforms(period),
  });
}

// GET /analytics/timeseries?period=&platform=
export function useTimeseries(period: Period = '7d', platform: Platform | 'all' = 'all') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.timeseries(period, platform),
    queryFn: () => apiFetch<AnalyticsTimeseries>(`/analytics/timeseries?period=${period}&platform=${platform}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoTimeseries(period, platform),
  });
}

// GET /analytics/top-posts?period=&limit=
export function useTopPosts(period: Period = '7d', limit = 5) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.topPosts(period, limit),
    queryFn: () => apiFetch<TopPost[]>(`/analytics/top-posts?period=${period}&limit=${limit}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoTopPosts(limit),
  });
}

// GET /notifications?limit=30  (§11)
export function useNotifications(limit = 30) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => apiFetch<NotificationsResponse>(`/notifications?limit=${limit}`),
    enabled: !!token,
    placeholderData: token ? undefined : DEMO_NOTIFICATIONS,
    refetchInterval: token ? 60_000 : false,
  });
}

// GET /tiktok/creator-info  (§13, T-01) — never cached: re-fetched every time the TikTok form mounts.
export function useCreatorInfo(enabled: boolean) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.creatorInfo,
    queryFn: () => apiFetch<CreatorInfo>('/tiktok/creator-info'),
    enabled: !!token && enabled,
    staleTime: 0,
    gcTime: 0,
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 1,
  });
}

// ---------------- Mutations ----------------

// PATCH /me {name}  (§10)
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string }) => {
      requireToken();
      return apiFetch<Me>('/me', { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

// PATCH /me/preferences (any subset)  (§10) — optimistic on the cached Me.
export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Preferences>) => {
      requireToken();
      return apiFetch<Preferences>('/me/preferences', { method: 'PATCH', body: JSON.stringify(patch) });
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.me });
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) qc.setQueryData<Me>(keys.me, { ...prev, preferences: { ...prev.preferences, ...patch } });
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
    },
    onSuccess: (prefs) => {
      qc.setQueryData<Me>(keys.me, (old) => (old ? { ...old, preferences: prefs } : old));
    },
  });
}

// DELETE /me {confirm:"DELETE"}  (§10)
export function useDeleteMe() {
  return useMutation({
    mutationFn: async () => {
      requireToken();
      return apiFetch<DeleteMeResponse>('/me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });
    },
  });
}

// POST /notifications/read-all  (§11)
export function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      requireToken();
      return apiFetch<null>('/notifications/read-all', { method: 'POST' });
    },
    onSuccess: () => {
      const now = new Date().toISOString();
      qc.setQueryData<NotificationsResponse>(keys.notifications, (old) =>
        old ? { unread_count: 0, items: old.items.map((n) => ({ ...n, read_at: n.read_at ?? now })) } : old,
      );
      qc.invalidateQueries({ queryKey: keys.notifications });
    },
  });
}

// DELETE /posts/{id}  (§12) — local only; nothing is removed from the platforms.
export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      requireToken();
      await apiFetch<null>(`/posts/${id}`, { method: 'DELETE' });
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: keys.post(id) });
      qc.invalidateQueries({ queryKey: keys.postsAll });
      qc.invalidateQueries({ queryKey: keys.analytics });
    },
  });
}

/** GET /analytics/export?period= (§14) — raw CSV text. */
export async function fetchAnalyticsCsv(period: Period): Promise<string> {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Sign in to do this.');
  const res = await fetch(`${API_BASE_URL}/analytics/export?period=${period}`, {
    headers: { Accept: 'text/csv', Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const body = JSON.parse(text) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // not JSON
    }
    if (res.status === 401) await useAuthStore.getState().clear();
    throw new ApiError(res.status, message);
  }
  return text;
}

// GET /connect/{provider}/start?platform=mobile — returns the OAuth auth_url.
export function useConnectStart() {
  return useMutation({
    mutationFn: async (provider: ConnectProvider) => {
      requireToken();
      return apiFetch<ConnectStartResponse>(`/connect/${provider}/start?platform=mobile`);
    },
  });
}

// DELETE /social-accounts/{id}
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      requireToken();
      return apiFetch<DeleteAccountResponse>(`/social-accounts/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.accounts });
      qc.invalidateQueries({ queryKey: keys.analytics });
    },
  });
}

function buildPostForm(input: CreatePostInput): FormData {
  const form = new FormData();
  // React Native FormData accepts a {uri,name,type} file descriptor.
  form.append('video', input.video as unknown as Blob);
  form.append('title', input.title);
  if (input.caption) form.append('caption', input.caption);
  (input.hashtags ?? []).forEach((h) => form.append('hashtags[]', h.replace(/^#/, '')));
  input.platforms.forEach((p) => form.append('platforms[]', p));
  if (input.scheduled_at) form.append('scheduled_at', input.scheduled_at);
  if (input.video_duration_seconds != null) {
    form.append('video_duration_seconds', String(Math.round(input.video_duration_seconds * 10) / 10));
  }
  const b = (v: boolean) => (v ? '1' : '0');
  const yt = input.platform_options?.youtube;
  if (yt && input.platforms.includes('youtube')) {
    form.append('platform_options[youtube][privacy_status]', yt.privacy_status);
    form.append('platform_options[youtube][guidelines_confirmed]', b(yt.guidelines_confirmed));
  }
  const tt = input.platform_options?.tiktok;
  if (tt && input.platforms.includes('tiktok')) {
    form.append('platform_options[tiktok][privacy_level]', tt.privacy_level);
    form.append('platform_options[tiktok][disable_comment]', b(tt.disable_comment));
    form.append('platform_options[tiktok][disable_duet]', b(tt.disable_duet));
    form.append('platform_options[tiktok][disable_stitch]', b(tt.disable_stitch));
    form.append('platform_options[tiktok][brand_organic_toggle]', b(tt.brand_organic_toggle));
    form.append('platform_options[tiktok][brand_content_toggle]', b(tt.brand_content_toggle));
    form.append('platform_options[tiktok][is_aigc]', b(tt.is_aigc));
    form.append('platform_options[tiktok][music_consent]', b(tt.music_consent));
  }
  return form;
}

// POST /posts (multipart) with upload progress 0..1.
export function useCreatePost() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: async (input: CreatePostInput) => {
      requireToken();
      setProgress(0);
      return apiUpload<Post>('/posts', buildPostForm(input), setProgress);
    },
    onSuccess: (post) => {
      qc.setQueryData(keys.post(post.id), post);
      qc.invalidateQueries({ queryKey: keys.postsAll });
      qc.invalidateQueries({ queryKey: keys.analytics });
    },
  });
  return { ...mutation, progress };
}

// POST /distributions/{id}/retry
export function useRetryDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (distributionId: number) => {
      requireToken();
      return apiFetch<PostDistribution>(`/distributions/${distributionId}/retry`, { method: 'POST' });
    },
    onSuccess: (d) => {
      qc.setQueryData<Post>(keys.post(d.post_id), (old) =>
        old ? { ...old, distributions: old.distributions.map((x) => (x.id === d.id ? d : x)) } : old,
      );
      qc.invalidateQueries({ queryKey: keys.post(d.post_id) });
      qc.invalidateQueries({ queryKey: keys.postsAll });
    },
  });
}

/** Invalidation for push payloads (CONTRACT §7). */
export function invalidateForPush(data: { type?: string; postId?: number | string } | undefined) {
  if (!data?.type) return;
  if (data.type === 'distribution_published' || data.type === 'distribution_failed') {
    queryClient.invalidateQueries({ queryKey: keys.postsAll });
    if (data.postId != null) queryClient.invalidateQueries({ queryKey: keys.post(Number(data.postId)) });
    queryClient.invalidateQueries({ queryKey: keys.analytics });
  } else if (data.type === 'account_needs_reauth') {
    queryClient.invalidateQueries({ queryKey: keys.accounts });
  }
  queryClient.invalidateQueries({ queryKey: keys.notifications });
}
