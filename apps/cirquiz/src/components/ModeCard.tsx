import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '../hooks/usePressAnimation';
import { colors, fontSize, fontWeight, spacing } from '../theme';

interface ModeCardProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  active: boolean;
  onPress: () => void;
}

export function ModeCard({ icon, name, description, active, onPress }: ModeCardProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressAnimation({
    mode: 'scale',
    haptic: 'none',
  });

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.flex}>
      <Animated.View style={[styles.modeCard, active && styles.modeCardActive, animatedStyle]}>
        {icon}
        <Text style={styles.modeName}>{name}</Text>
        <Text style={styles.modeDesc}>{description}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modeCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  modeName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  modeDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
