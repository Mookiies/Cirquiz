import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing } from '../theme';
import { AvatarIcon } from './AvatarIcon';
import { Button } from './Button';
import { IconButton } from './IconButton';

interface GameHeaderProps {
  variant: 'player' | 'transparent';
  player?: { avatar: string; name: string; color: string };
  onQuit?: () => void;
  onBack?: () => void;
  quitTextColor?: string;
}

export function GameHeader({ variant, player, onQuit, onBack, quitTextColor }: GameHeaderProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const backgroundColor = variant === 'player' && player ? player.color : 'transparent';
  const defaultQuitColor = variant === 'player' ? colors.white : colors.text;
  const quitColor = quitTextColor || defaultQuitColor;

  return (
    <View style={[styles.header, { paddingTop: insets.top, backgroundColor }]}>
      {onBack && (
        <IconButton
          icon="arrow-back"
          onPress={onBack}
          color={colors.text}
          style={styles.backButton}
        />
      )}
      {variant === 'player' && player && (
        <View style={[styles.banner, { backgroundColor: player.color }]}>
          <AvatarIcon avatarKey={player.avatar} size={32} />
          <Text style={styles.bannerText} numberOfLines={1}>
            {player.name}
          </Text>
        </View>
      )}
      {onQuit && (
        <Button
          variant="text"
          label={t('game.quit.confirm')}
          onPress={onQuit}
          color={quitColor}
          style={styles.quitButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', backgroundColor: 'transparent' },
  banner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bannerText: {
    color: colors.white,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.base,
  },
  backButton: { marginLeft: spacing.lg },
  quitButton: { marginLeft: 'auto', paddingRight: spacing.xl },
});
