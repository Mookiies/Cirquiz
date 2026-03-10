import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useGameStore } from '../state/gameStore';

export function useQuitGame() {
  const { t } = useTranslation();
  const quitGame = useGameStore((s) => s.quitGame);

  return () => {
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
}
