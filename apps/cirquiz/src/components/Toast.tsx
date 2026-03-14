import Animated from 'react-native-reanimated';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Toast({
  toastMessage,
  toastStyle,
}: {
  toastMessage: string;
  toastStyle: ViewStyle;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      style={[styles.toast, { marginBottom: insets.bottom }, toastStyle]}
      pointerEvents="none"
    >
      <Text style={styles.toastText}>{toastMessage}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 0,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  toastText: {
    color: colors.white,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
});
