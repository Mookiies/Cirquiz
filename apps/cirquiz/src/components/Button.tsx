import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '../hooks/usePressAnimation';
import { colors, spacing, fontSize, fontWeight, radius, opacity } from '../theme';
import { darkenHex } from '../utils/color';

const SHADOW_DEPTH = 5;

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outlined' | 'raised' | 'text';
  color?: string;
  textColor?: string;
  accentColor?: string;
  selected?: boolean;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  adjustsFontSizeToFit?: boolean;
  fillHeight?: boolean;
  haptic?: 'strong' | 'light' | 'none';
  style?: ViewStyle;
  onLayout?: (e: LayoutChangeEvent) => void;
  children?: React.ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'solid',
  color = colors.primary,
  textColor,
  accentColor,
  selected = false,
  loading = false,
  disabled = false,
  compact = false,
  adjustsFontSizeToFit = false,
  fillHeight = false,
  haptic,
  style,
  onLayout,
  children,
}: Props) {
  const { onPressIn, onPressOut, animatedStyle } = usePressAnimation({
    haptic,
    mode: variant === 'raised' ? 'depth' : 'scale',
    scale: variant === 'text' ? 0.85 : 0.95,
  });

  const content = loading ? (
    <ActivityIndicator color={textColor ?? colors.white} />
  ) : (
    <Text
      numberOfLines={adjustsFontSizeToFit ? 1 : undefined}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={adjustsFontSizeToFit ? 0.7 : undefined}
      style={[
        styles.text,
        variant === 'outlined' ? styles.textOutlined : styles.textSolid,
        compact && styles.compactText,
        { color: textColor ?? (variant === 'outlined' && !selected ? colors.text : colors.white) },
      ]}
    >
      {label}
    </Text>
  );

  if (variant === 'raised') {
    const shadowColor = accentColor ?? darkenHex(color);
    return (
      <View style={style}>
        <Animated.View
          style={[(disabled || loading) && styles.inactive, { paddingBottom: SHADOW_DEPTH }]}
        >
          {!loading && <View style={[styles.underShadow, { backgroundColor: shadowColor }]} />}
          <Pressable
            style={styles.shinePressable}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onLayout={onLayout}
            disabled={disabled || loading}
          >
            <Animated.View
              style={[
                styles.base,
                styles.raisedBase,
                { backgroundColor: color },
                compact && styles.compactBase,
                animatedStyle,
              ]}
            >
              {content}
              {children}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  if (variant === 'text') {
    return (
      <Animated.View style={[(disabled || loading) && styles.inactive, animatedStyle, style]}>
        <Pressable
          style={styles.textButton}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={disabled || loading}
        >
          <Text style={[styles.textButtonLabel, { color: color }]}>{label}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[(disabled || loading) && styles.inactive, animatedStyle, style]}>
      <Pressable
        style={[
          styles.base,
          variant === 'outlined'
            ? [styles.outlined, { borderColor: color }, selected && { backgroundColor: color }]
            : { backgroundColor: color },
          compact && styles.compactBase,
          fillHeight && styles.fillHeight,
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  outlined: {
    borderWidth: 2,
    paddingVertical: spacing.lg,
  },
  compactBase: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  fillHeight: { flex: 1 },
  inactive: { opacity: opacity.inactive },
  shinePressable: { zIndex: 1 },
  raisedBase: { overflow: 'hidden' },
  underShadow: {
    position: 'absolute',
    top: SHADOW_DEPTH,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
  },
  text: {},
  textSolid: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  textOutlined: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  compactText: { fontSize: fontSize.sm },
  textButton: { alignItems: 'center', paddingVertical: spacing.md },
  textButtonLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
