import * as Haptics from 'expo-haptics';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface PressAnimationOptions {
  scale?: number;
  durationIn?: number;
  durationOut?: number;
  haptic?: 'strong' | 'light' | 'none';
}

export function usePressAnimation({
  scale = 0.97,
  durationIn = 80,
  durationOut = 120,
  haptic = 'none',
}: PressAnimationOptions = {}) {
  const scaleValue = useSharedValue(1);

  const onPressIn = () => {
    if (haptic === 'strong') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scaleValue.value = withTiming(scale, { duration: durationIn });
  };

  const onPressOut = () => {
    scaleValue.value = withTiming(1, { duration: durationOut });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return { onPressIn, onPressOut, animatedStyle };
}
