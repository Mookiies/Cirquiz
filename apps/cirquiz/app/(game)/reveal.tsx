import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AvatarIcon } from '../../src/components/AvatarIcon';
import { Button } from '../../src/components/Button';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { useGameStore } from '../../src/state/gameStore';
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/theme';

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
      <QuestionHeader
        question={question}
        questionIndex={round.currentQuestionIndex}
        questionCount={round.questions.length}
      />
      <Text style={styles.correctAnswer}>
        {t('game.reveal.correctAnswer', { answer: question.correctAnswer })}
      </Text>

      <View style={styles.resultsContainer}>
        {questionTurns.map((turn) => {
          const player = game.players.find((p) => p.id === turn.playerId);
          if (!player) return null;
          return (
            <View key={turn.playerId} style={[styles.resultRow, { borderLeftColor: player.color }]}>
              <AvatarIcon avatarKey={player.avatar} size={32} style={styles.resultAvatar} />
              <View style={styles.resultInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerAnswer}>{turn.selectedAnswer}</Text>
              </View>
              <View style={styles.resultRight}>
                <Ionicons
                  name={turn.isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={turn.isCorrect ? colors.success : colors.error}
                  style={styles.resultIcon}
                />
                <Text style={styles.score} maxFontSizeMultiplier={1}>
                  {t('game.reveal.score', {
                    round: player.roundScore,
                    total: player.cumulativeScore,
                  })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Button
        raised
        label={isLastQuestion ? t('game.reveal.viewStandings') : t('game.reveal.nextQuestion')}
        onPress={advanceAfterReveal}
        haptic="strong"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing['4xl'] },
  correctAnswer: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.success,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  resultsContainer: { gap: spacing.md, marginBottom: spacing['2xl'] },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
  },
  resultAvatar: { marginRight: spacing.sm, flexShrink: 0 },
  resultInfo: { flex: 1 },
  playerName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  playerAnswer: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  resultRight: { alignItems: 'flex-end' },
  resultIcon: { marginBottom: spacing.xs },
  score: { fontSize: fontSize.sm, color: colors.textTertiary },
});
