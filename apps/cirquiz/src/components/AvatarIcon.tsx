import { StyleSheet, View, ViewStyle } from 'react-native';
import { getAvatar } from '../avatars';

interface Props {
  avatarKey: string;
  size?: number;
  style?: ViewStyle;
}

export function AvatarIcon({ avatarKey, size = 48, style }: Props) {
  const avatar = getAvatar(avatarKey);
  const { Component } = avatar;
  const iconSize = size * 1.25;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.color },
        style,
      ]}
    >
      <Component width={iconSize} height={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
