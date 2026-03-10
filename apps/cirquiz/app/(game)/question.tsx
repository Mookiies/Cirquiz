import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AnswerButton } from '../../src/components/AnswerButton';
import { BackgroundBlobs } from '../../src/components/BackgroundBlobs';
import { GameHeader } from '../../src/components/GameHeader';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { useGameStore } from '../../src/state/gameStore';
import { useQuitGame } from '../../src/hooks/useQuitGame';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../src/theme';

export default function QuestionScreen() {
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const handleQuit = useQuitGame();
  const [selected, setSelected] = useState<string | null>(null);
  // Freeze the player and accent color at mount so submitAnswer's store update (which advances
  // currentPlayerIndex) doesn't recolor the buttons or header during the slide-away animation.
  const [frozenPlayer] = useState(() => {
    const g = useGameStore.getState().game;
    if (!g) return null;
    const r = g.rounds[g.currentRoundIndex];
    return g.players[r.currentPlayerIndex];
  });
  const [accentColor] = useState(() => frozenPlayer?.color ?? colors.primary);

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
    <View style={styles.outerContainer}>
      <BackgroundBlobs />
      {frozenPlayer && <GameHeader variant="player" player={frozenPlayer} onQuit={handleQuit} />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1 },
  scrollView: { flex: 1 },
  container: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    flexGrow: 1,
  },
  optionsContainer: { gap: spacing.md },
});
