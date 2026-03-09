# Contract: TriviaQuestionProvider

**Location**: `apps/cirquiz/src/providers/`
**Purpose**: Defines the interface all question source implementations must satisfy. Game logic depends only on this contract — never on a concrete provider.

---

## Interface: TriviaQuestionProvider

```typescript
interface TriviaQuestionProvider {
  /**
   * Fetch a list of trivia questions.
   * Must return only Multiple Choice and True/False question types.
   * If fewer questions than `params.count` are available, returns what is available.
   * If zero questions are available, throws TriviaProviderError.
   */
  fetchQuestions(params: QuestionFetchParams): Promise<Question[]>;

  /**
   * Fetch available categories supported by this provider.
   * Returns an empty array if the provider does not support categories.
   */
  fetchCategories(): Promise<Category[]>;

  /**
   * Returns true if this provider supports category filtering.
   */
  supportsCategories(): boolean;

  /**
   * Returns true if this provider supports difficulty filtering.
   */
  supportsDifficulty(): boolean;

  /**
   * Resets the provider session so the next fetchQuestions call starts a fresh
   * question pool. Called by the store at the start of every new game.
   * Must NOT be called between rounds — the session persists across rounds
   * within the same game so question deduplication (FR-020) works correctly.
   */
  resetSession(): void;
}
```

---

## Types

```typescript
interface QuestionFetchParams {
  count: number;            // Number of questions to fetch (>= 1)
  category?: string;        // Provider-specific category identifier; omit for any
  difficulty?: Difficulty;  // Omit for any difficulty
  excludeIds?: string[];    // IDs of questions to exclude (used for FR-020 nice-to-have)
}

interface Question {
  id: string;               // Provider-assigned unique identifier
  type: QuestionType;
  text: string;             // Display-ready, HTML-decoded text
  options: string[];        // Shuffled answer options (4 for MC, 2 for T/F)
  correctAnswer: string;    // One of options[]
  category: string;         // Human-readable category name
  difficulty: Difficulty;
}

interface Category {
  id: string;               // Provider-specific identifier (passed back in QuestionFetchParams)
  name: string;             // Human-readable display name
}

type QuestionType = 'multiple-choice' | 'true-false';
type Difficulty   = 'easy' | 'medium' | 'hard';
```

---

## Error Contract

```typescript
class TriviaProviderError extends Error {
  constructor(
    message: string,
    public readonly code: TriviaProviderErrorCode,
  ) {
    super(message);
    this.name = 'TriviaProviderError';
  }
}

enum TriviaProviderErrorCode {
  NetworkError    = 'NETWORK_ERROR',     // Could not reach provider
  NoResults       = 'NO_RESULTS',        // Provider returned 0 questions
  InvalidParams   = 'INVALID_PARAMS',    // Bad category/difficulty/count
  ProviderError   = 'PROVIDER_ERROR',    // Provider-side error (5xx, unknown)
}
```

Game logic catches `TriviaProviderError` and maps it to FR-017 (user-readable error, no game start).

---

## Implementation: OpenTriviaDbProvider

**Location**: `apps/cirquiz/src/providers/opentdb/OpenTriviaDbProvider.ts`

**OTDB-specific behavior**:

| Interface method      | OTDB mapping                                                       |
|-----------------------|--------------------------------------------------------------------|
| `fetchQuestions`      | `GET /api.php?amount=N&category=C&difficulty=D&type=T&token=TOKEN` |
| `fetchCategories`     | `GET /api_category.php`                                            |
| `supportsCategories`  | `true`                                                             |
| `supportsDifficulty`  | `true`                                                             |

**Session token lifecycle** (supports FR-020 nice-to-have):
1. On first `fetchQuestions` call after construction or `resetSession()`, request a new token: `GET /api_token.php?command=request` and store it as private instance state.
2. Pass token with every subsequent `fetchQuestions` call.
3. If OTDB returns response code `4` (token empty — all questions exhausted), reset the token via `GET /api_token.php?command=reset&token=TOKEN` and retry once.
4. Token is **not** exposed to the store or game state. If the app is force-closed, a new token is obtained on next launch (acceptable: OTDB tokens expire after 6 hours regardless).

**Session lifecycle ownership**:
- `resetSession()` is called by the **store** at the start of every new game (`startGame`), ensuring a fresh question pool.
- `resetSession()` is **not** called between rounds (`startNextRound`) — the token persists so OTDB tracks which questions have already been seen across all rounds in the session (enabling FR-020 deduplication).
- `resetSession()` sets the internal token to `null`; the new token is acquired lazily on the next `fetchQuestions` call.

**HTML decoding**: All `question`, `correct_answer`, and `incorrect_answers` fields from OTDB are HTML-encoded and MUST be decoded before populating `Question.text` and `Question.options`.

**Question ID generation**: OTDB does not provide stable question IDs. Generate a deterministic ID by hashing the question text: `md5(question.text)` or use a UUID generated at fetch time. The ID only needs to be stable for the lifetime of a session.

**Type mapping**:
- `"multiple"` → `'multiple-choice'`; options = shuffle([correct_answer, ...incorrect_answers])
- `"boolean"` → `'true-false'`; options = `['True', 'False']`

---

## Contract Guarantees (all implementations must satisfy)

1. `fetchQuestions` MUST return only `'multiple-choice'` or `'true-false'` question types.
2. `Question.options` MUST be shuffled; `Question.correctAnswer` MUST be one of `Question.options`.
3. `Question.text` MUST be HTML-decoded and display-ready.
4. If the provider cannot return any questions, it MUST throw `TriviaProviderError` (not return an empty array silently).
5. `fetchCategories` MUST return an empty array (not throw) if categories are unsupported.
6. All returned `Question.id` values MUST be unique within a single `fetchQuestions` call.
7. `resetSession()` MUST be synchronous and MUST cause the next `fetchQuestions` call to begin a fresh session (new question pool). It MUST NOT throw.
