import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { AvatarIcon } from '../../src/components/AvatarIcon';
import { Button } from '../../src/components/Button';
import { GameHeader } from '../../src/components/GameHeader';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { useGameStore } from '../../src/state/gameStore';
import { useQuitGame } from '../../src/hooks/useQuitGame';
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/theme';
import { GradientScreen } from '../../src/components/GradientScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RevealScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const advanceAfterReveal = useGameStore((s) => s.advanceAfterReveal);
  const handleQuit = useQuitGame();

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, CONTENT_PADDING_TOP + spacing.sm],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  if (!game) return null;

  const round = game.rounds[game.currentRoundIndex];
  const question = round.questions[round.currentQuestionIndex];
  const isLastQuestion = round.currentQuestionIndex === round.questions.length - 1;

  // Turns for the current question
  const questionTurns = round.turns.filter((turn) => turn.questionId === question.id);

  return (
    <GradientScreen showBlobs={false} mode="no-white">
      <GameHeader variant="transparent" onQuit={handleQuit} />
      <View style={styles.scrollContainer}>
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
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
                <View
                  key={turn.playerId}
                  style={[styles.resultRow, { borderLeftColor: player.color }]}
                >
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
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.ScrollView>
        <Animated.View style={[styles.fadeOverlay, overlayStyle]} pointerEvents="none">
          <LinearGradient
            colors={[colors.primaryFaint, 'rgba(255,255,255,0)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + spacing.md }]}>
          <LinearGradient
            style={StyleSheet.absoluteFill}
            colors={['rgba(243,238,255,0)', colors.difficultyFaint]}
            pointerEvents="none"
          />
          <Button
            variant="raised"
            label={isLastQuestion ? t('game.reveal.viewStandings') : t('game.reveal.nextQuestion')}
            onPress={advanceAfterReveal}
            haptic="strong"
          />
        </View>
      </View>
    </GradientScreen>
  );
}

const CONTENT_PADDING_TOP = spacing.xl;

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  scrollView: { flex: 1 },
  fadeOverlay: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: '100%',
    height: 40,
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  content: { padding: CONTENT_PADDING_TOP, paddingBottom: 160 },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
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
    backgroundColor: colors.white,
  },
  resultAvatar: { marginRight: spacing.sm, flexShrink: 0 },
  resultInfo: { flex: 1 },
  playerName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  playerAnswer: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  resultRight: { alignItems: 'flex-end' },
  resultIcon: { marginBottom: spacing.xs },
  score: { fontSize: fontSize.sm, color: colors.textTertiary },
});
