/**
 * T028 — Happy-path: selecting "AI Generated" in settings persists the
 * questionSource value so it survives a simulated app restart.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// We import the store AFTER clearing AsyncStorage in beforeEach
let useSettingsStore: typeof import('../state/settingsStore').useSettingsStore;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.resetModules();
  ({ useSettingsStore } = await import('../state/settingsStore'));
});

it('persists questionSource="ai-generated" to AsyncStorage', async () => {
  const store = useSettingsStore.getState();
  store.setQuestionSource('ai-generated');

  // Give the persist middleware time to write
  await new Promise((r) => setTimeout(r, 50));

  const raw = await AsyncStorage.getItem('@cirquiz/settings');
  expect(raw).not.toBeNull();
  const parsed = JSON.parse(raw!);
  expect(parsed.state.questionSource).toBe('ai-generated');
});

it('restores questionSource="ai-generated" after simulated restart', async () => {
  // Pre-seed AsyncStorage with persisted AI source selection
  await AsyncStorage.setItem(
    '@cirquiz/settings',
    JSON.stringify({ state: { questionSource: 'ai-generated' }, version: 2 })
  );

  jest.resetModules();
  const { useSettingsStore: freshStore } = await import('../state/settingsStore');

  // Wait for rehydration
  await new Promise((r) => setTimeout(r, 50));

  expect(freshStore.getState().questionSource).toBe('ai-generated');
});
