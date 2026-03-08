import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { useGameStore } from '../../src/state/gameStore';

export default function RevealScreen() {
  const { t } = useTranslation();
  const game = useGameStore((s) => s.game);
  const advanceAfterReveal = useGameStore((s) => s.advanceAfterReveal);

  if (!game) return null;

  const round = game.rounds[game.currentRoundIndex];
  const question = round.questions[round.currentQuestionIndex];
  const isLastQuestion = round.currentQuestionIndex === round.questions.length - 1;

  // Turns for the current question
  const questionTurns = round.turns.filter((turn) => turn.questionId === question.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.correctAnswer}>
        {t('game.reveal.correctAnswer', { answer: question.correctAnswer })}
      </Text>

      <View style={styles.resultsContainer}>
        {questionTurns.map((turn) => {
          const player = game.players.find((p) => p.id === turn.playerId);
          if (!player) return null;
          return (
            <View key={turn.playerId} style={[styles.resultRow, { borderLeftColor: player.color }]}>
              <View style={styles.resultInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerAnswer}>{turn.selectedAnswer}</Text>
              </View>
              <View style={styles.resultRight}>
                <Text style={[styles.resultIcon, turn.isCorrect ? styles.correct : styles.wrong]}>
                  {turn.isCorrect ? t('game.reveal.correct') : t('game.reveal.wrong')}
                </Text>
                <Text style={styles.score}>
                  Round: {player.roundScore} | Total: {player.cumulativeScore}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Button
        label={isLastQuestion ? t('game.reveal.viewStandings') : t('game.reveal.nextQuestion')}
        onPress={advanceAfterReveal}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  correctAnswer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2ECC71',
    marginBottom: 24,
    textAlign: 'center',
  },
  resultsContainer: { gap: 12, marginBottom: 32 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    backgroundColor: '#f8f8f8',
  },
  resultInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '600', color: '#222' },
  playerAnswer: { fontSize: 14, color: '#555', marginTop: 2 },
  resultRight: { alignItems: 'flex-end' },
  resultIcon: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  correct: { color: '#2ECC71' },
  wrong: { color: '#E74C3C' },
  score: { fontSize: 12, color: '#888' },
});
