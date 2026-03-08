import { router, Stack, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../../src/state/gameStore';

const SHOW_BANNER_ON = ['handoff', 'question', 'reveal'];
const SHOW_QUIT_ON = ['handoff', 'question', 'reveal', 'error'];

export default function GameLayout() {
  const { t } = useTranslation();
  const game = useGameStore((s) => s.game);
  const quitGame = useGameStore((s) => s.quitGame);
  const pathname = usePathname();

  const screenName = pathname.split('/').pop() ?? '';
  const showBanner = SHOW_BANNER_ON.includes(screenName);
  const showQuit = SHOW_QUIT_ON.includes(screenName);

  const currentRound = game ? game.rounds[game.currentRoundIndex] : null;
  const currentPlayer = game && currentRound ? game.players[currentRound.currentPlayerIndex] : null;

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

  return (
    <View style={styles.container}>
      {showBanner && currentPlayer && (
        <View style={[styles.banner, { backgroundColor: currentPlayer.color }]}>
          <Text style={styles.bannerText}>{currentPlayer.name}</Text>
        </View>
      )}
      <Stack
        screenOptions={{
          headerShown: showQuit,
          headerTitle: '',
          headerRight: showQuit
            ? () => (
                <TouchableOpacity onPress={handleQuit} style={styles.quitButton}>
                  <Text style={styles.quitText}>{t('game.quit.confirm')}</Text>
                </TouchableOpacity>
              )
            : undefined,
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
    alignItems: 'center',
  },
  bannerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  quitButton: { marginRight: 8 },
  quitText: { color: '#E74C3C', fontSize: 15, fontWeight: '600' },
});
