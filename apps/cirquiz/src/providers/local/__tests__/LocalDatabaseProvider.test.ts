import { LocalDatabaseProvider } from '../LocalDatabaseProvider';

// ── Fixtures ───────────────────────────────────────────────────────────────

const FIXTURE_QUESTIONS = [
  {
    id: '1',
    text: 'What is the capital of France?',
    correct_answer: 'Paris',
    distractor_1: 'London',
    distractor_2: 'Berlin',
    distractor_3: 'Rome',
    category: 'geography',
    difficulty: 'easy',
  },
  {
    id: '2',
    text: 'Who wrote Hamlet?',
    correct_answer: 'Shakespeare',
    distractor_1: 'Dickens',
    distractor_2: 'Austen',
    distractor_3: 'Tolstoy',
    category: 'arts_and_literature',
    difficulty: 'medium',
  },
  {
    id: '3',
    text: 'What is the speed of light?',
    correct_answer: '299,792 km/s',
    distractor_1: '150,000 km/s',
    distractor_2: '500,000 km/s',
    distractor_3: '1,000,000 km/s',
    category: 'science',
    difficulty: 'hard',
  },
];

const FIXTURE_CATEGORIES = [
  { id: 'geography', name: 'Geography' },
  { id: 'arts_and_literature', name: 'Arts & Literature' },
  { id: 'science', name: 'Science' },
];

// ── Setup ──────────────────────────────────────────────────────────────────

const mockGetAllAsync = jest.fn();

function makeProvider(questionRows = FIXTURE_QUESTIONS, categoryRows = FIXTURE_CATEGORIES) {
  mockGetAllAsync.mockImplementation((sql: string) => {
    if (sql.includes('FROM categories')) return Promise.resolve(categoryRows);
    return Promise.resolve(questionRows);
  });
  const db = { getAllAsync: mockGetAllAsync } as any;
  return new LocalDatabaseProvider(db);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('LocalDatabaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchQuestions()', () => {
    it('returns the requested count of questions', async () => {
      const provider = makeProvider();
      const results = await provider.fetchQuestions({ count: 2 });
      expect(results).toHaveLength(FIXTURE_QUESTIONS.length); // mock returns all
      expect(results[0]).toMatchObject({
        type: 'multiple-choice',
        options: expect.arrayContaining([expect.any(String)]),
        correctAnswer: expect.any(String),
      });
    });

    it('includes 4 options per question, one of which is the correct answer', async () => {
      const provider = makeProvider();
      const results = await provider.fetchQuestions({ count: 3 });
      for (const q of results) {
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.correctAnswer);
      }
    });

    it('passes category filter to the SQL query', async () => {
      const provider = makeProvider();
      await provider.fetchQuestions({ count: 1, category: 'geography' });
      const sql: string = mockGetAllAsync.mock.calls[0][0];
      expect(sql).toContain('category = ?');
    });

    it('passes difficulty filter to the SQL query', async () => {
      const provider = makeProvider();
      await provider.fetchQuestions({ count: 1, difficulty: 'easy' });
      const sql: string = mockGetAllAsync.mock.calls[0][0];
      expect(sql).toContain('difficulty = ?');
    });

    it('excludes provided IDs from the query', async () => {
      const provider = makeProvider();
      await provider.fetchQuestions({ count: 2, excludeIds: ['1', '2'] });
      const sql: string = mockGetAllAsync.mock.calls[0][0];
      expect(sql).toContain('NOT IN');
    });
  });

  describe('fetchCategories()', () => {
    it('returns all categories from the database', async () => {
      const provider = makeProvider();
      const cats = await provider.fetchCategories();
      expect(cats).toHaveLength(FIXTURE_CATEGORIES.length);
      expect(cats[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) });
    });
  });

  describe('supportsCategories() / supportsDifficulty()', () => {
    it('returns true for both', () => {
      const provider = makeProvider();
      expect(provider.supportsCategories()).toBe(true);
      expect(provider.supportsDifficulty()).toBe(true);
    });
  });

  describe('resetSession()', () => {
    it('does not throw', () => {
      const provider = makeProvider();
      expect(() => provider.resetSession()).not.toThrow();
    });
  });
});
