import { router } from 'expo-router';
import { create } from 'zustand';

import { useAuthStore } from '@/store/authStore';

// App-wide sheets that any screen can open: the guest "Sign in to do this" sheet (PARITY X1)
// and the notifications sheet behind the header bell (X2).
interface UiState {
  signInReason: string | null;
  notificationsOpen: boolean;
  openSignIn: (reason?: string) => void;
  closeSignIn: () => void;
  setNotificationsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  signInReason: null,
  notificationsOpen: false,
  openSignIn: (reason) => set({ signInReason: reason ?? 'Sign in to use your own account for this.' }),
  closeSignIn: () => set({ signInReason: null }),
  setNotificationsOpen: (open) => set({ notificationsOpen: open }),
}));

/** True when signed in; otherwise opens the sign-in sheet and returns false. */
export function requireAccount(reason?: string): boolean {
  if (useAuthStore.getState().token) return true;
  useUiStore.getState().openSignIn(reason);
  return false;
}

/** Header bell. */
export function openNotifications() {
  if (!requireAccount('Sign in to see notifications about your posts and accounts.')) return;
  useUiStore.getState().setNotificationsOpen(true);
}

/** Header avatar → Profile tab. */
export function openProfile() {
  if (!requireAccount('Sign in to see your profile, plan and settings.')) return;
  router.navigate('/profile');
}
