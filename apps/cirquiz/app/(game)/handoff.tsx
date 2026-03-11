import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AvatarIcon } from '../../src/components/AvatarIcon';
import { Button } from '../../src/components/Button';
import { GameHeader } from '../../src/components/GameHeader';
import { useGameStore } from '../../src/state/gameStore';
import { useQuitGame } from '../../src/hooks/useQuitGame';
import { colors, spacing, fontSize, fontWeight } from '../../src/theme';
import { darkenHex } from '../../src/utils/color';

export default function HandoffScreen() {
  const { t } = useTranslation();
  const game = useGameStore((s) => s.game);
  const handleQuit = useQuitGame();

  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);

  useEffect(() => {
    scale1.value = withRepeat(
      withTiming(1.03, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    scale2.value = withRepeat(
      withTiming(1.03, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [scale1, scale2]);

  const circle1Style = useAnimatedStyle(() => ({ transform: [{ scale: scale1.value }] }));
  const circle2Style = useAnimatedStyle(() => ({ transform: [{ scale: scale2.value }] }));

  if (!game) return null;

  const round = game.rounds[game.currentRoundIndex];
  const currentPlayer = game.players[round.currentPlayerIndex];

  return (
    <View style={[styles.container, { backgroundColor: currentPlayer.color }]}>
      <Animated.View style={[styles.circleTopRight, circle1Style]} />
      <Animated.View style={[styles.circleBottomLeft, circle2Style]} />
      <GameHeader
        variant="transparent"
        player={currentPlayer}
        onQuit={handleQuit}
        quitTextColor={colors.white}
      />
      <View style={styles.content}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
  circleTopRight: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: -80,
    right: -80,
  },
  circleBottomLeft: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.15)',
    bottom: -80,
    left: -80,
  },
});
