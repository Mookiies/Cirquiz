# Contract: LocalDatabaseProvider (App Integration)

**Type**: TypeScript class implementing `TriviaQuestionProvider`
**Location**: `apps/cirquiz/src/providers/local/LocalDatabaseProvider.ts`

---

## Interface Implemented

```typescript
interface TriviaQuestionProvider {
  fetchQuestions(params: QuestionFetchParams): Promise<Question[]>;
  fetchCategories(): Promise<Category[]>;
  supportsCategories(): boolean;
  supportsDifficulty(): boolean;
  resetSession(): void;
}
```

Source: `apps/cirquiz/src/providers/interface.ts`

---

## Method Contracts

### `fetchQuestions(params)`

Queries the bundled SQLite database for verified questions, excluding any IDs in `params.excludeIds` (session dedup).

```typescript
interface QuestionFetchParams {
  count: number;
  category?: string;    // category slug, e.g., 'history'
  difficulty?: Difficulty;  // 'easy' | 'medium' | 'hard'
  excludeIds?: string[];
}
```

**SQL (export DB)**:
```sql
SELECT * FROM questions
WHERE 1=1
  [AND category = :category]
  [AND difficulty = :difficulty]
  [AND id NOT IN (:excludeIds)]
ORDER BY RANDOM()
LIMIT :count
```

**Returns**: `Question[]` with options array = `[correct_answer, distractor_1, distractor_2, distractor_3]` shuffled.

**Edge case**: If fewer than `count` questions are available after filters, returns all matching questions (may be fewer than requested). The caller (`gameStore`) handles this gracefully.

---

### `fetchCategories()`

Returns all 10 categories from the `categories` table.

**Returns**: `Category[]` ordered by `name` ASC.

---

### `supportsCategories()`

Returns `true`.

---

### `supportsDifficulty()`

Returns `true`.

---

### `resetSession()`

Clears the in-memory set of used question IDs. Called by `gameStore` at the start of each new game (not between rounds).

---

## Initialization

The provider requires async initialization before use. This is handled on each app launch:

1. A `BUNDLED_DB_VERSION` integer constant is declared at the top of `LocalDatabaseProvider.ts`. This value is updated manually each time a new `trivia.db` is copied to the app assets directory (the `export` phase prints the version number to make this easy).
2. Read the previously installed version from AsyncStorage (key: `@cirquiz/local_db_version`).
3. If `BUNDLED_DB_VERSION` is greater than the stored version (or no stored version exists) → copy the bundled `trivia.db` asset to the document directory using `expo-file-system`, overwriting any existing file, then persist `BUNDLED_DB_VERSION` to AsyncStorage.
4. Open the database connection with `expo-sqlite`.
5. Validate that the `questions` table exists and is non-empty.
6. On failure, throw a typed error so the factory can fall back to an online provider.

**Update workflow for future releases**:
1. Run `python pipeline.py export` — note the `db_version` printed in the summary.
2. Copy `pipeline/export/cirquiz_questions.db` to `apps/cirquiz/assets/trivia.db`.
3. Update `BUNDLED_DB_VERSION` in `LocalDatabaseProvider.ts` to match the printed version.
4. Ship the app update — version detection and DB replacement happen automatically on the user's next launch.

---

## Provider Registration

The new source is registered in `apps/cirquiz/src/providers/providerFactory.ts` as a new `QuestionSource` value (e.g., `'local'`). The settings store (`src/state/settingsStore.ts`) may need a corresponding update to expose the local source as a selectable option in the UI.

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-sqlite` | `~14.x` | SQLite access (installed via `npx expo install expo-sqlite`) |

**Metro config change** (`apps/cirquiz/metro.config.js`): Add `'db'` to `assetExts` so the `.db` file is bundled correctly.
