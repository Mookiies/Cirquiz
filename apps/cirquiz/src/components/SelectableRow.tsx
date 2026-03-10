import { Pressable, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, spacing, fontSize, fontWeight, radius } from '../theme';
import { usePressAnimation } from '../hooks/usePressAnimation';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function SelectableRow({ label, active, onPress }: Props) {
  const { onPressIn, onPressOut, animatedStyle } = usePressAnimation();
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.row, active && styles.rowActive, animatedStyle]}>
        <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceFaint,
  },
  rowActive: { backgroundColor: colors.primaryFaint, borderColor: colors.primary },
  text: { fontSize: fontSize.base, color: colors.text },
  textActive: { color: colors.primary },
  check: { fontSize: fontSize.base, color: colors.primary, fontWeight: fontWeight.bold },
});
