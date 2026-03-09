import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../src/state/gameStore';
import '../src/i18n';
import { colors, spacing, fontSize, fontWeight, radius } from '../src/theme';

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
      <TouchableOpacity style={styles.retryButton} onPress={retry}>
        <Text style={styles.buttonText}>{t('error.tryAgain')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.resetButton} onPress={handleResetGame}>
        <Text style={styles.buttonText}>{t('error.resetGame')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
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
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: colors.error,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    borderRadius: radius.lg,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: colors.white, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
});
