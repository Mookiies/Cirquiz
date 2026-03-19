import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { GradientScreen } from '../src/components/GradientScreen';
import { IconButton } from '../src/components/IconButton';
import { ShineButton } from '../src/components/ShineButton';
import { useGameStore } from '../src/state/gameStore';
import { colors, fontSize, spacing } from '../src/theme';
import CircleQLogo from '../assets/circleq-wordmark.svg';

const DOT_COLORS = [
  colors.playerPalette.blue,
  colors.playerPalette.purple,
  colors.playerPalette.green,
  colors.playerPalette.orange,
  colors.playerPalette.red,
];

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

export default function HomeScreen() {
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
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ctaTranslateY.value }],
    opacity: ctaOpacity.value,
  }));
  const lastBackPress = useRef<number>(0);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (router.canGoBack()) return false;
        const now = Date.now();
        if (now - lastBackPress.current < 2000) return false;
        lastBackPress.current = now;
        ToastAndroid.show(t('home.pressBackToExit'), ToastAndroid.SHORT);
        return true;
      });
      return () => subscription.remove();
    }, [t])
  );

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
      <GradientScreen>
        <View style={styles.loadingContainer}>
          <View style={styles.logoWrapper}>
            <CircleQLogo />
          </View>
          <View style={styles.dotsRow}>
            {DOT_COLORS.map((color, i) => (
              <LoadingDot key={i} color={color} index={i} />
            ))}
          </View>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <IconButton
            icon="settings-outline"
            onPress={() => router.push('/settings')}
            color={colors.text}
          />
        </View>
        <Animated.View style={[styles.hero, heroStyle]}>
          <View style={styles.logoWrapper}>
            <CircleQLogo width={340} height={95} />
          </View>
          <Text style={styles.subtitle}>{t('home.subtitle', 'Challenge your friends!')}</Text>
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
              variant="outlined"
              label={t('home.resumeGame')}
              color={colors.primary}
              onPress={handleResume}
              style={styles.ctaButton}
            />
          )}
        </Animated.View>
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
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
  topBar: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
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
