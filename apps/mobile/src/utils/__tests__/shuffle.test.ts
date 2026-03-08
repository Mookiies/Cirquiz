import { shuffle } from '../shuffle';

describe('shuffle', () => {
  it('returns same-length array', () => {
    expect(shuffle([1, 2, 3, 4])).toHaveLength(4);
  });

  it('contains all original elements', () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);
    expect([...result].sort()).toEqual([...original].sort());
  });

  it('does not mutate the input array', () => {
    const original = [1, 2, 3, 4];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  it('returns a new array reference', () => {
    const original = [1, 2, 3];
    expect(shuffle(original)).not.toBe(original);
  });

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single-element array', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('produces deterministic permutation with mocked Math.random', () => {
    // Math.random always returns 0 → j=0 each iteration → reverse sort
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = shuffle([1, 2, 3, 4]);
    spy.mockRestore();
    // With random=0: j=floor(0*(i+1))=0 always, so each element swaps with index 0
    // i=3: swap [3] with [0] → [4,2,3,1]
    // i=2: swap [2] with [0] → [3,2,4,1]
    // i=1: swap [1] with [0] → [2,3,4,1]
    expect(result).toEqual([2, 3, 4, 1]);
  });
});
