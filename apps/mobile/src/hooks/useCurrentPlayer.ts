import { useGameStore } from '../state/gameStore';
import { Player } from '../state/types';

export function useCurrentPlayer(): Player | null {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const round = game.rounds[game.currentRoundIndex];
  if (!round) return null;
  return game.players[round.currentPlayerIndex] ?? null;
}
