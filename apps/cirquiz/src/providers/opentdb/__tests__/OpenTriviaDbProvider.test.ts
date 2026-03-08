import { OpenTriviaDbProvider } from '../OpenTriviaDbProvider';
import { TriviaProviderError, TriviaProviderErrorCode } from '../../types';
import { OtdbQuestion, OtdbResponse, OtdbTokenResponse } from '../otdbTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

const TOKEN = 'test-token-abc';

const tokenBody: OtdbTokenResponse = {
  response_code: 0,
  response_message: 'Token Generated Successfully!',
  token: TOKEN,
};

const makeResponse = (body: object, ok = true) => ({
  ok,
  json: () => Promise.resolve(body),
});

const makeQuestion = (overrides: Partial<OtdbQuestion> = {}): OtdbQuestion => ({
  type: 'multiple',
  difficulty: 'easy',
  category: 'General Knowledge',
  question: 'What is 2 + 2?',
  correct_answer: '4',
  incorrect_answers: ['1', '2', '3'],
  ...overrides,
});

const makeQuestionsBody = (results: OtdbQuestion[], response_code = 0): OtdbResponse => ({
  response_code,
  results,
});

/** Sets up fetch to return token then one or more subsequent responses in order. */
function setupFetch(...responses: ReturnType<typeof makeResponse>[]) {
  mockFetch.mockReset();
  for (const r of responses) {
    mockFetch.mockResolvedValueOnce(r);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OpenTriviaDbProvider', () => {
  let provider: OpenTriviaDbProvider;

  beforeEach(() => {
    provider = new OpenTriviaDbProvider();
    mockFetch.mockReset();
  });

  // ── Transformation ──────────────────────────────────────────────────────────

  describe('transformation', () => {
    it("maps type 'multiple' to 'multiple-choice'", async () => {
      setupFetch(
        makeResponse(tokenBody),
        makeResponse(makeQuestionsBody([makeQuestion({ type: 'multiple' })]))
      );
      const [q] = await provider.fetchQuestions({ count: 1 });
      expect(q.type).toBe('multiple-choice');
    });

    it("maps type 'boolean' to 'true-false'", async () => {
      setupFetch(
        makeResponse(tokenBody),
        makeResponse(
          makeQuestionsBody([
            makeQuestion({ type: 'boolean', correct_answer: 'True', incorrect_answers: ['False'] }),
          ])
        )
      );
      const [q] = await provider.fetchQuestions({ count: 1 });
      expect(q.type).toBe('true-false');
    });

    it('decodes HTML entities in text, correctAnswer, and category', async () => {
      setupFetch(
        makeResponse(tokenBody),
        makeResponse(
          makeQuestionsBody([
            makeQuestion({
              question: 'What is 2 &amp; 2?',
              correct_answer: '4 &lt; 5',
              category: 'Science &amp; Nature',
              incorrect_answers: ['1', '2', '3'],
            }),
          ])
        )
      );
      const [q] = await provider.fetchQuestions({ count: 1 });
      expect(q.text).toBe('What is 2 & 2?');
      expect(q.correctAnswer).toBe('4 < 5');
      expect(q.category).toBe('Science & Nature');
    });

    it('multiple-choice options contain all 4 answers including correctAnswer', async () => {
      setupFetch(
        makeResponse(tokenBody),
        makeResponse(
          makeQuestionsBody([
            makeQuestion({
              correct_answer: '4',
              incorrect_answers: ['1', '2', '3'],
            }),
          ])
        )
      );
      const [q] = await provider.fetchQuestions({ count: 1 });
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain('4');
      expect(q.options).toContain('1');
      expect(q.options).toContain('2');
      expect(q.options).toContain('3');
    });

    it("boolean questions always return options ['True', 'False']", async () => {
      setupFetch(
        makeResponse(tokenBody),
        makeResponse(
          makeQuestionsBody([
            makeQuestion({ type: 'boolean', correct_answer: 'True', incorrect_answers: ['False'] }),
          ])
        )
      );
      const [q] = await provider.fetchQuestions({ count: 1 });
      expect(q.options).toEqual(['True', 'False']);
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('response_code 1 throws TriviaProviderError with code NoResults', async () => {
      setupFetch(makeResponse(tokenBody), makeResponse(makeQuestionsBody([], 1)));
      await expect(provider.fetchQuestions({ count: 1 })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NoResults })
      );
    });

    it('response_code 2 throws TriviaProviderError with code InvalidParams', async () => {
      setupFetch(makeResponse(tokenBody), makeResponse(makeQuestionsBody([], 2)));
      await expect(provider.fetchQuestions({ count: 1 })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.InvalidParams })
      );
    });

    it('response_code 4 resets token, retries, and returns questions from retry', async () => {
      const retryQuestion = makeQuestion({ question: 'Retry question?' });
      setupFetch(
        makeResponse(tokenBody), // 1: token request
        makeResponse(makeQuestionsBody([], 4)), // 2: questions → code 4
        makeResponse({ response_code: 0, token: TOKEN }), // 3: reset token
        makeResponse(makeQuestionsBody([retryQuestion])) // 4: retry questions
      );
      const questions = await provider.fetchQuestions({ count: 1 });
      expect(questions).toHaveLength(1);
      expect(questions[0].text).toBe('Retry question?');
    });

    it('unknown non-zero response_code throws TriviaProviderError with code ProviderError', async () => {
      setupFetch(makeResponse(tokenBody), makeResponse(makeQuestionsBody([], 99)));
      await expect(provider.fetchQuestions({ count: 1 })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.ProviderError })
      );
    });

    it('empty results array throws TriviaProviderError with code NoResults', async () => {
      setupFetch(makeResponse(tokenBody), makeResponse(makeQuestionsBody([])));
      await expect(provider.fetchQuestions({ count: 1 })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NoResults })
      );
    });

    it('res.ok === false throws TriviaProviderError with code NetworkError', async () => {
      setupFetch(makeResponse(tokenBody), makeResponse({}, false));
      await expect(provider.fetchQuestions({ count: 1 })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NetworkError })
      );
    });

    it('fetch rejection throws TriviaProviderError with code NetworkError', async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(tokenBody))
        .mockRejectedValueOnce(new Error('network failure'));
      await expect(provider.fetchQuestions({ count: 1 })).rejects.toThrow(
        expect.objectContaining({ code: TriviaProviderErrorCode.NetworkError })
      );
    });

    it('thrown errors are instances of TriviaProviderError', async () => {
      setupFetch(makeResponse(tokenBody), makeResponse(makeQuestionsBody([], 1)));
      await expect(provider.fetchQuestions({ count: 1 })).rejects.toBeInstanceOf(
        TriviaProviderError
      );
    });
  });

  // ── Token caching ───────────────────────────────────────────────────────────

  describe('token caching', () => {
    it('second fetchQuestions reuses cached token (token endpoint called once)', async () => {
      const questions = [makeQuestion()];
      setupFetch(
        makeResponse(tokenBody), // token fetch (only once)
        makeResponse(makeQuestionsBody(questions)), // first questions fetch
        makeResponse(makeQuestionsBody(questions)) // second questions fetch (no token re-fetch)
      );
      await provider.fetchQuestions({ count: 1 });
      await provider.fetchQuestions({ count: 1 });

      const tokenFetches = mockFetch.mock.calls.filter((args) =>
        (args[0] as string).includes('api_token.php?command=request')
      );
      expect(tokenFetches).toHaveLength(1);
    });

    it('after resetSession(), next call re-fetches the token', async () => {
      const questions = [makeQuestion()];
      setupFetch(
        makeResponse(tokenBody), // first token fetch
        makeResponse(makeQuestionsBody(questions)), // first questions fetch
        makeResponse(tokenBody), // second token fetch (after reset)
        makeResponse(makeQuestionsBody(questions)) // second questions fetch
      );
      await provider.fetchQuestions({ count: 1 });
      provider.resetSession();
      await provider.fetchQuestions({ count: 1 });

      const tokenFetches = mockFetch.mock.calls.filter((args) =>
        (args[0] as string).includes('api_token.php?command=request')
      );
      expect(tokenFetches).toHaveLength(2);
    });
  });
});
