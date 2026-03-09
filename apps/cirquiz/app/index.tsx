import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { useGameStore } from '../src/state/gameStore';
import { colors, spacing, fontSize, fontWeight } from '../src/theme';

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
          color={colors.success}
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
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing['4xl'],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  button: {
    width: '100%',
    marginBottom: spacing.lg,
  },
});
