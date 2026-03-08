import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ViewStyle } from 'react-native';

type Difficulty = 'easy' | 'medium' | 'hard';

interface Props {
  value: Difficulty | undefined;
  onChange: (value: Difficulty | undefined) => void;
  style?: ViewStyle;
}

const OPTIONS: { label: string; value: Difficulty | undefined }[] = [
  { label: 'Any', value: undefined },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
];

export function DifficultySelector({ value, onChange, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {OPTIONS.map(({ label, value: optVal }) => {
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
