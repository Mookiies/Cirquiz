import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { ViewStyle } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radius, opacity } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  outlined?: boolean;
  selected?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  color = colors.primary,
  textColor,
  outlined = false,
  selected = false,
  loading = false,
  disabled = false,
  style,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        outlined
          ? [styles.outlined, { borderColor: color }, selected && { backgroundColor: color }]
          : { backgroundColor: color },
        (disabled || loading) && styles.inactive,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor ?? colors.white} />
      ) : (
        <Text
          style={[
            styles.text,
            outlined ? styles.textOutlined : styles.textSolid,
            { color: textColor ?? (outlined && !selected ? colors.text : colors.white) },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing[18],
    paddingHorizontal: spacing.lg,
  },
  outlined: {
    borderWidth: 2,
    paddingVertical: spacing.lg,
  },
  inactive: { opacity: opacity.inactive },
  text: {},
  textSolid: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  textOutlined: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
