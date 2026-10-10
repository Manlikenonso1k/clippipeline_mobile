import { QueryClient, useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Me, Post, SocialAccount, AnalyticsOverview, Platform } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export const keys = {
  me: ['me'] as const,
  overview: (period: string) => ['overview', period] as const,
  posts: (filter: string) => ['posts', filter] as const,
  post: (id: number) => ['post', id] as const,
  accounts: ['accounts'] as const,
};

// GET /api/me — role/tenant/config comes from here; nothing hardcoded client-side.
export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => apiFetch<Me>('/me') });
}

// Dashboard overview — poll ~60s.
export function useOverview(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: keys.overview(period),
    queryFn: () => apiFetch<AnalyticsOverview>(`/analytics/overview?period=${period}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

// Posts list — poll ~30s. filter: all | published | processing | failed
export function usePosts(filter: string = 'all') {
  return useQuery({
    queryKey: keys.posts(filter),
    queryFn: () => apiFetch<Post[]>(`/posts?filter=${filter}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function usePost(id: number) {
  return useQuery({
    queryKey: keys.post(id),
    queryFn: () => apiFetch<Post>(`/posts/${id}`),
    refetchInterval: 15_000,
  });
}

export function useSocialAccounts() {
  return useQuery({
    queryKey: keys.accounts,
    queryFn: () => apiFetch<SocialAccount[]>('/social-accounts'),
  });
}
