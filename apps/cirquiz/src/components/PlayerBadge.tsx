import { StyleSheet, Text, View } from 'react-native';
import { AvatarIcon } from './AvatarIcon';
import { colors, spacing, fontSize, fontWeight, radius } from '../theme';

interface Props {
  name: string;
  color: string;
  avatarKey?: string;
}

export function PlayerBadge({ name, color, avatarKey }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      {avatarKey ? <AvatarIcon avatarKey={avatarKey} size={24} /> : null}
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
    gap: spacing.xs,
  },
  name: {
    color: colors.white,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },
});
