import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnswerButton } from '../../src/components/AnswerButton';
import { useGameStore } from '../../src/state/gameStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function QuestionScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const [selected, setSelected] = useState<string | null>(null);

  if (!game) return null;

  const round = game.rounds[game.currentRoundIndex];
  const question = round.questions[round.currentQuestionIndex];
  const currentPlayer = game.players[round.currentPlayerIndex];

  const handleAnswer = (answer: string) => {
    if (selected) return;
    setSelected(answer);
    submitAnswer(answer);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <Text style={styles.progress}>
        {t('game.question.title', {
          current: round.currentQuestionIndex + 1,
          total: round.questions.length,
        })}
      </Text>
      <Text style={styles.category}>
        {question.category} · {question.difficulty}
      </Text>
      <Text style={styles.questionText}>{question.text}</Text>
      <View style={styles.optionsContainer}>
        {question.options.map((option) => (
          <AnswerButton
            key={option}
            label={option}
            selected={selected === option}
            disabled={selected !== null}
            accentColor={currentPlayer.color}
            onPress={() => handleAnswer(option)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  container: { backgroundColor: '#fff', padding: 24, flexGrow: 1 },
  progress: { fontSize: 14, color: '#888', marginBottom: 4 },
  category: { fontSize: 12, color: '#aaa', marginBottom: 20 },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222',
    marginBottom: 32,
    lineHeight: 30,
  },
  optionsContainer: { gap: 12 },
});
