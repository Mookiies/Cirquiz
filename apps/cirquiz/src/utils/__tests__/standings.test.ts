import { getStanding } from '../standings';
import { Player } from '../../state/types';

function makePlayers(scores: number[]): Player[] {
  return scores.map((score, i) => ({
    id: String(i),
    name: `Player ${i}`,
    avatar: 'cat',
    color: '#000',
    roundScore: 0,
    cumulativeScore: score,
  }));
}

describe('getStanding', () => {
  it('first place is always 1', () => {
    const players = makePlayers([100, 80, 60]);
    expect(getStanding(players, 0)).toBe(1);
  });

  it('unique scores produce sequential standings', () => {
    const players = makePlayers([100, 80, 60, 40, 20]);
    expect(getStanding(players, 0)).toBe(1);
    expect(getStanding(players, 1)).toBe(2);
    expect(getStanding(players, 2)).toBe(3);
    expect(getStanding(players, 3)).toBe(4);
    expect(getStanding(players, 4)).toBe(5);
  });

  it('tied scores share the same standing (1st, 1st, 3rd)', () => {
    const players = makePlayers([100, 100, 80]);
    expect(getStanding(players, 0)).toBe(1);
    expect(getStanding(players, 1)).toBe(1);
    expect(getStanding(players, 2)).toBe(3);
  });

  it('1st, 1st, 3rd, 3rd, 5th, 6th', () => {
    const players = makePlayers([100, 100, 80, 80, 60, 40]);
    expect(getStanding(players, 0)).toBe(1);
    expect(getStanding(players, 1)).toBe(1);
    expect(getStanding(players, 2)).toBe(3);
    expect(getStanding(players, 3)).toBe(3);
    expect(getStanding(players, 4)).toBe(5);
    expect(getStanding(players, 5)).toBe(6);
  });

  it('1st, 1st, 3rd, 3rd, 5th, 6th, 7th, 7th, 9th', () => {
    const players = makePlayers([100, 100, 80, 80, 60, 40, 20, 20, 9]);
    expect(getStanding(players, 0)).toBe(1);
    expect(getStanding(players, 1)).toBe(1);
    expect(getStanding(players, 2)).toBe(3);
    expect(getStanding(players, 3)).toBe(3);
    expect(getStanding(players, 4)).toBe(5);
    expect(getStanding(players, 5)).toBe(6);
    expect(getStanding(players, 6)).toBe(7);
    expect(getStanding(players, 7)).toBe(7);
    expect(getStanding(players, 8)).toBe(9);
  });

  it('all players tied returns 1st for all', () => {
    const players = makePlayers([50, 50, 50]);
    expect(getStanding(players, 0)).toBe(1);
    expect(getStanding(players, 1)).toBe(1);
    expect(getStanding(players, 2)).toBe(1);
  });

  it('single player is 1st', () => {
    const players = makePlayers([42]);
    expect(getStanding(players, 0)).toBe(1);
  });
});
