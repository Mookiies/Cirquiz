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

`LocalDatabaseProvider` has no async init logic of its own. It receives an open `SQLiteDatabase` instance via constructor injection from the app's React tree.

The database is opened by `SQLiteProvider` (from `expo-sqlite`) in `apps/cirquiz/app/_layout.tsx`, which wraps the entire app. `SQLiteProvider` handles the asset copy natively:

- On first launch (or after a DB name bump): copies `assets/trivia.db` to the device's SQLite directory under the versioned name (e.g. `trivia_v1.db`), then opens it.
- On subsequent launches: the file already exists, so no copy occurs.

Once the DB is open, the `LocalDbBridge` component (also in `_layout.tsx`) calls `setLocalDb(db)` to register the `LocalDatabaseProvider` singleton in the provider factory.

**Update workflow for future releases**:
1. Run `python pipeline.py export`.
2. Copy `pipeline/export/cirquiz_questions.db` to `apps/cirquiz/assets/trivia.db`.
3. Bump `TRIVIA_DB_NAME` in `apps/cirquiz/app/_layout.tsx` (e.g. `trivia_v1.db` → `trivia_v2.db`).
4. Ship the app update — on the user's next launch, the new DB is copied automatically and the old versioned file is deleted.

---

## Provider Registration

The `'local'` source is registered in `apps/cirquiz/src/providers/providerFactory.ts` via `setLocalDb()`, called automatically at app startup from `LocalDbBridge`. No manual registration is needed.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `expo-sqlite` | SQLite access + `SQLiteProvider` for asset copying |
| `expo-file-system` | Stale DB cleanup (`File` class) |

**Metro config** (`apps/cirquiz/metro.config.js`): `'db'` is included in `assetExts` so the `.db` file is bundled correctly.
