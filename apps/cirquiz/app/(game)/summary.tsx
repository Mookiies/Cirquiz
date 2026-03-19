import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { GradientScreen } from '../../src/components/GradientScreen';
import { ShineButton } from '../../src/components/ShineButton';
import { useQuitGame } from '../../src/hooks/useQuitGame';
import { useGameStore } from '../../src/state/gameStore';
import { Turn } from '../../src/state/types';
import { Question } from '../../src/providers/types';
import { colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';

type RoundHeaderItem = {
  type: 'round-header';
  key: string;
  roundIndex: number;
};

type QuestionItem = {
  type: 'question';
  key: string;
  question: Question;
  turns: Turn[];
  questionIndex: number;
};

type ListItem = RoundHeaderItem | QuestionItem;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<ListItem>);

export default function SummaryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const startNextRound = useGameStore((s) => s.startNextRound);
  const quitGame = useGameStore((s) => s.quitGame);
  const isLoading = useGameStore((s) => s.isLoading);
  const handleQuit = useQuitGame();
  const navigation = useNavigation();
  const [stickyBottomHeight, setStickyBottomHeight] = useState(0);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, spacing.xl + spacing.sm], [0, 1], Extrapolation.CLAMP),
  }));

  const items = useMemo<ListItem[]>(() => {
    if (!game) return [];
    const completedRounds = game.rounds.filter((r) => r.state === 'completed');
    const multipleRounds = completedRounds.length > 1;
    return completedRounds
      .flatMap((round, roundIndex) => {
        const header: RoundHeaderItem | null = multipleRounds
          ? { type: 'round-header', key: `header-${round.id}`, roundIndex }
          : null;
        const questions: QuestionItem[] = round.questions
          .map((question, questionIndex) => ({
            type: 'question' as const,
            key: `${round.id}-${question.id}`,
            question,
            turns: round.turns.filter((tu) => tu.questionId === question.id),
            questionIndex,
          }))
          .reverse();
        return header ? [...questions, header] : questions;
      })
      .reverse();
  }, [game]);

  if (!game) return null;

  const handleEndSession = () => {
    quitGame();
    navigation
      .getParent()
      ?.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'index' }] }));
  };

  return (
    <GradientScreen showBlobs={false} mode="no-white">
      <GameHeader variant="transparent" onBack={() => router.back()} onQuit={handleQuit} />
      <View style={styles.scrollContainer}>
        <AnimatedFlatList
          data={items}
          keyExtractor={(item) => item.key}
          style={styles.list}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: stickyBottomHeight + spacing.xl,
          }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={<Text style={styles.title}>{t('game.summary.title')}</Text>}
          renderItem={({ item }) => {
            if (item.type === 'round-header') {
              return (
                <Text style={styles.roundHeader}>
                  {t('game.summary.roundLabel', { n: item.roundIndex + 1 })}
                </Text>
              );
            }

            const { question, turns, questionIndex } = item;
            return (
              <View style={styles.questionCard}>
                <Text style={styles.questionIndex}>
                  {t('game.summary.questionLabel', { n: questionIndex + 1 })}
                </Text>
                <Text style={styles.questionText}>{question.text}</Text>
                <Text style={styles.correctAnswer}>
                  {t('game.summary.correctAnswer', { answer: question.correctAnswer })}
                </Text>
                <View style={styles.playerAnswers}>
                  {game.players.map((player) => {
                    const turn = turns.find((tu) => tu.playerId === player.id);
                    if (!turn) return null;
                    return (
                      <View
                        key={player.id}
                        style={[styles.playerRow, { borderLeftColor: player.color }]}
                      >
                        <AvatarIcon avatarKey={player.avatar} size={28} style={styles.avatar} />
                        <View style={styles.playerInfo}>
                          <Text style={styles.playerName}>{player.name}</Text>
                          <Text style={styles.playerAnswer}>{turn.selectedAnswer}</Text>
                        </View>
                        <Ionicons
                          name={turn.isCorrect ? 'checkmark-circle' : 'close-circle'}
                          size={22}
                          color={turn.isCorrect ? colors.success : colors.error}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
        <Animated.View style={[styles.fadeOverlay, overlayStyle]} pointerEvents="none">
          <LinearGradient
            colors={[colors.primaryFaint, 'rgba(255,255,255,0)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <View
        style={[styles.stickyBottom, { paddingBottom: insets.bottom + spacing.xs }]}
        onLayout={(e) => setStickyBottomHeight(e.nativeEvent.layout.height)}
      >
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={['rgba(243,238,255,0)', colors.difficultyFaint]}
          pointerEvents="none"
          locations={[0, 0.3]}
        />
        <ShineButton
          label={t('game.summary.playAnotherRound')}
          color={colors.success}
          loading={isLoading}
          onPress={() => {
            startNextRound((path) => {
              const name = path.replace('/(game)/', '');
              navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name }] }));
            });
          }}
          style={styles.roundButton}
        />
        <Button
          variant="text"
          label={t('game.summary.endSession')}
          color={colors.error}
          onPress={handleEndSession}
          haptic="light"
        />
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  list: { flex: 1 },
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
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  roundHeader: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  questionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  questionIndex: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  questionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  correctAnswer: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  playerAnswers: { gap: spacing.sm },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    backgroundColor: colors.surface,
  },
  avatar: { marginRight: spacing.sm, flexShrink: 0 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  playerAnswer: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  roundButton: { marginBottom: spacing.md },
});
