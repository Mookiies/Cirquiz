import { useGameStore } from '../state/gameStore';

export function useGame() {
  const game = useGameStore((s) => s.game);
  const isHydrated = useGameStore((s) => s.isHydrated);
  const isLoading = useGameStore((s) => s.isLoading);
  return { game, isHydrated, isLoading };
}
