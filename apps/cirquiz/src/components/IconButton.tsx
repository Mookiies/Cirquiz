import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { colors } from '../theme';
import { usePressAnimation } from '../hooks/usePressAnimation';

interface Props {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
}

export function IconButton({ icon, onPress, color = colors.error, size = 24, style }: Props) {
  const { onPressIn, onPressOut, animatedStyle } = usePressAnimation({ scale: 0.9 });
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.button, style, animatedStyle]}>
        <Ionicons name={icon} size={size} color={color} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
