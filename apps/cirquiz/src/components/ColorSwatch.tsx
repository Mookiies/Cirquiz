import { TouchableOpacity, StyleSheet } from 'react-native';
import { opacity } from '../theme';

interface Props {
  color: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}

export function ColorSwatch({ color, selected, disabled, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.swatch,
        { backgroundColor: color },
        selected && {
          borderWidth: 3,
          borderColor: 'rgba(255,255,255,0.65)',
        },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    />
  );
}

const styles = StyleSheet.create({
  swatch: { width: 30, height: 30, borderRadius: 15 },
  disabled: { opacity: opacity.disabled },
});
