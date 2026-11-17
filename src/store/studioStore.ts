import { create } from 'zustand';
import type { AutoCutOptions } from '@/api/types';

/** Work the wizard asks the project screen to do once the server has processed the clips. */
export type PendingSetup = { autoCut: AutoCutOptions | null; applyReference: boolean };

type StudioState = {
  pending: Record<number, PendingSetup>;
  pausePreviews: boolean;
  setPending: (projectId: number, p: PendingSetup | null) => void;
  setPausePreviews: (v: boolean) => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  pending: {},
  pausePreviews: false,
  setPending: (projectId, p) =>
    set((s) => {
      const next = { ...s.pending };
      if (p) next[projectId] = p;
      else delete next[projectId];
      return { pending: next };
    }),
  setPausePreviews: (v) => set({ pausePreviews: v }),
}));
