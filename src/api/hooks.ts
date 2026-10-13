import { QueryClient, keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, apiUpload } from './client';
import { useAuthStore } from '@/store/authStore';
import {
  DEMO_ACCOUNTS,
  DEMO_ME,
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
  ConnectStartResponse,
  CreatePostInput,
  DeleteAccountResponse,
  DistributionStatus,
  Me,
  Period,
  Platform,
  Post,
  PostAnalyticsResponse,
  PostDistribution,
  PostFilter,
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
  posts: (filter: string) => ['posts', filter] as const,
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

// GET /posts?filter=
export function usePosts(filter: PostFilter = 'all') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.posts(filter),
    queryFn: () => apiFetch<Post[]>(`/posts?filter=${filter}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoPosts(filter),
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
export function useOverview(period: Period = '30d') {
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
export function usePlatformAnalytics(period: Period = '30d') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.platforms(period),
    queryFn: () => apiFetch<AnalyticsPlatforms>(`/analytics/platforms?period=${period}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoPlatforms(period),
  });
}

// GET /analytics/timeseries?period=&platform=
export function useTimeseries(period: Period = '30d', platform: Platform | 'all' = 'all') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.timeseries(period, platform),
    queryFn: () => apiFetch<AnalyticsTimeseries>(`/analytics/timeseries?period=${period}&platform=${platform}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoTimeseries(period, platform),
  });
}

// GET /analytics/top-posts?period=&limit=
export function useTopPosts(period: Period = '30d', limit = 5) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.topPosts(period, limit),
    queryFn: () => apiFetch<TopPost[]>(`/analytics/top-posts?period=${period}&limit=${limit}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoTopPosts(limit),
  });
}

// ---------------- Mutations ----------------

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
}
