import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../settingsStore';

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({ questionSource: 'the-trivia-api', isHydrated: false });
});

describe('settingsStore', () => {
  it('defaults to the-trivia-api', () => {
    expect(useSettingsStore.getState().questionSource).toBe('the-trivia-api');
  });

  it('setQuestionSource updates state', () => {
    useSettingsStore.getState().setQuestionSource('the-trivia-api');
    expect(useSettingsStore.getState().questionSource).toBe('the-trivia-api');
  });

  it('isHydrated is false before rehydration', () => {
    expect(useSettingsStore.getState().isHydrated).toBe(false);
  });

  it('isHydrated is true after rehydration', async () => {
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().isHydrated).toBe(true);
  });

  it('persisted value is restored on re-init', async () => {
    await AsyncStorage.setItem(
      '@cirquiz/settings',
      JSON.stringify({
        state: { questionSource: 'the-trivia-api' },
        version: 1,
      })
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().questionSource).toBe('the-trivia-api');
  });

  it('migrates settings to defaults when stored version is outdated', async () => {
    await AsyncStorage.setItem(
      '@cirquiz/settings',
      JSON.stringify({
        state: { questionSource: 'the-trivia-api' },
        version: 0,
      })
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().questionSource).toBe('the-trivia-api');
  });

  it('isHydrated is not persisted', async () => {
    useSettingsStore.setState({ isHydrated: true });
    const stored = await AsyncStorage.getItem('@cirquiz/settings');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.isHydrated).toBeUndefined();
  });
});
