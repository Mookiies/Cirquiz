import AsyncStorage from '@react-native-async-storage/async-storage';
import { initLlama, LlamaContext, releaseAllLlama } from 'llama.rn';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const STORAGE_KEY = '@cirquiz/model';

export type ModelStatus = 'not_downloaded' | 'downloading' | 'available' | 'error';

interface ModelStoreState {
  status: ModelStatus;
  downloadProgress: number; // 0–1, runtime only
  modelPath: string | null; // persisted
  isInitializing: boolean; // runtime only
  llamaContext: LlamaContext | null; // runtime only
}

interface ModelStoreActions {
  initModel: () => Promise<void>;
  releaseModel: () => Promise<void>;
  getContext: () => LlamaContext | null;
  _setProgress: (progress: number) => void;
  _setStatus: (status: ModelStatus) => void;
  _setModelPath: (path: string | null) => void;
}

type ModelStore = ModelStoreState & ModelStoreActions;

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      status: 'not_downloaded',
      downloadProgress: 0,
      modelPath: null,
      isInitializing: false,
      llamaContext: null,

      initModel: async () => {
        const { modelPath, llamaContext } = get();
        if (!modelPath) return;
        if (llamaContext) return; // already loaded

        set({ isInitializing: true });
        try {
          const context = await initLlama({
            model: modelPath,
            n_ctx: 2048,
            n_gpu_layers: 99,
            n_threads: 6,
          });
          set({ llamaContext: context, isInitializing: false });
        } catch {
          set({ isInitializing: false });
        }
      },

      releaseModel: async () => {
        set({ llamaContext: null, isInitializing: false });
        await releaseAllLlama();
      },

      getContext: () => get().llamaContext,

      _setProgress: (progress) => set({ downloadProgress: progress }),
      _setStatus: (status) => set({ status }),
      _setModelPath: (path) => set({ modelPath: path }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist status and modelPath; runtime state resets on app restart
      partialize: ({ status, modelPath }) => ({ status, modelPath }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reset runtime fields that must not persist across app restarts
          state.downloadProgress = 0;
          state.isInitializing = false;
          state.llamaContext = null;
          // If app was killed during download, treat as error so user can retry
          if (state.status === 'downloading') {
            state.status = 'error';
          }
        }
      },
    }
  )
);
