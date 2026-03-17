import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundaryProps, Stack } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { useGameStore } from '../src/state/gameStore';
import { useModelStore } from '../src/state/modelStore';
import { useSettingsStore } from '../src/state/settingsStore';
import '../src/i18n';
import { colors, spacing, fontSize, fontWeight } from '../src/theme';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const handleResetGame = async () => {
    // Layer 1: call the store action
    try {
      useGameStore.getState().quitGame();
    } catch {
      // Layer 2: directly patch store state
      try {
        useGameStore.setState({ game: null, isLoading: false });
      } catch {
        // Layer 3: wipe persisted storage so the next boot starts clean
        try {
          await AsyncStorage.removeItem('@cirquiz/active_game');
        } catch {
          // nothing left to try
        }
      }
    }
    await retry();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{t('error.somethingWentWrong')}</Text>
      <Text style={styles.message} numberOfLines={5}>
        {error.message}
      </Text>
      <Button
        label={t('error.tryAgain')}
        onPress={retry}
        style={{ width: '100%', marginBottom: spacing.md }}
      />
      <Button
        label={t('error.resetGame')}
        color={colors.error}
        onPress={handleResetGame}
        style={{ width: '100%' }}
      />
    </View>
  );
}

export default function RootLayout() {
  const questionSource = useSettingsStore((s) => s.questionSource);
  const modelStatus = useModelStore((s) => s.status);
  const initModel = useModelStore((s) => s.initModel);

  useEffect(() => {
    if (questionSource === 'ai-generated' && modelStatus === 'available') {
      initModel();
    }
  }, [questionSource, modelStatus, initModel]);

  return (
    <KeyboardProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  icon: { fontSize: 56, marginBottom: spacing.lg },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
