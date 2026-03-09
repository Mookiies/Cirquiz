import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radius } from '../theme';

interface Props {
  name: string;
  color: string;
  score: number;
  label?: string;
}

export function ScoreRow({ name, color, score, label }: Props) {
  return (
    <View style={[styles.row, { borderLeftColor: color }]}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.score}>
        {label ? `${label}: ` : ''}
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  score: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary },
});
