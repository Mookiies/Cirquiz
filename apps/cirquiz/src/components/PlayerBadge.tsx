import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radius } from '../theme';

interface Props {
  name: string;
  color: string;
}

export function PlayerBadge({ name, color }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.name}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  name: {
    color: colors.white,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },
});
