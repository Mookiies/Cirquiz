import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

const ANY_OPTION = { id: undefined as unknown as string, name: 'Any Category' };

export function CategorySelector({ categories, value, onChange, loading }: Props) {
  if (loading) return <ActivityIndicator style={{ marginVertical: 12 }} />;

  const sorted = [ANY_OPTION, ...[...categories].sort((a, b) => a.name.localeCompare(b.name))];
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  rowActive: { backgroundColor: '#EBF5FB', borderColor: '#3498DB' },
  text: { fontSize: 15, color: '#333' },
  textActive: { color: '#3498DB', fontWeight: '600' },
  check: { fontSize: 16, color: '#3498DB', fontWeight: '700' },
});
