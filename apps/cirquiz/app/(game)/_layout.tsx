import { router, Stack, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../../src/state/gameStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, fontWeight } from '../../src/theme';
import { TextButton } from '../../src/components/TextButton';
import { AvatarIcon } from '../../src/components/AvatarIcon';

const SHOW_PLAYER_BANNER_ON = ['question'];
const SHOW_PLAYER_COLOR = ['handoff', 'question'];
const SHOW_QUIT_ON = ['handoff', 'question', 'reveal', 'error'];

export default function GameLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const quitGame = useGameStore((s) => s.quitGame);
  const pathname = usePathname();

  const currentRound = game ? game.rounds[game.currentRoundIndex] : null;
  const currentPlayer = game && currentRound ? game.players[currentRound.currentPlayerIndex] : null;

  const screenName = pathname.split('/').pop() ?? '';
  const showPlayerName = SHOW_PLAYER_BANNER_ON.includes(screenName) && !!currentPlayer;
  const showPlayerColor = SHOW_PLAYER_COLOR.includes(screenName) && !!currentPlayer;
  const showQuit = SHOW_QUIT_ON.includes(screenName);

  const handleQuit = () => {
    Alert.alert(t('game.quit.title'), t('game.quit.message'), [
      { text: t('game.quit.cancel'), style: 'cancel' },
      {
        text: t('game.quit.confirm'),
        style: 'destructive',
        onPress: () => {
          quitGame();
          router.replace('/');
        },
      },
    ]);
  };

  const showHeader = showPlayerName || showQuit;

  const header = () => {
    if (!showHeader) return null;

    const backgroundColor =
      showPlayerColor && currentPlayer.color ? currentPlayer.color : colors.background;
    const quitColor = showPlayerColor && currentPlayer.color ? colors.white : colors.text;
    return (
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor,
          },
        ]}
      >
        {showPlayerName && currentPlayer && (
          <View
            style={[styles.banner, { backgroundColor: currentPlayer.color, alignSelf: 'center' }]}
          >
            <AvatarIcon avatarKey={currentPlayer.avatar} size={32} />
            <Text style={styles.bannerText} numberOfLines={1}>
              {currentPlayer.name}
            </Text>
          </View>
        )}
        {showQuit && (
          <TextButton
            label={t('game.quit.confirm')}
            onPress={handleQuit}
            color={quitColor}
            style={styles.quitButton}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          header,
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  header: { alignItems: 'center', flexDirection: 'row' },
  quitButton: { marginLeft: 'auto' },
});
