import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Keyframe, LinearTransition } from 'react-native-reanimated';
import { AVATAR_MAP, type AvatarKey } from '../avatars';
import { AvatarIcon } from './AvatarIcon';
import { IconButton } from './IconButton';
import { usePressAnimation } from '../hooks/usePressAnimation';
import { colors, fontSize, radius, spacing } from '../theme';

const exitAnim = new Keyframe({
  from: { opacity: 1, transform: [{ translateX: 0 }] },
  to: { opacity: 0, transform: [{ translateX: -40 }] },
}).duration(200);

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

  const enterAnim = new Keyframe({
    from: { opacity: 0, transform: [{ translateX: -40 }] },
    to: { opacity: 1, transform: [{ translateX: 0 }] },
  })
    .duration(300)
    .delay(delay);

  const borderColor = AVATAR_MAP[player.avatar].color;
  const {
    onPressIn: avatarPressIn,
    onPressOut: avatarPressOut,
    animatedStyle: avatarAnimStyle,
  } = usePressAnimation({ mode: 'scale' });

  return (
    <Animated.View
      entering={enterAnim}
      exiting={exitAnim}
      layout={LinearTransition}
      style={[styles.playerCard, { borderLeftColor: borderColor }]}
    >
      <View style={styles.inputRow}>
        <Pressable
          onPress={onAvatarPress}
          onPressIn={avatarPressIn}
          onPressOut={avatarPressOut}
          style={styles.avatarButton}
        >
          <Animated.View style={avatarAnimStyle}>
            <AvatarIcon avatarKey={player.avatar} size={48} />
          </Animated.View>
        </Pressable>
        <TextInput
          style={[styles.input, styles.playerInput, nameError ? styles.inputError : null]}
          selectTextOnFocus
          placeholder={`${t('setup.playerName')} ${index + 1}`}
          value={player.name}
          onChangeText={onNameChange}
          maxLength={20}
        />
        {canRemove && <IconButton icon="close" onPress={onRemove} size={32} />}
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
