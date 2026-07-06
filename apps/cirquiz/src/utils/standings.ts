import { Player } from '../state/types';

export function getStanding(sorted: Player[], index: number): number {
  if (index === 0) return 1;
  const currentScore = sorted[index].cumulativeScore;
  const previousScore = sorted[index - 1].cumulativeScore;
  if (currentScore === previousScore) {
    return getStanding(sorted, index - 1);
  }
  return index + 1;
}
