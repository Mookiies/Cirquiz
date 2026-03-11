import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '../hooks/usePressAnimation';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme';

interface ChipButtonProps {
  label: string | number;
  active: boolean;
  onPress: () => void;
}

export function ChipButton({ label, active, onPress }: ChipButtonProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressAnimation({ mode: 'scale', scale: 0.9 });

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.chip, active && styles.chipActive, animatedStyle]}>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  chipText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
  },
});
