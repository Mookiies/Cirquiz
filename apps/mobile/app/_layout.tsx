import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../src/state/gameStore';
import '../src/i18n';

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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 12, textAlign: 'center' },
  message: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
