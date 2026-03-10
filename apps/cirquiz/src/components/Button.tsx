import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '../hooks/usePressAnimation';
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
  const { onPressIn, onPressOut, animatedStyle } = usePressAnimation({ haptic });

  return (
    <Animated.View style={[(disabled || loading) && styles.inactive, animatedStyle, style]}>
      <Pressable
        style={[
          styles.base,
          outlined
            ? [styles.outlined, { borderColor: color }, selected && { backgroundColor: color }]
            : { backgroundColor: color },
          compact && styles.compactBase,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
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
      </Pressable>
    </Animated.View>
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
