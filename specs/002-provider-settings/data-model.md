# Data Model: Question Source Selection

**Branch**: `002-provider-settings` | **Date**: 2026-03-11

---

## New Entities

### QuestionSource (enum / union type)

A string literal union representing the two supported question providers.

```typescript
// apps/cirquiz/src/state/settingsStore.ts
export type QuestionSource = 'otdb' | 'the-trivia-api';
```

| Value | Description |
|-------|-------------|
| `'otdb'` | Open Trivia Database (existing provider, default) |
| `'the-trivia-api'` | The Trivia API |

**Validation rules**:
- Must be one of the two values above.
- Default for new installs: `'otdb'`.

---

### AppSettings (persisted store state)

The user preference record. Device-local, not synced.

```typescript
// apps/cirquiz/src/state/settingsStore.ts
interface SettingsStoreState {
  questionSource: QuestionSource;  // Active question provider
  isHydrated: boolean;             // AsyncStorage rehydration flag (not persisted)
}
```

**Persistence**:
- AsyncStorage key: `@cirquiz/settings`
- Schema version: `1`
- Partialised: `isHydrated` is excluded from persistence (same pattern as `gameStore`)
- Excluded from persistence: `isHydrated`

**State transitions**:
```
[app start] → isHydrated: false
    ↓ AsyncStorage rehydrates
[hydrated]  → isHydrated: true, questionSource: stored value (or 'otdb' if none)

[user selects source] → questionSource: new value (written immediately to AsyncStorage)
```

---

## Modified Entities

### Game (no schema change)

The `Game` entity in `state/types.ts` is **unchanged**. The question source active at game-start is implicitly captured by the questions themselves (each `Question` carries its own `category` and `difficulty` fields). No `questionSource` field is added to `Game` — the spec states that a game in progress is unaffected by subsequent source changes (FR-011), and the active provider is resolved at the start of each game, not stored in the game record.

### GameConfig (no schema change)

`GameConfig` in `state/types.ts` is **unchanged**. The provider is resolved from the settings store at `startGame` call time, not passed through config.

---

## Provider Abstractions (new files, not persisted)

### TheTriviaApiProvider

```typescript
// apps/cirquiz/src/providers/thetriviaapi/TheTriviaApiProvider.ts
class TheTriviaApiProvider implements TriviaQuestionProvider {
  fetchQuestions(params: QuestionFetchParams): Promise<Question[]>
  fetchCategories(): Promise<Category[]>
  supportsCategories(): boolean   // → true
  supportsDifficulty(): boolean   // → true
  resetSession(): void            // → no-op (stateless API)
}
```

**Category list** (hardcoded, 10 entries):

| `Category.id` | `Category.name` |
|---------------|----------------|
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

**Question mapping** (from The Trivia API v2 response):

| API field | `Question` field | Transform |
|-----------|-----------------|-----------|
| `id` | `id` | Direct |
| `question.text` | `text` | `q.question.text` |
| `correctAnswer` | `correctAnswer` | Direct |
| `incorrectAnswers` | `options` | `shuffle([correctAnswer, ...incorrectAnswers])` |
| `difficulty` | `difficulty` | Direct |
| `category` | `category` | Direct (slug string) |
| *(none)* | `type` | Always `'multiple-choice'` |

### Provider Factory

```typescript
// apps/cirquiz/src/providers/providerFactory.ts
function getProvider(source: QuestionSource): TriviaQuestionProvider
```

Returns a singleton instance per source key. Instances are created once and cached in module scope (matching the existing pattern in `gameStore.ts`).

---

## Relationships

```
SettingsStore
  └─ questionSource: QuestionSource
        │
        ▼ (resolved at call time in gameStore actions)
   providerFactory.getProvider(source)
        │
        ▼
   TriviaQuestionProvider  ◄─── OpenTriviaDbProvider  (source: 'otdb')
                           ◄─── TheTriviaApiProvider  (source: 'the-trivia-api')
        │
        ▼
   Question[]  →  Round  →  Game  (gameStore)
```

The settings store and the game store are **not** directly linked — the factory is the mediating layer resolved imperatively at action call time.
