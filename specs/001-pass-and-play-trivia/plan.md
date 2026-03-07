# Implementation Plan: Pass-and-Play Trivia Game

**Branch**: `001-pass-and-play-trivia` | **Date**: 2026-03-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-pass-and-play-trivia/spec.md`

## Summary

A local pass-and-play multiplayer (1–6 players) trivia app for iOS and Android. Players take turns answering the same questions on a single shared device; a strict handoff screen gates each turn in multiplayer. Game state is persisted locally for recovery. Questions are sourced via an abstracted `TriviaQuestionProvider` interface, initially backed by the Open Trivia Database. Built with Expo + React Native, TypeScript, Expo Router, Zustand, and EAS for cross-platform builds. Delivered in a monorepo (`apps/mobile`) with the provider logic in `apps/mobile/src/providers/`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js >= 18
**Primary Dependencies**: Expo SDK (latest stable), Expo Router, Zustand + AsyncStorage persist, i18next + react-i18next, React Native Testing Library, Jest
**Storage**: AsyncStorage (`@react-native-async-storage/async-storage`) for game state persistence
**Testing**: Jest + React Native Testing Library
**Target Platform**: iOS (15+) and Android (API 31+); both required (FR-019)
**Project Type**: Mobile app (monorepo root with `apps/mobile`; future `apps/api` workspace planned)
**Performance Goals**: Primary interactions responsive; screen transitions < 300ms on mid-range device (SC-001)
**Constraints**: No network dependency during active gameplay; only at game start for question fetch (FR-017); offline-capable once questions are loaded
**Scale/Scope**: Single-device local play; 1–6 players; personal project scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ Pass | `src/providers/` module boundary enforces single-responsibility for the provider. Custom RN stylesheets (no design library) keeps component scope focused. |
| II. Testing Standards | ✅ Pass | P1 journey (full game loop) must have happy-path test coverage. TriviaQuestionProvider interface enables a mock provider for deterministic tests. |
| III. UX Consistency | ✅ Pass | No design library; custom components will share a single stylesheet module. Handoff screen pattern is consistent across all multiplayer turns. |
| IV. Performance | ✅ Pass | All network I/O happens once at game start; no mid-game network calls. AsyncStorage writes are async and non-blocking. |
| V. Live Verification via Maestro | ✅ Pass | All P1 user journeys (full game loop, solo mode, persistence, error handling) MUST be verified by launching the app on a simulator via `mcp__maestro__launch_app`, inspecting with `mcp__maestro__inspect_view_hierarchy` / `mcp__maestro__take_screenshot`, and running flows with `mcp__maestro__run_flow`. Screenshots/flow results saved to `specs/001-pass-and-play-trivia/verification/` before merge. |

*Post-Phase 1 re-check*: No violations introduced by the design. The `src/providers/` module boundary enforces Principle I (single responsibility). Mock provider in tests satisfies Principle II. Consistent screen structure via Expo Router satisfies Principle III. Principle V is satisfied by design — the Expo dev client runs on iOS Simulator, which is directly accessible via Maestro MCP.

## Project Structure

### Documentation (this feature)

```text
specs/001-pass-and-play-trivia/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── trivia-provider.md  # TriviaQuestionProvider interface contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
cirquiz/
├── package.json                   # yarn workspaces root: workspaces: ["apps/*"]
├── apps/
│   └── mobile/                    # Expo React Native app
│       ├── app/                   # Expo Router — file-based screens
│       │   ├── _layout.tsx        # Root layout (navigation container, i18n init)
│       │   ├── index.tsx          # Home: New Game / Resume Game
│       │   ├── setup.tsx          # Game setup (players, count, mode)
│       │   └── (game)/
│       │       ├── _layout.tsx    # Shared in-game layout: active player banner (FR-006)
│       │       │                  # + Quit Game button (FR-014); hidden on standings.tsx
│       │       ├── handoff.tsx    # Handoff screen (multiplayer only; skipped in solo)
│       │       ├── question.tsx   # Question screen
│       │       ├── reveal.tsx     # Answer reveal: correct answer, each player's chosen
│       │       │                  # answer + correct/wrong, ROUND scores
│       │       ├── standings.tsx  # Final standings: CUMULATIVE scores, Play Another Round, Go Home
│       │       └── error.tsx      # API error screen (question fetch failure)
│       ├── src/
│       │   ├── providers/         # TriviaQuestionProvider interface + implementations
│       │   │   ├── index.ts       # Re-exports interface, types, and OpenTriviaDbProvider
│       │   │   ├── interface.ts   # TriviaQuestionProvider interface
│       │   │   ├── types.ts       # Question, Category, QuestionFetchParams, TriviaProviderError, enums
│       │   │   └── opentdb/
│       │   │       ├── OpenTriviaDbProvider.ts   # Concrete OTDB implementation
│       │   │       └── otdbTypes.ts              # Internal OTDB API response shapes
│       │   ├── components/        # Custom RN components (no design library, base RN stylesheets)
│       │   ├── state/             # Zustand store + AsyncStorage persist adapter (see §Store Shape)
│       │   ├── i18n/              # en.json strings; i18next + expo-localization init
│       │   ├── hooks/             # useGame, useCurrentPlayer, useCurrentQuestion, etc.
│       │   └── utils/             # htmlDecode (he library), shuffle (Fisher-Yates), uuid (crypto.randomUUID)
│       ├── __tests__/
│       ├── metro.config.js        # Standard default config (no watchFolders needed; provider is inside the app)
│       ├── app.config.js          # Dynamic config (replaces app.json); reads APP_ENV
│       └── eas.json               # Run `eas build` from apps/mobile/, not workspace root
└── specs/
```

**Structure Decision**: Monorepo with yarn workspaces (`apps/*`). The `TriviaQuestionProvider` interface and implementations live in `apps/mobile/src/providers/` — inside the app, not a separate package. This avoids the Metro symlink complexity of a cross-package dependency while keeping the monorepo structure ready for a future `apps/api/` workspace.

**Score display by screen**:
- **`reveal.tsx`** (Answer Reveal, mid-round): Shows each player's **round score** (points earned in the current round so far). Cumulative scores are not the focus here.
- **`standings.tsx`** (Final Standings / end of round): Shows each player's **cumulative score** across all rounds played in the session, plus the round-just-completed breakdown.

**"Fewer questions than requested" UX**: When OTDB returns fewer questions than configured (but >0), the app shows a dismissable alert/modal immediately after fetching, before the first handoff screen, stating the adjusted question count. The game then proceeds normally with the reduced set.

## Complexity Tracking

> No constitution violations requiring justification.

## Environment Strategy

Three environments managed via EAS build profiles. See [research.md §9](./research.md) for full detail.

| Environment | EAS Profile | Distribution | Purpose |
|-------------|-------------|--------------|---------|
| Development | `development` | Internal (dev client) | Local dev, simulator, dev device |
| Staging | `preview` | Internal (TestFlight / internal track) | Prod-like testing before release |
| Production | `production` | App Store / Play Store | Public release |

Per-environment config is driven by `APP_ENV` injected in `eas.json` and read by `app.config.js` (dynamic config). This gives each environment a distinct app name suffix and bundle ID suffix so all three can be installed side-by-side on a device.

**Secrets**: See [research.md §10](./research.md). Rules in brief:
- Local secrets → `apps/mobile/.env.local` (gitignored; never committed)
- CI/build secrets → EAS environment variables (`eas secret:create`)
- A `.env.local.example` with placeholder values is committed as a template
- No secrets are hardcoded in source or committed to git under any circumstances

**Key files added to project structure** (beyond what is listed above):
```
apps/mobile/
├── app.config.js        # Dynamic config replacing app.json; reads APP_ENV
├── eas.json             # Three profiles: development, preview, production
├── .env.local           # Gitignored; local developer secrets
└── .env.local.example   # Committed; template for local setup
```

## Phase 0: Research Output

See [research.md](./research.md) for full findings. Key decisions:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Expo + React Native | Single codebase → iOS + Android (FR-019) |
| Navigation | Expo Router | File-based, recommended by Expo, screen-per-state fits the game flow |
| State | Zustand + persist middleware | Lightweight, TypeScript-first, AsyncStorage integration built-in |
| Persistence | AsyncStorage | Non-sensitive game state; standard RN key-value store |
| Localization | i18next + react-i18next | Standard ecosystem choice; adding languages = new JSON file |
| Question source | Open Trivia DB | Free, no API key, 24 categories, session tokens for FR-020 nice-to-have |
| Testing | Jest + RNTL | Ships with Expo; standard for React Native |

## Phase 1: Design Output

### Data Model

See [data-model.md](./data-model.md). Key entities: `Player`, `Game`, `Round`, `Question`, `Turn`, `PersistedGameState`.

Notable design decisions:
- **Session token (provider-internal)**: OTDB session tokens are managed entirely inside `OpenTriviaDbProvider` as private state. The token is requested on the first `fetchQuestions` call and reused for the lifetime of the provider instance (app session). If the app is force-closed, a new token is obtained on next launch — acceptable since FR-020 is a nice-to-have and OTDB tokens expire after 6 hours anyway. No token field on `Game`; no store action needed.
- **Turn ordering invariant**: For question index Q, all N player turns are recorded in player order before Q advances. This is the core game loop invariant.
- **Solo mode**: When `game.players.length === 1`, handoff screens are skipped entirely (FR-005). The game loop reduces to: question → record answer → reveal → next question.
- **Schema versioning**: `PersistedGameState.version` enables future-safe migration on load.

### Provider Contract

See [contracts/trivia-provider.md](./contracts/trivia-provider.md).

- `TriviaQuestionProvider` interface defined in `apps/mobile/src/providers/interface.ts`
- `OpenTriviaDbProvider` is the first concrete implementation
- Error contract: `TriviaProviderError` with typed error codes; game logic catches and maps to FR-017

**Provider extensibility model**: The design supports **one active provider per game session**. The concrete provider is injected at app startup (wired in the Zustand store). Swapping providers means changing which implementation is injected — not a runtime user-facing choice (that is out of scope). Future providers simply implement `TriviaQuestionProvider` and can be added to `apps/mobile/src/providers/` without touching game logic.

### Quickstart

See [quickstart.md](./quickstart.md) for setup, run, test, and EAS build instructions.

---

## Implementation Guide

This section provides the sequence and detail needed to translate the above design into tasks. Each sub-section references the artifacts that contain the authoritative detail for that area.

### Build Sequence (dependency order)

Tasks must be executed in this order. Items at the same level can be parallelised.

```
1. Monorepo scaffold
   └── workspace root package.json (workspaces: ["apps/*"]), .gitignore

2. apps/mobile scaffold              ← Expo init + config
   ├── Expo init, metro.config.js, app.config.js, eas.json, .env.local.example
   └── i18n init (src/i18n/en.json, i18next setup)

3. src/providers/                    ← blocks app game logic; parallel with step 2 i18n
   ├── types.ts + interface.ts
   ├── OpenTriviaDbProvider.ts
   └── unit tests

4. Zustand store                     ← blocks all screens
   └── src/state/gameStore.ts (see §Store Shape)

5. Screens — in dependency order:
   a. app/index.tsx (Home)           ← needs store (resume detection, isHydrated)
   b. app/setup.tsx (Game Setup)     ← needs store (startGame) + provider
   c. app/(game)/_layout.tsx         ← needs store (player banner, quit)
   d. app/(game)/handoff.tsx         ← needs store + layout
   e. app/(game)/question.tsx        ← needs store + layout
   f. app/(game)/reveal.tsx          ← needs store + layout
   g. app/(game)/standings.tsx       ← needs store + layout
   h. app/(game)/error.tsx           ← standalone

6. Cross-cutting concerns
   ├── Persistence validation (schema version check on hydration)
   └── "Fewer questions" alert (fired from setup.tsx after fetch)
```

---

### Navigation Graph

Authoritative screen-to-screen transitions. Reference when implementing Expo Router `router.replace` / `router.push` calls.

```
index.tsx
  → setup.tsx                     "New Game" tapped
  → (game)/handoff.tsx            "Resume Game" tapped AND game.players.length > 1
  → (game)/question.tsx           "Resume Game" tapped AND game.players.length === 1 (solo)

setup.tsx
  → (game)/handoff.tsx            Start tapped, questions fetched, multiplayer (players > 1)
  → (game)/question.tsx           Start tapped, questions fetched, solo (players === 1)
  → (game)/error.tsx              fetchQuestions throws TriviaProviderError

(game)/handoff.tsx
  → (game)/question.tsx           "I'm Ready" tapped

(game)/question.tsx
  → (game)/handoff.tsx            Answer recorded; more players remain for this question
                                  (currentPlayerIndex < players.length - 1)
  → (game)/reveal.tsx             Answer recorded; last player answered this question
                                  (currentPlayerIndex === players.length - 1)

(game)/reveal.tsx
  → (game)/handoff.tsx            "Next Question" tapped; more questions remain;
                                  multiplayer (players.length > 1)
  → (game)/question.tsx           "Next Question" tapped; more questions remain; solo
  → (game)/standings.tsx          "Next Question" tapped; no more questions
                                  (currentQuestionIndex === round.questions.length - 1)

(game)/standings.tsx
  → setup.tsx                     (intentionally NOT used — Play Another Round reuses config)
  → (game)/handoff.tsx            "Play Another Round" tapped; new Round appended; multiplayer
  → (game)/question.tsx           "Play Another Round" tapped; new Round appended; solo
  → index.tsx                     "End Session" / "Back to Home" tapped; game state cleared

(game)/error.tsx
  → index.tsx                     "Back to Home" tapped; game state cleared

Any (game)/* screen except standings.tsx
  → index.tsx                     Quit confirmed (confirmation dialog → clear state → navigate)
```

All navigation uses `router.replace` (not `router.push`) for in-game transitions to prevent the back button from re-exposing a question screen after the reveal.

---

### Store Shape

Reference: [data-model.md](./data-model.md) for entity types, [research.md §3](./research.md) for Zustand + AsyncStorage adapter pattern.

**File**: `apps/mobile/src/state/gameStore.ts`

```typescript
// State
interface GameStoreState {
  game: Game | null;
  isHydrated: boolean;        // true once AsyncStorage hydration completes
  isLoading: boolean;         // true while fetchQuestions is in-flight (startGame / startNextRound)
}

// Actions
interface GameStoreActions {
  // Setup
  startGame(config: GameConfig): Promise<void>;  // creates Game + first Round, fetches questions;
                                                  // sets isLoading true/false around the fetch

  // Gameplay
  submitAnswer(answer: string): void;         // records Turn, advances currentPlayerIndex;
                                              // navigates to handoff or reveal (see §Game Loop)
  advanceAfterReveal(): void;                 // called when "Next Question" is tapped on reveal;
                                              // increments currentQuestionIndex then navigates

  // Continuous play
  startNextRound(): Promise<void>;            // resets each player's roundScore to 0,
                                              // appends new Round, fetches new questions

  // Recovery / lifecycle
  quitGame(): void;                           // clears game state
}

// GameConfig — passed to startGame(); setup.tsx manages player list in local component state
interface GameConfig {
  players: Player[];
  questionCount: number;
  category: string | null;      // provider-specific category ID; null = any
  difficulty: Difficulty | null; // null = any
  mode: GameMode;
}
```

**Persistence**: Configured with Zustand `persist` middleware using `createJSONStorage(() => AsyncStorage)` and key `@cirquiz/active_game`. See [research.md §3](./research.md) for the exact adapter pattern.

**`isHydrated` usage**: `index.tsx` must gate its UI on `isHydrated`. Before hydration completes, render a loading/splash state — do not attempt to read `game` yet, as it may not reflect what's in AsyncStorage. The persist middleware sets `isHydrated = true` via its `onRehydrateStorage` callback once the initial load from AsyncStorage is done.

**Provider injection**: The active `TriviaQuestionProvider` is a module-level singleton instantiated once in `gameStore.ts`:
```typescript
import { OpenTriviaDbProvider } from '../providers';
const provider = new OpenTriviaDbProvider();
```
Game logic calls `provider.fetchQuestions(...)` directly inside store actions. This is the concrete decision — no React context needed for the provider itself.

---

### Game Loop Algorithm

Reference: [data-model.md §Round](./data-model.md) for `currentQuestionIndex` and `currentPlayerIndex` invariants.

`submitAnswer(answer: string)` does the following in sequence:

```
1. Derive isCorrect = (answer === currentQuestion.correctAnswer)
2. Append Turn to round.turns
3. Increment player.roundScore if isCorrect
4. Increment player.cumulativeScore if isCorrect

5. if currentPlayerIndex < players.length - 1:
     currentPlayerIndex++
     → navigate to handoff (multiplayer only; solo never reaches this branch)

6. else (last player answered this question):
     currentPlayerIndex = 0
     if currentQuestionIndex === round.questions.length - 1:
       round.state = 'completed'
       game.state = 'completed'
     → navigate to reveal
     (currentQuestionIndex is NOT incremented here; reveal.tsx reads
      round.questions[currentQuestionIndex] — the question just answered)
```

`advanceAfterReveal()` is called when "Next Question" is tapped on `reveal.tsx`:
```
if round.state === 'completed':
  → navigate to standings.tsx
else:
  currentQuestionIndex++
  → navigate to handoff (multiplayer) or question (solo)
```

---

### Game Start Sequence

This is the full sequence from "Start tapped" in `setup.tsx` to "first screen of the game".

```
1. Validate config: at least 1 player, questionCount >= 1
2. Set isLoading = true; setup.tsx reads isLoading from the store to show its loading indicator
3. [Categories already fetched] — setup.tsx called provider.fetchCategories() during its own
   init (when the user opened the Configure mode) and held them in local component state.
   No fetch needed here.
4. Call provider.fetchQuestions({ count, category, difficulty })
   → provider internally requests/reuses OTDB session token on first call (FR-020 nice-to-have)
   → on TriviaProviderError: set isLoading = false; navigate to error.tsx; abort
5. If questions.length < questionCount (but > 0):
   → show Alert with adjusted count message; user dismisses to continue
6. Create Game entity (data-model.md §Game):
   game.state = 'in-progress'
   game.rounds = [new Round with fetched questions]
7. Set isLoading = false
8. Persist to AsyncStorage (Zustand persist fires automatically on state change)
9. Navigate:
   → handoff.tsx if players.length > 1
   → question.tsx if players.length === 1 (solo)
```

---

### `(game)/_layout.tsx` Behaviour

Reference: [spec.md FR-006, FR-014](./spec.md)

- **Active player banner**: Rendered on `handoff.tsx`, `question.tsx`, and `reveal.tsx`. Displays the current player's name in their chosen color. Hidden on `standings.tsx` and `error.tsx` (no "active player" concept at those points).
- **Quit Game button**: A header-right button rendered on `handoff.tsx`, `question.tsx`, `reveal.tsx`, and `error.tsx`. **Hidden on `standings.tsx`** — the game is over; that screen provides its own "Go Home" action alongside "Play Another Round". Tapping Quit shows an `Alert.alert` confirmation: "Quit game? All progress will be lost." → Confirm calls `quitGame()` → navigates to `index.tsx`.
- **Implementation note**: Use Expo Router's `<Stack.Screen options={{ headerRight: ... }} />` inside each screen to control per-screen header customisation, and the `_layout.tsx` `<Stack>` for shared defaults.

---

### Test Strategy

Reference: [research.md §7](./research.md), [spec.md SC-001 through SC-006](./spec.md)

**Mock provider** (`apps/mobile/__tests__/mocks/MockTriviaProvider.ts`; path relative to workspace root):
```typescript
class MockTriviaProvider implements TriviaQuestionProvider {
  constructor(private questions: Question[]) {}
  fetchQuestions(_params: QuestionFetchParams) { return Promise.resolve(this.questions); }
  fetchCategories() { return Promise.resolve([]); }
  supportsCategories() { return false; }
  supportsDifficulty() { return false; }
}
```
Inject via `gameStore.ts` by exporting a `setProviderForTesting(p)` function (test-only escape hatch).

**Required test scenarios** (map to success criteria in [spec.md](./spec.md)):

| Test | Covers | File |
|------|--------|------|
| Full 2-player game completes with correct scores | SC-001 | `__tests__/gameLoop.test.ts` |
| Solo game skips handoff screen | Clarification §2 | `__tests__/soloMode.test.ts` |
| Answer reveal shows each player's chosen answer | SC-001, FR-008 | `__tests__/reveal.test.ts` |
| State persists and hydrates after simulated closure | SC-002 | `__tests__/persistence.test.ts` |
| TriviaProviderError shows error screen | SC-005 | `__tests__/errorHandling.test.ts` |
| Tied scores render without tiebreaker | SC-006 | `__tests__/standings.test.ts` |
| Mock provider swap leaves game logic unchanged | SC-004 | `__tests__/providerContract.test.ts` |

**Provider tests** (`apps/mobile/__tests__/providers/`):
- `OpenTriviaDbProvider.test.ts`: mock `fetch`, test question mapping, HTML decoding, type mapping, error code → `TriviaProviderError` mapping, internal session token request on first call and reuse on subsequent calls.

---

### Utility Decisions

- **HTML decoding**: Use the `he` npm package (`he.decode(str)`). Lightweight, no DOM dependency, works in React Native.
- **Shuffle**: Fisher-Yates in `apps/mobile/src/utils/shuffle.ts`. No external dependency.
- **UUID**: `crypto.randomUUID()` — available in React Native's Hermes engine (Expo SDK 49+). No external dependency.
- **i18n key convention**: Dot-separated, screen-prefixed. Examples: `home.newGame`, `setup.addPlayer`, `game.handoff.ready`, `game.reveal.correct`. All keys defined in `apps/mobile/src/i18n/en.json`.
