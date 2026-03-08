import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  btnActive: { backgroundColor: '#9B59B6', borderColor: '#9B59B6' },
  text: { color: '#555', fontSize: 14 },
  textActive: { color: '#fff' },
});
