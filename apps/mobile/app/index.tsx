import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { useGameStore } from '../src/state/gameStore';

export default function HomeScreen() {
  const { t } = useTranslation();
  const isHydrated = useGameStore((s) => s.isHydrated);
  const game = useGameStore((s) => s.game);

  if (!isHydrated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('home.loading')}</Text>
      </View>
    );
  }

  const canResume = game !== null && (game.state === 'in-progress' || game.state === 'completed');

  const handleResume = () => {
    if (!game) return;
    if (game.state === 'completed') {
      router.replace('/(game)/standings');
    } else if (game.players.length > 1) {
      router.replace('/(game)/handoff');
    } else {
      router.replace('/(game)/question');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.appName')}</Text>
      <Button
        label={t('home.newGame')}
        onPress={() => router.push('/setup')}
        style={styles.button}
      />
      {canResume && (
        <Button
          label={t('home.resumeGame')}
          color="#2ECC71"
          onPress={handleResume}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  button: {
    width: '100%',
    marginBottom: 16,
  },
});
