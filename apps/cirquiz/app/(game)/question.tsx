import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AnswerButton } from '../../src/components/AnswerButton';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { useGameStore } from '../../src/state/gameStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/theme';

export default function QuestionScreen() {
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const [selected, setSelected] = useState<string | null>(null);
  // Freeze the accent color at mount so submitAnswer's store update (which advances
  // currentPlayerIndex) doesn't recolor the buttons during the slide-away animation.
  const [accentColor] = useState(() => {
    const g = useGameStore.getState().game;
    if (!g) return colors.primary;
    const r = g.rounds[g.currentRoundIndex];
    return g.players[r.currentPlayerIndex].color;
  });

  if (!game) return null;

  const round = game.rounds[game.currentRoundIndex];
  const question = round.questions[round.currentQuestionIndex];

  const handleAnswer = (answer: string) => {
    if (selected) return;
    setSelected(answer);
    setTimeout(() => {
      submitAnswer(answer);
    }, 150);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <QuestionHeader
        question={question}
        questionIndex={round.currentQuestionIndex}
        questionCount={round.questions.length}
      />
      <View style={styles.optionsContainer}>
        {question.options.map((option) => (
          <AnswerButton
            key={option}
            label={option}
            selected={selected === option}
            disabled={selected !== null}
            accentColor={accentColor}
            onPress={() => handleAnswer(option)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  container: {
    backgroundColor: colors.background,
    padding: spacing.xl,
    paddingTop: spacing.lg,
    flexGrow: 1,
  },
  optionsContainer: { gap: spacing.md },
  playerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingRight: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  playerBadgeName: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.md,
  },
});
