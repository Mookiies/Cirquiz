import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
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
  compact?: boolean;
  haptic?: 'strong' | 'light' | 'none';
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
  compact = false,
  haptic = 'none',
  style,
}: Props) {
  const handlePress = () => {
    if (haptic === 'strong') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (haptic === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        outlined
          ? [styles.outlined, { borderColor: color }, selected && { backgroundColor: color }]
          : { backgroundColor: color },
        compact && styles.compactBase,
        (disabled || loading) && styles.inactive,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor ?? colors.white} />
      ) : (
        <Text
          style={[
            styles.text,
            outlined ? styles.textOutlined : styles.textSolid,
            compact && styles.compactText,
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
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  outlined: {
    borderWidth: 2,
    paddingVertical: spacing.lg,
  },
  compactBase: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  inactive: { opacity: opacity.inactive },
  text: {},
  textSolid: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  textOutlined: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  compactText: { fontSize: fontSize.sm },
});
