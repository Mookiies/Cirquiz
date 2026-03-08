import { StyleSheet, Text, View } from 'react-native';

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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  name: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
