import { useGameStore } from '../state/gameStore';
import { Question } from '../providers/types';

export function useCurrentQuestion(): Question | null {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const round = game.rounds[game.currentRoundIndex];
  if (!round) return null;
  return round.questions[round.currentQuestionIndex] ?? null;
}
