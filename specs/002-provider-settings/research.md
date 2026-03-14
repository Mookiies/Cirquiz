# Research: Question Source Selection

**Branch**: `002-provider-settings` | **Date**: 2026-03-11

---

## 1. The Trivia API — Integration Design

**Decision**: Implement `TheTriviaApiProvider` using The Trivia API v2 (`https://the-trivia-api.com/v2/questions`).

**Rationale**: The API is free, requires no API key, and returns well-structured multiple-choice questions. Its response shape is a direct array of question objects, making it straightforward to adapt to the existing `TriviaQuestionProvider` interface.

**Alternatives considered**: Using a different third-party API. Rejected — The Trivia API was explicitly specified by the user and the spec.

### API Details

**Questions endpoint**: `GET https://the-trivia-api.com/v2/questions`

Query parameters:
| Parameter | Type | Notes |
|-----------|------|-------|
| `limit` | number | Number of questions (default 10, max per request varies) |
| `categories` | string | Category slug (e.g. `science`, `film_and_tv`) |
| `difficulties` | string | `easy`, `medium`, or `hard` |

**Response shape** (array of):
```json
{
  "id": "622a1c3d7fce235dd0f05b61",
  "category": "general_knowledge",
  "difficulty": "easy",
  "correctAnswer": "Paris",
  "incorrectAnswers": ["London", "Berlin", "Rome"],
  "question": { "text": "What is the capital of France?" },
  "type": "text_choice",
  "tags": [...],
  "regions": [...],
  "isNiche": false
}
```

Field mapping to internal `Question` type:
| API field | Internal field | Transform |
|-----------|---------------|-----------|
| `id` | `id` | Direct |
| `question.text` | `text` | `q.question.text` |
| `correctAnswer` | `correctAnswer` | Direct |
| `incorrectAnswers` | `options` | `shuffle([correctAnswer, ...incorrectAnswers])` |
| `difficulty` | `difficulty` | Direct (`easy`/`medium`/`hard` match) |
| `category` | `category` | Direct (slug used as display label) |
| *(no type field needed)* | `type` | Always `'multiple-choice'` |

No HTML entity decoding needed — the API returns plain text.

### Available Categories (10)

| API slug | Display name |
|----------|-------------|
| `arts_and_literature` | Arts & Literature |
| `film_and_tv` | Film & TV |
| `food_and_drink` | Food & Drink |
| `general_knowledge` | General Knowledge |
| `geography` | Geography |
| `history` | History |
| `music` | Music |
| `science` | Science |
| `society_and_culture` | Society & Culture |
| `sport_and_leisure` | Sport & Leisure |

These are hardcoded in `TheTriviaApiProvider.fetchCategories()` (same pattern as OTDB).

### Difficulty and Type Support

- Difficulty: `easy`, `medium`, `hard` — same values as OTDB, no mapping needed.
- Question type: All questions are multiple-choice (3 incorrect + 1 correct). The Trivia API does not provide true/false questions on the free tier. `supportsDifficulty()` → `true`, `supportsCategories()` → `true`.
- Type field on the setup screen: When The Trivia API is selected, the true/false question type option is naturally absent (the provider only returns `multiple-choice`). No special warning UI needed per the spec's assumptions.

### Session / Deduplication

**Decision**: Accept possible repeats across rounds; `resetSession()` is a no-op.

**Rationale**: The Trivia API session tokens (for server-side deduplication) are a paid feature. The free tier has a large enough question pool that duplicates are very unlikely for typical game sizes (5–20 questions). The `excludeIds` field in `QuestionFetchParams` is used by neither provider for actual server-side filtering; OTDB achieves dedup via its token/pool mechanism. For The Trivia API, we accept the same behaviour as OTDB when a token expires — questions may repeat rarely.

**Alternatives considered**: Client-side over-fetch and ID-based filtering. Rejected — adds complexity for a rare edge case and wastes API budget.

---

## 2. Provider Selection Architecture

**Decision**: Module-level singleton factory (`providerFactory.ts`) + runtime resolution in `gameStore.ts`.

