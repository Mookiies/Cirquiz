import { StyleSheet, Text, View } from 'react-native';

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
      <Text style={styles.score}>{label ? `${label}: ` : ''}{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
    marginBottom: 6,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#222' },
  score: { fontSize: 16, fontWeight: '700', color: '#3498DB' },
});
