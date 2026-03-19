import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useGameStore } from '../state/gameStore';

export function useQuitGame() {
  const { t } = useTranslation();
  const quitGame = useGameStore((s) => s.quitGame);
  const navigation = useNavigation();

  return () => {
    Alert.alert(t('game.quit.title'), t('game.quit.message'), [
      { text: t('game.quit.cancel'), style: 'cancel' },
      {
        text: t('game.quit.confirm'),
        style: 'destructive',
        onPress: () => {
          quitGame();
          navigation
            .getParent()
            ?.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'index' }] }));
        },
      },
    ]);
  };
}
