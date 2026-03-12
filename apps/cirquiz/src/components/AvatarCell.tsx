import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { type AvatarKey } from '../avatars';
import { AvatarIcon } from './AvatarIcon';
import { usePressAnimation } from '../hooks/usePressAnimation';
import { radius } from '../theme';

interface AvatarCellProps {
  avatarDef: { key: AvatarKey; color: string };
  selected: boolean;
  taken: boolean;
  onPress: () => void;
}

export function AvatarCell({ avatarDef, selected, taken, onPress }: AvatarCellProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressAnimation({ mode: 'scale' });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={taken ? undefined : onPressIn}
      onPressOut={taken ? undefined : onPressOut}
      disabled={taken}
    >
      <Animated.View
        style={[
          styles.avatarCell,
          selected && {
            shadowColor: avatarDef.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 8,
          },
          taken && styles.avatarCellDisabled,
          taken ? undefined : animatedStyle,
        ]}
      >
        <AvatarIcon avatarKey={avatarDef.key} size={64} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarCell: {
    borderRadius: radius.lg,
  },
  avatarCellDisabled: {
    opacity: 0.3,
  },
});
