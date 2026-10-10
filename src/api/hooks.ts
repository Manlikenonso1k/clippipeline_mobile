import { QueryClient, useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from './client';
import { useAuthStore } from '@/store/authStore';
import { DEMO_ACCOUNTS, DEMO_ME, DEMO_OVERVIEW, demoPost, demoPosts } from './demo';
import type { Me, Post, SocialAccount, AnalyticsOverview } from './types';

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

// Guest / Preview mode: with no auth token we don't hit the API — the queries
// are disabled and `placeholderData` serves the demo dataset instead, so every
// screen is fully explorable signed-out. Once a token exists, the real API is
// fetched normally and the demo data is replaced.

// GET /api/me — role/tenant/config comes from here; nothing hardcoded client-side.
export function useMe() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.me,
    queryFn: () => apiFetch<Me>('/me'),
    enabled: !!token,
    placeholderData: token ? undefined : DEMO_ME,
  });
}

// Dashboard overview — poll ~60s.
export function useOverview(period: '7d' | '30d' | '90d' = '30d') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.overview(period),
    queryFn: () => apiFetch<AnalyticsOverview>(`/analytics/overview?period=${period}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : DEMO_OVERVIEW,
    refetchInterval: token ? 60_000 : false,
  });
}

// Posts list — poll ~30s. filter: all | published | processing | failed
export function usePosts(filter: string = 'all') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.posts(filter),
    queryFn: () => apiFetch<Post[]>(`/posts?filter=${filter}`),
    enabled: !!token,
    placeholderData: token ? keepPreviousData : demoPosts(filter),
    refetchInterval: token ? 30_000 : false,
  });
}

export function usePost(id: number) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.post(id),
    queryFn: () => apiFetch<Post>(`/posts/${id}`),
    enabled: !!token,
    placeholderData: token ? undefined : demoPost(id),
    refetchInterval: token ? 15_000 : false,
  });
}

export function useSocialAccounts() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: keys.accounts,
    queryFn: () => apiFetch<SocialAccount[]>('/social-accounts'),
    enabled: !!token,
    placeholderData: token ? undefined : DEMO_ACCOUNTS,
  });
}