**Rationale**: The `gameStore.ts` already has a module-level `let provider = new OpenTriviaDbProvider()`. The cleanest extension is a `getProvider(source)` factory that returns a cached singleton per source. `gameStore.ts` calls `getActiveProvider()` at action call time (not at module load), which reads the current settings from `useSettingsStore.getState()`. This keeps the stores fully decoupled — settings store doesn't know about the game store, and the game store only calls into the factory at the moment questions are needed.

**Alternatives considered**:
1. Subscribe game store to settings store changes. Rejected — subscription overhead for a preference that changes rarely and only outside a game.
2. Pass the provider as a parameter to `startGame`. Rejected — would require changing the `GameConfig` interface and all callers for an internal implementation detail.
3. Keep the existing `setProviderForTesting` pattern and extend it. Rejected — that function is test-only infrastructure; mixing it with production routing logic would be misleading.

---

## 3. Settings Persistence

**Decision**: New Zustand store (`settingsStore.ts`) with AsyncStorage persistence at key `@cirquiz/settings`.

**Rationale**: Follows the exact same pattern as `gameStore.ts`. Keeps settings concerns separate from game state. The two stores are independently rehydrated so settings are available immediately on app start.

**Default**: `questionSource: 'otdb'` — preserves existing behavior for new installs (FR-008).

**Schema version**: Start at `1`. No migration needed initially.

**Alternatives considered**: Storing settings inside `gameStore`. Rejected — settings are user preferences that outlive any individual game; mixing them into game state would complicate persistence partitioning and schema migration.

---

## 4. Settings Screen Navigation

**Decision**: `app/settings.tsx` as a standard Expo Router file-based route; navigated via `router.push('/settings')` from index and setup.

**Rationale**: `router.push` preserves the navigation stack, so `router.back()` always returns to the calling screen (home or setup). No custom back-target logic needed. The screen is only reachable by user-initiated `router.push` — game screens don't call it, satisfying FR-005.

**Alternatives considered**: Modal/sheet. Rejected by spec — FR-002 explicitly requires a dedicated navigable screen with back navigation.

---

## 5. Category Reset on Source Change

**Decision**: `setup.tsx` observes `questionSource` from the settings store via `useSettingsStore`. When the value changes while the setup screen is mounted, clear the locally selected category and show a toast notification.

**Rationale**: The simplest reliable pattern. Expo Router's stack means the setup screen stays mounted while the user navigates to settings and back; the value change is detectable via a `useEffect` on `questionSource`. The toast matches the "brief notice" requirement from the spec (FR-010).

**Toast implementation**: React Native's built-in `ToastAndroid` is Android-only. For cross-platform, the existing codebase will be checked for any toast utility. If none exists, use a lightweight approach: brief `Alert` or a custom animated overlay using `react-native-reanimated`. Prefer a non-blocking approach (not `Alert`) to match "brief notice" UX intent.

**Alternatives considered**: Detecting source change in the settings screen and passing back a signal via navigation params. Rejected — Expo Router's stack-based back navigation doesn't have a built-in "result" mechanism; the settings store observation is simpler and more reactive.

---

## 6. `useCategoryLoader` Refactor

**Decision**: Update `useCategoryLoader` to accept the active provider (or source key) and load categories from it, removing the hardcoded `new OpenTriviaDbProvider()`.

**Rationale**: Current implementation imports `OpenTriviaDbProvider` directly and instantiates a throwaway object. With two providers, the hook must use the active provider to load the correct category list. The hook will call `getProvider(questionSource)` from the factory or accept the provider as an argument.

---

## 7. i18n Keys Needed

New keys to add to `en.json` under a `settings` namespace:

```json
"settings": {
  "title": "Settings",
  "questionSource": "Question Source",
  "otdb": "Open Trivia Database",
  "theTriviaApi": "The Trivia API",
  "categoryResetNotice": "Category selection was reset because the question source changed."
}
```

The `categoryResetNotice` string is displayed as the toast when the source change clears a selected category.
