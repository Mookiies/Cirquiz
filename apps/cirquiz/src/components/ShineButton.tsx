import { useEffect, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from './Button';
import { colors } from '../theme';

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

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  return (
    <Button
      raised
      label={label}
      onPress={onPress}
      color={color}
      disabled={disabled}
      loading={loading}
      haptic={haptic}
      style={style}
      onLayout={handleLayout}
    >
      <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Button>
  );
}

const styles = StyleSheet.create({
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    transform: [{ skewX: '-15deg' }],
  },
});
