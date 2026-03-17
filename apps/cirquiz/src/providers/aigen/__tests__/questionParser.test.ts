import { TriviaProviderError, TriviaProviderErrorCode } from '../../types';
import { parse } from '../questionParser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Record<string, unknown> = {}) {
  return {
    question: 'What is 2 + 2?',
    type: 'multiple-choice',
    correct_answer: '4',
    incorrect_answers: ['1', '2', '3'],
    difficulty: 'easy',
    ...overrides,
  };
}

function makeJson(items: unknown[]): string {
  return JSON.stringify({ questions: items });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('questionParser.parse', () => {
  describe('valid input', () => {
    it('returns correctly shaped Question[] from valid multiple-choice input', () => {
      const json = makeJson([makeRaw()]);
      const questions = parse(json, 1);
      expect(questions).toHaveLength(1);
      const q = questions[0];
      expect(q.text).toBe('What is 2 + 2?');
      expect(q.type).toBe('multiple-choice');
      expect(q.correctAnswer).toBe('4');
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain('4');
      expect(q.options).toContain('1');
    });

    it('returns correctly shaped Question for true-false type', () => {
      const json = makeJson([
        makeRaw({ type: 'true-false', correct_answer: 'True', incorrect_answers: ['False'] }),
      ]);
      const questions = parse(json, 1);
      expect(questions[0].type).toBe('true-false');
      expect(questions[0].options).toHaveLength(2);
    });

    it('assigns an id string to each question', () => {
      const json = makeJson([makeRaw()]);
      const [q] = parse(json, 1);
      expect(typeof q.id).toBe('string');
      expect(q.id.length).toBeGreaterThan(0);
    });
  });

  describe('discarding invalid items', () => {
    it('discards items with empty question text', () => {
      const json = makeJson([makeRaw({ question: '' }), makeRaw()]);
      const questions = parse(json, 1);
      expect(questions).toHaveLength(1);
    });

    it('discards items with question longer than 300 characters', () => {
      const json = makeJson([makeRaw({ question: 'a'.repeat(301) }), makeRaw()]);
      const questions = parse(json, 1);
      expect(questions).toHaveLength(1);
    });

    it('discards items with invalid type', () => {
      const json = makeJson([makeRaw({ type: 'fill-in-the-blank' }), makeRaw()]);
      const questions = parse(json, 1);
      expect(questions).toHaveLength(1);
    });

    it('discards multiple-choice items with wrong number of incorrect answers', () => {
      const json = makeJson([
        makeRaw({ type: 'multiple-choice', incorrect_answers: ['1', '2'] }), // only 2
        makeRaw(),
      ]);
      const questions = parse(json, 1);
      expect(questions).toHaveLength(1);
    });

    it('discards true-false items with wrong number of incorrect answers', () => {
      const json = makeJson([
        makeRaw({ type: 'true-false', incorrect_answers: ['False', 'Maybe'] }), // 2 instead of 1
        makeRaw({ type: 'true-false', correct_answer: 'True', incorrect_answers: ['False'] }),
      ]);
      const questions = parse(json, 1);
      expect(questions).toHaveLength(1);
    });

    it('discards items with duplicate answer text', () => {
      const json = makeJson([
        makeRaw({ correct_answer: 'A', incorrect_answers: ['A', 'B', 'C'] }),
        makeRaw(),
      ]);
      const questions = parse(json, 1);
      expect(questions).toHaveLength(1);
    });
  });

  describe('insufficient results', () => {
    it('returns available questions when valid count < requestedCount', () => {
      const json = makeJson([makeRaw()]);
      const questions = parse(json, 5);
      expect(questions).toHaveLength(1);
    });

    it('throws TriviaProviderError(NoResults) when no valid questions exist', () => {
      const json = makeJson([makeRaw({ question: '' })]);
      expect(() => parse(json, 1)).toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NoResults })
      );
    });

    it('throws TriviaProviderError instance when insufficient', () => {
      const json = makeJson([]);
      expect(() => parse(json, 1)).toBeInstanceOf(Function); // guard
      expect(() => parse(json, 1)).toThrow(TriviaProviderError);
    });
  });

  describe('malformed JSON', () => {
    it('throws TriviaProviderError(NoResults) for non-JSON input', () => {
      expect(() => parse('not json', 1)).toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NoResults })
      );
    });

    it('throws TriviaProviderError(NoResults) when root has no questions array', () => {
      expect(() => parse('{"question":"x"}', 1)).toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NoResults })
      );
    });
  });
});
