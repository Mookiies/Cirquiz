import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AvatarIcon } from '../../src/components/AvatarIcon';
import { Button } from '../../src/components/Button';
import { useGameStore } from '../../src/state/gameStore';
import { colors, spacing, fontSize, fontWeight } from '../../src/theme';
import { darkenHex } from '../../src/utils/color';

export default function HandoffScreen() {
  const { t } = useTranslation();
  const game = useGameStore((s) => s.game);

  if (!game) return null;

  const round = game.rounds[game.currentRoundIndex];
  const currentPlayer = game.players[round.currentPlayerIndex];

  return (
    <View style={[styles.container, { backgroundColor: currentPlayer.color }]}>
      <AvatarIcon avatarKey={currentPlayer.avatar} size={120} style={styles.avatar} />
      <Text style={styles.title}>{t('game.handoff.title', { name: currentPlayer.name })}</Text>
      <Text style={styles.subtitle}>
        {t('game.question.title', {
          current: round.currentQuestionIndex + 1,
          total: round.questions.length,
        })}
      </Text>
      <Button
        variant="raised"
        label={t('game.handoff.ready')}
        color={colors.white}
        textColor={colors.text}
        accentColor={darkenHex(currentPlayer.color)}
        onPress={() => router.replace('/(game)/question')}
        haptic="light"
        style={styles.readyButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing['4xl'],
  },
  avatar: {
    marginBottom: spacing.xl,
  },
  readyButton: {
    alignSelf: 'stretch',
  },
});
