import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarIcon } from '../src/components/AvatarIcon';
import { BackgroundBlobs } from '../src/components/BackgroundBlobs';
import { Button } from '../src/components/Button';
import { ShineButton } from '../src/components/ShineButton';
import { type AvatarKey } from '../src/avatars';
import { useGameStore } from '../src/state/gameStore';
import { colors, fontSize, spacing } from '../src/theme';
import CirclequizLogo from '../assets/circlequiz.svg';

const TOP_AVATARS: AvatarKey[] = ['chili', 'whale', 'alien', 'jackolantern', 'gremlin', 'robot'];
const BOTTOM_AVATARS: AvatarKey[] = ['brain', 'rubberduck', 'hotsauce', 'yeti'];
const DOT_COLORS = ['#3498DB', '#9B59B6', '#2ECC71', '#F39C12', '#E74C3C'];

function LoadingDot({ color, index }: { color: string; index: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withDelay(
      index * 200,
      withRepeat(
        withSequence(withTiming(1.4, { duration: 400 }), withTiming(1, { duration: 400 })),
        -1
      )
    );
    opacity.value = withDelay(
      index * 200,
      withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0.4, { duration: 400 })),
        -1
      )
    );
  }, [index, opacity, scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />;
}

function BobAvatar({
  avatarKey,
  size,
  index,
}: {
  avatarKey: AvatarKey;
  size: number;
  index: number;
}) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(-4);

  useEffect(() => {
    const dur = 2500 + index * 280;
    const easing = Easing.inOut(Easing.ease);
    translateY.value = withRepeat(withTiming(-10, { duration: dur, easing }), -1, true);
    rotate.value = withRepeat(withTiming(4, { duration: dur, easing }), -1, true);
  }, [index, rotate, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <AvatarIcon avatarKey={avatarKey} size={size} />
    </Animated.View>
  );
}

export default function HomeScreen() {
  console.log('home screen render');

  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHydrated = useGameStore((s) => s.isHydrated);
  const game = useGameStore((s) => s.game);

  const heroOpacity = useSharedValue(0);
  const topRowTranslateY = useSharedValue(-12);
  const topRowOpacity = useSharedValue(0);
  const bottomRowTranslateY = useSharedValue(12);
  const bottomRowOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);

  const startAnimation = useCallback(() => {
    heroOpacity.value = withTiming(1, { duration: 300 });
    topRowTranslateY.value = withDelay(60, withTiming(0, { duration: 300 }));
    topRowOpacity.value = withDelay(60, withTiming(1, { duration: 300 }));
    bottomRowTranslateY.value = withDelay(120, withTiming(0, { duration: 300 }));
    bottomRowOpacity.value = withDelay(120, withTiming(1, { duration: 300 }));
    ctaTranslateY.value = withDelay(180, withTiming(0, { duration: 300 }));
    ctaOpacity.value = withDelay(180, withTiming(1, { duration: 300 }));
  }, [
    heroOpacity,
    topRowTranslateY,
    topRowOpacity,
    bottomRowTranslateY,
    bottomRowOpacity,
    ctaTranslateY,
    ctaOpacity,
  ]);

  useEffect(() => {
    if (!isHydrated) return;
    startAnimation();
  }, [isHydrated, startAnimation]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
  }));
  const topRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: topRowTranslateY.value }],
    opacity: topRowOpacity.value,
  }));
  const bottomRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bottomRowTranslateY.value }],
    opacity: bottomRowOpacity.value,
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ctaTranslateY.value }],
    opacity: ctaOpacity.value,
  }));
  const canResume = game !== null && (game.state === 'in-progress' || game.state === 'completed');

  const handleResume = () => {
    if (!game) return;
    if (game.state === 'completed') {
      router.replace('/(game)/standings');
      return;
    }
    const round = game.rounds[game.currentRoundIndex];
    const currentQuestion = round.questions[round.currentQuestionIndex];
    const turnsForQuestion = round.turns.filter((t) => t.questionId === currentQuestion.id);
    if (turnsForQuestion.length === game.players.length) {
      router.replace('/(game)/reveal');
    } else if (game.players.length > 1) {
      router.replace('/(game)/handoff');
    } else {
      router.replace('/(game)/question');
    }
  };

  if (!isHydrated) {
    return (
      <LinearGradient style={styles.gradient} colors={['#EBF5FB', '#fff', '#f3eeff']}>
        <BackgroundBlobs />
        <View style={styles.loadingContainer}>
          <View style={styles.logoWrapper}>
            <CirclequizLogo width={300} height={84} />
          </View>
          <View style={styles.dotsRow}>
            {DOT_COLORS.map((color, i) => (
              <LoadingDot key={i} color={color} index={i} />
            ))}
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient style={styles.gradient} colors={['#EBF5FB', '#fff', '#f3eeff']}>
      <BackgroundBlobs />
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View style={[styles.avatarRow, topRowStyle]}>
          {TOP_AVATARS.map((key, i) => (
            <BobAvatar key={key} avatarKey={key} size={48} index={i} />
          ))}
        </Animated.View>

        <Animated.View style={[styles.hero, heroStyle]}>
          <View style={styles.logoWrapper}>
            <CirclequizLogo width={340} height={95} />
          </View>
          <Text style={styles.subtitle}>{t('home.subtitle', 'Challenge your friends!')}</Text>
        </Animated.View>

        <Animated.View style={[styles.avatarRow, styles.avatarRowBottom, bottomRowStyle]}>
          {BOTTOM_AVATARS.map((key, i) => (
            <BobAvatar key={key} avatarKey={key} size={56} index={i + TOP_AVATARS.length} />
          ))}
        </Animated.View>

        <Animated.View style={[styles.cta, ctaStyle]}>
          <ShineButton
            label={t('home.newGame')}
            color={colors.success}
            onPress={() => router.push('/setup')}
            style={styles.ctaButton}
          />
          {canResume && (
            <Button
              outlined
              label={t('home.resumeGame')}
              color={colors.primary}
              onPress={handleResume}
              style={styles.ctaButton}
            />
          )}
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    marginBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  screen: {
    flex: 1,
    flexDirection: 'column',
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
    paddingHorizontal: 14,
    gap: 8,
    justifyContent: 'center',
  },
  avatarRowBottom: {
    justifyContent: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cta: {
    paddingHorizontal: 22,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  ctaButton: {
    width: '100%',
  },
});
