import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../theme';
import { Button } from './Button';

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
          <Button
            key={label}
            outlined
            compact
            selected={active}
            color={colors.difficulty}
            label={label}
            onPress={() => onChange(optVal)}
            style={{ flex: 1 }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
});
