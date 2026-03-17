import { TriviaProviderErrorCode } from '../../types';
import { AIQuestionProvider } from '../AIQuestionProvider';

// ─── Mock modelStore ───────────────────────────────────────────────────────────

const mockGetContext = jest.fn();

jest.mock('../../../state/modelStore', () => ({
  useModelStore: {
    getState: () => ({ getContext: mockGetContext }),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeValidFixture(count = 1): string {
  const items = Array.from({ length: count }, (_, i) => ({
    question: `Question ${i + 1}?`,
    type: 'multiple-choice',
    correct_answer: `Answer ${i + 1}`,
    incorrect_answers: [`Wrong A${i}`, `Wrong B${i}`, `Wrong C${i}`],
  }));
  return JSON.stringify(items);
}

function makeMockContext(responseText: string, interrupted = false) {
  return {
    completion: jest.fn().mockResolvedValue({
      text: responseText,
      interrupted,
    }),
    stopCompletion: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('AIQuestionProvider', () => {
  let provider: AIQuestionProvider;

  beforeEach(() => {
    provider = new AIQuestionProvider();
    mockGetContext.mockReset();
  });

  describe('fetchQuestions — success path', () => {
    it('returns Question[] of the correct length', async () => {
      const ctx = makeMockContext(makeValidFixture(3));
      mockGetContext.mockReturnValue(ctx);

      const questions = await provider.fetchQuestions({
        count: 3,
        topicPrompt: 'Ancient Rome',
      });

      expect(questions).toHaveLength(3);
    });

    it('calls context.completion with messages format (not prompt)', async () => {
      const ctx = makeMockContext(makeValidFixture(1));
      mockGetContext.mockReturnValue(ctx);

      await provider.fetchQuestions({ count: 1, topicPrompt: 'Science' });

      expect(ctx.completion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
      expect(ctx.completion).not.toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.anything() })
      );
    });
  });

  describe('fetchQuestions — insufficient questions', () => {
    it('throws TriviaProviderError(NoResults) when fixture has too few valid items', async () => {
      // Fixture has 1 valid item but 3 requested
      const ctx = makeMockContext(makeValidFixture(1));
      mockGetContext.mockReturnValue(ctx);

      await expect(provider.fetchQuestions({ count: 3, topicPrompt: 'History' })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NoResults })
      );
    });
  });

  describe('fetchQuestions — null context', () => {
    it('throws TriviaProviderError(ProviderError) when context is null', async () => {
      mockGetContext.mockReturnValue(null);

      await expect(provider.fetchQuestions({ count: 1, topicPrompt: 'Geography' })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.ProviderError })
      );
    });
  });

  describe('fetchQuestions — invalid params', () => {
    it('throws TriviaProviderError(InvalidParams) when topicPrompt is missing', async () => {
      mockGetContext.mockReturnValue(makeMockContext('[]'));

      await expect(provider.fetchQuestions({ count: 1 })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.InvalidParams })
      );
    });

    it('throws TriviaProviderError(InvalidParams) when topicPrompt is too short', async () => {
      mockGetContext.mockReturnValue(makeMockContext('[]'));

      await expect(provider.fetchQuestions({ count: 1, topicPrompt: 'ab' })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.InvalidParams })
      );
    });
  });

  describe('cancelFetch', () => {
    it('calls context.stopCompletion when context is available', () => {
      const ctx = makeMockContext('[]');
      mockGetContext.mockReturnValue(ctx);

      provider.cancelFetch();

      expect(ctx.stopCompletion).toHaveBeenCalled();
    });
  });

  describe('resetSession', () => {
    it('does not throw', () => {
      expect(() => provider.resetSession()).not.toThrow();
    });
  });

  describe('metadata methods', () => {
    it('fetchCategories returns empty array', async () => {
      const cats = await provider.fetchCategories();
      expect(cats).toEqual([]);
    });

    it('supportsCategories returns false', () => {
      expect(provider.supportsCategories()).toBe(false);
    });

    it('supportsDifficulty returns true', () => {
      expect(provider.supportsDifficulty()).toBe(true);
    });
  });
});
