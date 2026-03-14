# Quickstart: Question Source Selection

**Branch**: `002-provider-settings` | **Date**: 2026-03-11

---

## What This Feature Adds

- A new question provider: **The Trivia API** (`https://the-trivia-api.com/v2/questions`)
- A **Settings screen** (`/settings`) accessible from the home and setup screens
- A **persisted preference** (`@cirquiz/settings`) that remembers the active question source across app restarts
- Category list that updates to reflect the active provider

---

## File Map

| What | Where |
|------|-------|
| New settings screen | `apps/cirquiz/app/settings.tsx` |
| Settings Zustand store | `apps/cirquiz/src/state/settingsStore.ts` |
| Provider factory | `apps/cirquiz/src/providers/providerFactory.ts` |
| New provider implementation | `apps/cirquiz/src/providers/thetriviaapi/TheTriviaApiProvider.ts` |
| New provider response types | `apps/cirquiz/src/providers/thetriviaapi/triviaApiTypes.ts` |
| New provider tests | `apps/cirquiz/src/providers/thetriviaapi/__tests__/TheTriviaApiProvider.test.ts` |
| Modified: game store | `apps/cirquiz/src/state/gameStore.ts` |
| Modified: category loader hook | `apps/cirquiz/src/hooks/useCategoryLoader.ts` |
| Modified: home screen | `apps/cirquiz/app/index.tsx` |
| Modified: setup screen | `apps/cirquiz/app/setup.tsx` |
| Modified: provider index | `apps/cirquiz/src/providers/index.ts` |
| Modified: i18n strings | `apps/cirquiz/src/i18n/en.json` |

---

## Key Implementation Notes

### 1. Settings Store (`settingsStore.ts`)

Follows the `gameStore.ts` pattern exactly:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type QuestionSource = 'otdb' | 'the-trivia-api';

// Persist key: '@cirquiz/settings'
// Default: questionSource = 'otdb'
// Excluded from persistence: isHydrated
```

### 2. Provider Factory (`providerFactory.ts`)

```typescript
// Returns a singleton per source — instances are module-scoped.
// Called in gameStore.ts actions at call time:
//   const p = getProvider(useSettingsStore.getState().questionSource);
//   p.resetSession();
//   await p.fetchQuestions(params);
```

### 3. Game Store Changes (`gameStore.ts`)

Replace the top-level `let provider = new OpenTriviaDbProvider()` and `setProviderForTesting`:
- Production: `getProvider(useSettingsStore.getState().questionSource)` called inside `startGame`, `retryFetch`, `startNextRound`
- Testing: `providerFactory` exports a `setProviderForTesting(source, p)` override, or the existing test injection pattern is preserved via a separate export

### 4. The Trivia API Provider (`TheTriviaApiProvider.ts`)

```typescript
const BASE_URL = 'https://the-trivia-api.com/v2';

// fetchQuestions: GET /questions?limit={count}&categories={category}&difficulties={difficulty}
// fetchCategories: returns hardcoded 10-item array (no network call)
// supportsCategories: true
// supportsDifficulty: true
// resetSession: no-op
```

No HTML decoding needed (API returns plain text).
No session token management (stateless API on free tier).

### 5. Settings Screen (`settings.tsx`)

- Uses `GradientScreen` + `SelectableRow` (existing components)
- Two rows: "Open Trivia Database" and "The Trivia API"
- Active source shown with a selected indicator (same pattern as `CategorySelector` / `DifficultySelector`)
- Back navigation: `router.back()` (returns to caller — home or setup)
- Gear `IconButton` added to home and setup screens

### 6. Category Reset in Setup (`setup.tsx`)

```typescript
const questionSource = useSettingsStore((s) => s.questionSource);

useEffect(() => {
  if (selectedCategory !== null) {
    setSelectedCategory(null);
    // show brief toast/notice
  }
}, [questionSource]);
```

The effect fires when the user returns from settings with a changed source.
The notice must be non-blocking (not `Alert`) — use a brief animated overlay via `react-native-reanimated` or a cross-platform toast utility if one exists in the codebase.

### 7. `useCategoryLoader` Refactor

```typescript
// Before (hardcoded):
setCategories(await new OpenTriviaDbProvider().fetchCategories());

// After (source-aware):
const source = useSettingsStore.getState().questionSource;
setCategories(await getProvider(source).fetchCategories());
```

---

## i18n Keys Added

```json
"settings": {
  "title": "Settings",
  "questionSource": "Question Source",
  "otdb": "Open Trivia Database",
  "theTriviaApi": "The Trivia API",
  "categoryResetNotice": "Category selection was reset because the question source changed."
}
```

---

## Testing Approach

| Test | Location | Covers |
|------|----------|--------|
| `TheTriviaApiProvider` unit test | `thetriviaapi/__tests__/TheTriviaApiProvider.test.ts` | HTTP fetch, response mapping, error codes, `fetchCategories`, `supportsCategories`, `supportsDifficulty`, `resetSession` |
| Settings store unit test | `state/__tests__/settingsStore.test.ts` | Default value, `setQuestionSource`, persistence |
| Game store: source switching | `state/__tests__/gameStore.test.ts` | `startGame` uses the provider matching the active `questionSource` |

P1 happy-path test: switch `questionSource` to `'the-trivia-api'`, call `startGame`, assert questions come from `TheTriviaApiProvider` (using the existing `setProviderForTesting` pattern or the factory override).

---

## Navigation Flow

```
Home (index.tsx)
  ├── [gear icon] → router.push('/settings') → Settings (/settings)
  │                                                └── router.back() → Home
  └── [New Game] → Setup (/setup)
                    ├── [gear icon] → router.push('/settings') → Settings (/settings)
                    │                                                └── router.back() → Setup
                    └── [Start Game] → /(game)/...
```

The `(game)` group screens have no settings entry point — FR-005 satisfied by omission.

---

## Quality Gate Checklist

Before committing, run from the monorepo root:

```sh
yarn workspace cirquiz lint
yarn workspace cirquiz format:check
yarn workspace cirquiz typecheck
```

All three must pass with zero errors.
