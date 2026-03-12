import * as Haptics from 'expo-haptics';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface PressAnimationOptions {
  scale?: number;
  depth?: number;
  durationIn?: number;
  durationOut?: number;
  haptic?: 'strong' | 'light' | 'none';
  mode?: 'scale' | 'depth';
}

export function usePressAnimation({
  scale = 0.92,
  depth = 5,
  durationIn = 80,
  durationOut = 120,
  haptic = 'light',
  mode = 'scale',
}: PressAnimationOptions = {}) {
  const pressValue = useSharedValue(mode === 'scale' ? 1 : 0);

  const onPressIn = () => {
    if (haptic === 'strong') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pressValue.value = withTiming(mode === 'scale' ? scale : depth, { duration: durationIn });
  };

  const onPressOut = () => {
    pressValue.value = withTiming(mode === 'scale' ? 1 : 0, { duration: durationOut });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform:
      mode === 'scale' ? [{ scale: pressValue.value }] : [{ translateY: pressValue.value }],
  }));

  return { onPressIn, onPressOut, animatedStyle };
}
