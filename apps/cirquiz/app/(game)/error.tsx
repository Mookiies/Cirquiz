import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { useGameStore } from '../../src/state/gameStore';
import { colors, spacing, fontSize, fontWeight } from '../../src/theme';

export default function ErrorScreen() {
  const { t } = useTranslation();
  const quitGame = useGameStore((s) => s.quitGame);
  const retryFetch = useGameStore((s) => s.retryFetch);
  const isLoading = useGameStore((s) => s.isLoading);

  const handleBack = () => {
    quitGame();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{t('game.error.title')}</Text>
      <Text style={styles.message}>{t('game.error.message')}</Text>
      <Button
        label={t('game.error.retry')}
        onPress={retryFetch}
        loading={isLoading}
        style={styles.button}
      />
      <Button
        label={t('game.error.backHome')}
        onPress={handleBack}
        outlined
        style={styles.button}
      />
    </View>
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
  },
  message: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    lineHeight: 24,
  },
  button: { width: '100%', marginBottom: spacing.md },
});
