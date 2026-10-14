import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { errorText } from '@/api/client';
import { useIsGuest, useNotifications, useReadAllNotifications } from '@/api/hooks';
import type { AppNotification } from '@/api/types';
import { timeAgo } from '@/components/post-utils';
import { Sheet, SheetButton, SheetRow, SheetText } from '@/components/sheet';
import { InlineMessage, Skeleton } from '@/components/ui-kit';
import { useUiStore } from '@/store/uiStore';

/** PARITY X1 — the one reusable "Sign in to do this" sheet. */
function SignInSheet() {
  const reason = useUiStore((s) => s.signInReason);
  const close = useUiStore((s) => s.closeSignIn);
  return (
    <Sheet visible={reason !== null} onClose={close} title="Sign in to do this" subtitle="You're exploring in Preview mode with sample data.">
      <SheetText>{reason ?? ''}</SheetText>
      <SheetButton
        tone="primary"
        icon="login"
        label="Sign in"
        onPress={() => {
          close();
          router.push('/login');
        }}
      />
      <SheetButton label="Keep exploring" onPress={close} />
    </Sheet>
  );
}

const TYPE_ICON: Record<AppNotification['type'], { icon: 'check-circle' | 'error-outline' | 'vpn-key'; color: string }> = {
  distribution_published: { icon: 'check-circle', color: '#28C76F' },
  distribution_failed: { icon: 'error-outline', color: '#EA5455' },
  account_needs_reauth: { icon: 'vpn-key', color: '#FF9F43' },
};

/** PARITY X2 — header bell. */
function NotificationsSheet() {
  const open = useUiStore((s) => s.notificationsOpen);
  const setOpen = useUiStore((s) => s.setNotificationsOpen);
  const guest = useIsGuest();
  const q = useNotifications();
  const readAll = useReadAllNotifications();
  const items = q.data?.items ?? [];
  const unread = q.data?.unread_count ?? 0;
  const close = () => setOpen(false);

  const go = (n: AppNotification) => {
    close();
    if (n.data?.postId != null) router.push({ pathname: '/post/[id]', params: { id: String(n.data.postId) } });
    else if (n.type === 'account_needs_reauth') router.push({ pathname: '/connect', params: { reauth: n.data?.provider ?? '' } });
  };

  return (
    <Sheet visible={open && !guest} onClose={close} title="Notifications" subtitle={unread ? `${unread} unread` : 'All caught up'}>
      {q.isLoading ? (
        <>
          <Skeleton height={52} radius={12} />
          <Skeleton height={52} radius={12} />
        </>
      ) : q.isError && !q.data ? (
        <>
          <InlineMessage tone="danger" icon="cloud-off" text={errorText(q.error)} />
          <SheetButton icon="refresh" label="Retry" onPress={() => void q.refetch()} />
        </>
      ) : items.length === 0 ? (
        <InlineMessage icon="notifications-none" text="No notifications yet. You'll see publish results and account alerts here." />
      ) : (
        items.map((n) => {
          const t = TYPE_ICON[n.type] ?? TYPE_ICON.distribution_published;
          return (
            <SheetRow
              key={n.id}
              icon={t.icon}
              iconColor={t.color}
              label={n.title}
              sub={`${n.body} • ${timeAgo(n.created_at)}`}
              selected={!n.read_at}
              onPress={() => go(n)}
              right={!n.read_at ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#CABEFF' }} /> : <MaterialIcons name="chevron-right" size={18} color="#A1A1AE" />}
            />
          );
        })
      )}
      {readAll.isError ? <InlineMessage tone="danger" icon="error-outline" text={errorText(readAll.error)} /> : null}
      {unread > 0 ? (
        <SheetButton icon="done-all" label="Mark all as read" loading={readAll.isPending} onPress={() => readAll.mutate()} />
      ) : null}
    </Sheet>
  );
}

export function GlobalSheets() {
  return (
    <>
      <SignInSheet />
      <NotificationsSheet />
    </>
  );
}
