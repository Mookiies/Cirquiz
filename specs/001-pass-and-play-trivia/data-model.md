# Data Model: Pass-and-Play Trivia Game

## Entities

### Player

Represents a single participant in a game session.

| Field            | Type     | Constraints                                      |
|------------------|----------|--------------------------------------------------|
| id               | string   | UUID, unique within session                      |
| name             | string   | Non-empty, unique within game, max 20 chars      |
| color            | string   | Hex color code, unique within game, from palette |
| roundScore       | number   | >= 0; resets to 0 at the start of each round     |
| cumulativeScore  | number   | >= 0; accumulates across all rounds in session   |

**Color palette** (fixed set — enforces FR-002 uniqueness; more options than player slots so players have real choice):
`#E74C3C` (Red), `#3498DB` (Blue), `#2ECC71` (Green), `#F39C12` (Orange),
`#9B59B6` (Purple), `#1ABC9C` (Teal), `#E91E63` (Pink), `#F1C40F` (Yellow),
`#FF5722` (Deep Orange), `#00BCD4` (Cyan)
(10 colors for up to 6 players — ensures every player has meaningful choice even in a full 6-player game)

---

### Game

The top-level session container. A Game persists for the lifetime of a continuous play session (across multiple rounds).

| Field              | Type          | Constraints                                           |
|--------------------|---------------|-------------------------------------------------------|
| id                 | string        | UUID                                                  |
| players            | Player[]      | Length 1–6                                            |
| questionCount      | number        | >= 1; configured once, reused across rounds           |
| category           | string \| null | OTDB category ID; null = any category                |
| difficulty         | Difficulty \| null | null = any difficulty                            |
| mode               | GameMode      | 'quick' \| 'configured'                               |
| state              | GameState     | 'setup' \| 'in-progress' \| 'completed'               |
| rounds             | Round[]       | Ordered list; current round is last element           |
| currentRoundIndex  | number        | Index into rounds[]                                   |

**State transitions**:
```
setup → in-progress  (when game starts)
in-progress → completed  (when final question's reveal is dismissed)
completed → in-progress  (when "Play Another Round" is tapped; new Round appended)
```

---

### Round

A single play-through of the configured question set.

| Field                | Type     | Constraints                                         |
|----------------------|----------|-----------------------------------------------------|
| id                   | string   | UUID                                                |
| questions            | Question[] | Length = game.questionCount (or fewer if API returns less) |
| turns                | Turn[]   | Ordered; one Turn per (player × question) pair      |
| currentQuestionIndex | number   | Index into questions[]; 0-based                     |
| currentPlayerIndex   | number   | Index into game.players[]; advances per turn        |
| state                | RoundState | 'in-progress' \| 'completed'                      |

**Turn ordering**: For question index Q, turns are recorded for players 0→N in order before Q increments.

---

### Question

A single trivia item. Sourced exclusively via TriviaQuestionProvider; the game logic never fetches directly.

| Field         | Type         | Constraints                                           |
|---------------|--------------|-------------------------------------------------------|
| id            | string       | Provider-assigned unique identifier                   |
| type          | QuestionType | 'multiple-choice' \| 'true-false'                     |
| text          | string       | HTML-decoded display text                             |
| options       | string[]     | Shuffled; length 4 for multiple-choice, 2 for T/F    |
| correctAnswer | string       | Must be one of options[]                              |
| category      | string       | Display name of the category                          |
| difficulty    | Difficulty   | 'easy' \| 'medium' \| 'hard'                          |

---

### Turn

Records one player's answer to one question.

| Field          | Type    | Constraints                                      |
|----------------|---------|--------------------------------------------------|
| playerId       | string  | Must reference a Player.id in the current game   |
| questionId     | string  | Must reference a Question.id in the current round |
| selectedAnswer | string  | Must be one of question.options[]                |
| isCorrect      | boolean | Derived: selectedAnswer === question.correctAnswer |

---

### PersistedGameState

The snapshot written to AsyncStorage. This is the full serialized Game object including all nested Rounds, Questions, and Turns.

| Field     | Type   | Constraints                         |
|-----------|--------|-------------------------------------|
| game      | Game   | Complete game snapshot              |
| savedAt   | string | ISO 8601 timestamp                  |
| version   | number | Schema version for future migrations |

**Storage key**: `@cirquiz/active_game`

---

## Enumerations

```typescript
type QuestionType = 'multiple-choice' | 'true-false';
type Difficulty   = 'easy' | 'medium' | 'hard';
type GameMode     = 'quick' | 'configured';
type GameState    = 'setup' | 'in-progress' | 'completed';
type RoundState   = 'in-progress' | 'completed';
```

---

## TriviaQuestionProvider Interface

Defined in `apps/mobile/src/providers/interface.ts`. Game logic depends only on this interface — never on a concrete implementation.

```typescript
interface QuestionFetchParams {
  count: number;
  category?: string;       // Provider-specific category ID
  difficulty?: Difficulty;
  excludeIds?: string[];   // For FR-020: skip already-used question IDs
}

interface Category {
  id: string;
  name: string;
}

interface TriviaQuestionProvider {
  fetchQuestions(params: QuestionFetchParams): Promise<Question[]>;
  fetchCategories(): Promise<Category[]>;
  supportsCategories(): boolean;
  supportsDifficulty(): boolean;
}
```

---

## Relationships

```
Game 1 ──── * Round
Game 1 ──── * Player
Round 1 ──── * Question
Round 1 ──── * Turn
Turn * ────  1 Player
Turn * ────  1 Question
```

---

## Validation Rules

- A game MUST have 1–6 players before transitioning from `setup` to `in-progress`.
- Each player's name MUST be non-empty and unique within the game.
- Each player's color MUST be unique within the game.
- A round's `currentPlayerIndex` cycles 0 → N-1 within a question, then `currentQuestionIndex` advances.
- A Turn MUST NOT be recorded for a (player, question) pair that already has a Turn in the current round.
- `PersistedGameState.version` MUST be checked on load; if the stored version is older than the current schema version, the saved game MUST be discarded gracefully.
