import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'clippipeline_settings';

interface Settings {
  alertSound: boolean;
}
const DEFAULTS: Settings = { alertSound: true };

async function persist(s: Settings) {
  try {
    const v = JSON.stringify(s);
    if (Platform.OS === 'web') localStorage.setItem(KEY, v);
    else await SecureStore.setItemAsync(KEY, v);
  } catch {
    // ignore
  }
}

async function load(): Promise<Settings> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(KEY)
        : await SecureStore.getItemAsync(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

interface SettingsState extends Settings {
  hydrate: () => Promise<void>;
  setAlertSound: (on: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrate: async () => set(await load()),
  setAlertSound: async (on: boolean) => {
    set({ alertSound: on });
    await persist({ alertSound: get().alertSound });
  },
}));
