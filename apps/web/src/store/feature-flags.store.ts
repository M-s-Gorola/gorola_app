import { create } from "zustand";

type FeatureFlagsState = {
  flags: Record<string, boolean>;
  setFlag: (key: string, value: boolean) => void;
  getFlag: (key: string) => boolean;
  reset: () => void;
};

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  flags: {},
  setFlag: (key, value) =>
    set((s) => ({
      flags: { ...s.flags, [key]: value }
    })),
  getFlag: (key) => {
    // eslint-disable-next-line security/detect-object-injection
    return get().flags[key] ?? false;
  },
  reset: () => set({ flags: {} })
}));
