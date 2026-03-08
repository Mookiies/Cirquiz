import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { ViewStyle } from 'react-native';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  outlined?: boolean;
  selected?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  color = '#3498DB',
  textColor,
  outlined = false,
  selected = false,
  loading = false,
  disabled = false,
  style,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        outlined
          ? [styles.outlined, { borderColor: color }, selected && { backgroundColor: color }]
          : { backgroundColor: color },
        (disabled || loading) && styles.inactive,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor ?? '#fff'} />
      ) : (
        <Text
          style={[
            styles.text,
            outlined ? styles.textOutlined : styles.textSolid,
            { color: textColor ?? (outlined && !selected ? '#333' : '#fff') },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  outlined: {
    borderWidth: 2,
    paddingVertical: 16,
  },
  inactive: { opacity: 0.5 },
  text: {},
  textSolid: { fontSize: 18, fontWeight: '700' },
  textOutlined: { fontSize: 16, fontWeight: '600' },
});
