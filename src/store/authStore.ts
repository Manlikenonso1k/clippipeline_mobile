import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'clippipeline_token';

// Token lives in expo-secure-store on native, sessionStorage on web (per-tab, so
// multiple browser tabs = independent logins for dev testing). Every read/write
// is wrapped in try/catch — storage can be blocked or empty.
async function persist(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } else {
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // ignore — storage unavailable
  }
}

async function load(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return sessionStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  hydrated: false,
  hydrate: async () => {
    const token = await load();
    set({ token, hydrated: true });
  },
  setToken: async (token: string) => {
    await persist(token);
    set({ token });
  },
  clear: async () => {
    await persist(null);
    set({ token: null });
  },
}));
