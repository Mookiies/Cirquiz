import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { useGameStore } from '../../src/state/gameStore';

export default function HandoffScreen() {
  const { t } = useTranslation();
  const game = useGameStore((s) => s.game);

  if (!game) return null;

  const round = game.rounds[game.currentRoundIndex];
  const currentPlayer = game.players[round.currentPlayerIndex];

  return (
    <View style={[styles.container, { backgroundColor: currentPlayer.color }]}>
      <Text style={styles.title}>
        {t('game.handoff.title', { name: currentPlayer.name })}
      </Text>
      <Text style={styles.subtitle}>
        Question {round.currentQuestionIndex + 1} of {round.questions.length}
      </Text>
      <Button
        label={t('game.handoff.ready')}
        color="#fff"
        textColor="#333"
        onPress={() => router.replace('/(game)/question')}
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
    padding: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 48,
  },
  readyButton: {
    paddingHorizontal: 48,
  },
});
