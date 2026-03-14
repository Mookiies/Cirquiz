import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = '@cirquiz/settings';

export type QuestionSource = 'otdb' | 'the-trivia-api';

interface SettingsStoreState {
  questionSource: QuestionSource;
  isHydrated: boolean;
}

interface SettingsStoreActions {
  setQuestionSource: (source: QuestionSource) => void;
}

type SettingsStore = SettingsStoreState & SettingsStoreActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      questionSource: 'otdb',
      isHydrated: false,
      setQuestionSource: (source) => set({ questionSource: source }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ isHydrated, ...rest }) => rest,
      migrate: (persistedState, fromVersion) => {
        // v0 had no schema — treat as empty and fall back to defaults
        if (fromVersion < 1) {
          return { questionSource: 'otdb' as QuestionSource };
        }
        return persistedState as SettingsStoreState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
    }
  )
);
