import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radius } from '../theme';

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  loading?: boolean;
}

export function CategorySelector({ categories, value, onChange, loading }: Props) {
  const { t } = useTranslation();

  if (loading) return <ActivityIndicator style={{ marginVertical: spacing.md }} />;

  const anyOption = { id: undefined as unknown as string, name: t('common.anyCategory') };
  const sorted = [anyOption, ...[...categories].sort((a, b) => a.name.localeCompare(b.name))];
  return (
    <View>
      {sorted.map((cat) => {
        const active = value === cat.id;
        return (
          <TouchableOpacity
            key={cat.id ?? '__any__'}
            style={[styles.row, active && styles.rowActive]}
            onPress={() => onChange(cat.id)}
          >
            <Text style={[styles.text, active && styles.textActive]}>{cat.name}</Text>
            {active && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[14],
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceFaint,
  },
  rowActive: { backgroundColor: colors.primaryFaint, borderColor: colors.primary },
  text: { fontSize: fontSize.base, color: colors.text },
  textActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  check: { fontSize: fontSize.base, color: colors.primary, fontWeight: fontWeight.bold },
});
