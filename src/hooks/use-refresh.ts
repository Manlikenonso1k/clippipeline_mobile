import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

type Refetchable = { refetch: () => Promise<unknown> };

/**
 * Pull-to-refresh + refetch-on-focus for a set of react-query results.
 * Skips the initial focus (queries already fetch on mount) and guest mode.
 */
export function useRefresh(queries: Refetchable[]) {
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef(queries);
  useEffect(() => {
    ref.current = queries;
  });
  const firstFocus = useRef(true);

  const refetchAll = useCallback(() => Promise.all(ref.current.map((q) => q.refetch().catch(() => undefined))), []);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (useAuthStore.getState().token) void refetchAll();
    }, [refetchAll]),
  );

  const onRefresh = useCallback(async () => {
    if (!useAuthStore.getState().token) return;
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);

  return { refreshing, onRefresh };
}
