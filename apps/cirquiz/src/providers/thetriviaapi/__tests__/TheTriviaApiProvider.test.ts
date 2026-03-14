import { TheTriviaApiProvider } from '../TheTriviaApiProvider';
import { TriviaProviderErrorCode } from '../../types';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const makeTriviaApiQuestion = (overrides = {}) => ({
  id: '622a1c3d7fce235dd0f05b61',
  category: 'general_knowledge',
  difficulty: 'easy' as const,
  correctAnswer: 'Paris',
  incorrectAnswers: ['London', 'Berlin', 'Rome'],
  question: { text: 'What is the capital of France?' },
  type: 'text_choice',
  tags: [],
  regions: [],
  isNiche: false,
  ...overrides,
});

describe('TheTriviaApiProvider', () => {
  let provider: TheTriviaApiProvider;

  beforeEach(() => {
    provider = new TheTriviaApiProvider();
    mockFetch.mockClear();
  });

  // ─── fetchQuestions ───────────────────────────────────────────────────────

  describe('fetchQuestions', () => {
    it('fetches from the correct URL with limit param', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [makeTriviaApiQuestion()],
      });
      await provider.fetchQuestions({ count: 5 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=5'));
    });

    it('includes categories param when category is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [makeTriviaApiQuestion()],
      });
      await provider.fetchQuestions({ count: 5, category: 'science' });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('categories=science'));
    });

    it('includes difficulties param when difficulty is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [makeTriviaApiQuestion()],
      });
      await provider.fetchQuestions({ count: 5, difficulty: 'hard' });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('difficulties=hard'));
    });

    it('maps response fields to Question shape correctly', async () => {
      const apiQ = makeTriviaApiQuestion();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [apiQ],
      });
      const questions = await provider.fetchQuestions({ count: 1 });
      expect(questions).toHaveLength(1);
      const q = questions[0];
      expect(q.id).toBe(apiQ.id);
      expect(q.text).toBe(apiQ.question.text);
      expect(q.correctAnswer).toBe(apiQ.correctAnswer);
      expect(q.type).toBe('multiple-choice');
      expect(q.category).toBe('General Knowledge');
      expect(q.difficulty).toBe(apiQ.difficulty);
      expect(q.options).toContain(apiQ.correctAnswer);
      apiQ.incorrectAnswers.forEach((a) => expect(q.options).toContain(a));
      expect(q.options).toHaveLength(4);
    });

    it('throws NetworkError when fetch response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      await expect(provider.fetchQuestions({ count: 5 })).rejects.toMatchObject({
        code: TriviaProviderErrorCode.NetworkError,
      });
    });

    it('throws NetworkError when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      await expect(provider.fetchQuestions({ count: 5 })).rejects.toMatchObject({
        code: TriviaProviderErrorCode.NetworkError,
      });
    });

    it('throws NoResults when response is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      await expect(provider.fetchQuestions({ count: 5 })).rejects.toMatchObject({
        code: TriviaProviderErrorCode.NoResults,
      });
    });
  });

  // ─── fetchCategories ──────────────────────────────────────────────────────

  describe('fetchCategories', () => {
    it('returns exactly 10 categories', async () => {
      const cats = await provider.fetchCategories();
      expect(cats).toHaveLength(10);
    });

    it('returns all expected category slugs', async () => {
      const cats = await provider.fetchCategories();
      const ids = cats.map((c) => c.id);
      expect(ids).toContain('arts_and_literature');
      expect(ids).toContain('general_knowledge');
      expect(ids).toContain('sport_and_leisure');
    });

    it('makes no network call', async () => {
      await provider.fetchCategories();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ─── supportsCategories ───────────────────────────────────────────────────

  describe('supportsCategories', () => {
    it('returns true', () => {
      expect(provider.supportsCategories()).toBe(true);
    });
  });

  // ─── supportsDifficulty ───────────────────────────────────────────────────

  describe('supportsDifficulty', () => {
    it('returns true', () => {
      expect(provider.supportsDifficulty()).toBe(true);
    });
  });

  // ─── resetSession ─────────────────────────────────────────────────────────

  describe('resetSession', () => {
    it('is a no-op and does not throw', () => {
      expect(() => provider.resetSession()).not.toThrow();
    });
  });
});
