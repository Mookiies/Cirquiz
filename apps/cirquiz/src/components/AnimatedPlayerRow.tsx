import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { type AvatarKey } from '../avatars';
import { AvatarIcon } from './AvatarIcon';
import { IconButton } from './IconButton';
import { colors, fontSize, radius, spacing } from '../theme';

interface AnimatedPlayerRowProps {
  player: { name: string; avatar: AvatarKey };
  index: number;
  delay: number;
  nameError?: string;
  canRemove: boolean;
  onAvatarPress: () => void;
  onNameChange: (text: string) => void;
  onRemove: () => void;
}

export function AnimatedPlayerRow({
  player,
  index,
  delay,
  nameError,
  canRemove,
  onAvatarPress,
  onNameChange,
  onRemove,
}: AnimatedPlayerRowProps) {
  const { t } = useTranslation();
  const translateX = useSharedValue(-40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(delay, withSpring(0));
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [delay, opacity, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const borderColor = colors.playerPalette[index % 10];

  return (
    <Animated.View style={[styles.playerCard, { borderLeftColor: borderColor }, animStyle]}>
      <View style={styles.inputRow}>
        <Pressable onPress={onAvatarPress} style={styles.avatarButton}>
          <AvatarIcon avatarKey={player.avatar} size={48} />
        </Pressable>
        <TextInput
          style={[styles.input, styles.playerInput, nameError ? styles.inputError : null]}
          selectTextOnFocus
          placeholder={`${t('setup.playerName')} ${index + 1}`}
          value={player.name}
          onChangeText={onNameChange}
          maxLength={20}
        />
        {canRemove && <IconButton icon="✕" onPress={onRemove} />}
      </View>
      {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  playerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    marginBottom: spacing.sm,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playerInput: { flex: 1, marginBottom: 0 },
  avatarButton: { flexShrink: 0 },
  inputError: { borderColor: colors.error },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
});
