import { router, Stack, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../../src/state/gameStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

    const backgroundColor = showPlayerColor && currentPlayer.color ? currentPlayer.color : '#fff';
    const quitColor = showPlayerColor && currentPlayer.color ? '#fff' : '#222';
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
            <Text style={styles.bannerText}>{currentPlayer.name}</Text>
          </View>
        )}
        {showQuit && (
          <TouchableOpacity onPress={handleQuit} style={[styles.banner, styles.quitButton]}>
            <Text style={[styles.quitText, { color: quitColor }]}>{t('game.quit.confirm')}</Text>
          </TouchableOpacity>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  bannerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  header: { alignItems: 'center', flexDirection: 'row' },
  quitButton: { marginLeft: 'auto' },
  quitText: { fontSize: 15, fontWeight: '600' },
});
