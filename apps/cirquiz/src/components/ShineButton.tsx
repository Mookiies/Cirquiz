import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, fontWeight, spacing } from '../theme';

const SHADOW_DEPTH = 5;

function darkenHex(hex: string, amount = 0.18): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  haptic?: 'strong' | 'light' | 'none';
  style?: ViewStyle;
}

export function ShineButton({
  label,
  onPress,
  color = colors.primary,
  disabled,
  loading,
  haptic = 'strong',
  style,
}: Props) {
  const shineX = useSharedValue(-1);
  const pressY = useSharedValue(0);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    shineX.value = withRepeat(
      withSequence(
        withDelay(2000, withTiming(1.4, { duration: 1200 })),
        withTiming(-1.4, { duration: 0 })
      ),
      -1
    );
  }, [shineX]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shineX.value * width }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressY.value }],
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const handlePressIn = () => {
    if (haptic === 'strong') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (haptic === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    pressY.value = withTiming(SHADOW_DEPTH, { duration: 80 });
  };

  const handlePressOut = () => {
    pressY.value = withTiming(0, { duration: 120 });
  };

  const shadowColor = darkenHex(color);

  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: disabled || loading ? 0.5 : 1,
  }));

  return (
    <Animated.View style={[styles.wrapper, inactiveStyle, style]}>
      {/* Shadow strip — absolutely positioned in the bottom padding area only */}
      {!loading && <View style={[styles.underShadow, { backgroundColor: shadowColor }]} />}
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={handleLayout}
        disabled={disabled || loading}
      >
        <Animated.View style={[styles.button, { backgroundColor: color }, pressStyle]}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.label}>{label}</Text>
          )}
          <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: SHADOW_DEPTH,
  },
  underShadow: {
    position: 'absolute',
    top: SHADOW_DEPTH,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
  pressable: {
    zIndex: 1,
  },
  button: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  label: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    transform: [{ skewX: '-15deg' }],
  },
});
