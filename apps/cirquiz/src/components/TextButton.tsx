import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function TextButton({ label, onPress, color = colors.primary, style }: Props) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
