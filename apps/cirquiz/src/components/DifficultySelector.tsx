import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, fontWeight, radius } from '../theme';

type Difficulty = 'easy' | 'medium' | 'hard';

interface Props {
  value: Difficulty | undefined;
  onChange: (value: Difficulty | undefined) => void;
  style?: ViewStyle;
}

export function DifficultySelector({ value, onChange, style }: Props) {
  const { t } = useTranslation();

  const options: { label: string; value: Difficulty | undefined }[] = [
    { label: t('common.any'), value: undefined },
    { label: t('common.easy'), value: 'easy' },
    { label: t('common.medium'), value: 'medium' },
    { label: t('common.hard'), value: 'hard' },
  ];

  return (
    <View style={[styles.row, style]}>
      {options.map(({ label, value: optVal }) => {
        const active = value === optVal;
        return (
          <TouchableOpacity
            key={label}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onChange(optVal)}
          >
            <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    padding: spacing[10],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnActive: { backgroundColor: colors.difficulty, borderColor: colors.difficulty },
  text: { color: colors.textSecondary, fontSize: fontSize.md },
  textActive: { color: colors.white, fontWeight: fontWeight.semibold },
});
