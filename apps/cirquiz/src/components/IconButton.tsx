import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { colors, fontSize, fontWeight } from '../theme';

interface Props {
  icon: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function IconButton({ icon, onPress, color = colors.error, style }: Props) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      <Text style={[styles.icon, { color }]}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
});
