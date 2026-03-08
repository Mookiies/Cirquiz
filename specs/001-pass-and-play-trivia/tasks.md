# Tasks: Pass-and-Play Trivia Game

**Feature**: `001-pass-and-play-trivia` | **Branch**: `001-pass-and-play-trivia`
**Input**: Design documents from `/specs/001-pass-and-play-trivia/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/trivia-provider.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.
**Tests**: Not included (not explicitly requested in spec.md). The plan.md §Test Strategy lists required scenarios for post-implementation coverage.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[USN]**: Which user story the task belongs to (US1–US4)
- All navigation uses `router.replace` (not `router.push`) for in-game transitions per plan.md §Navigation Graph

---

## Phase 1: Setup (Monorepo & Expo Scaffold)

**Purpose**: Create the monorepo root, initialize the Expo mobile app with all required dependencies, and confirm the native build runs on the iOS Simulator before any app logic is written.

- [X] T001 Create root package.json defining `"workspaces": ["apps/*"]` with `"name": "cirquiz"` and `"private": true`; update root .gitignore to exclude `node_modules/`, `apps/mobile/.env.local`, `apps/mobile/.env.*.local`, and EAS build artifacts in package.json / .gitignore; create root `.tool-versions` pinning `nodejs 24.3.0` and `yarn 1.22.22` (committed to repo; asdf uses this to activate the correct versions)
- [X] T002 Initialize Expo app at apps/mobile using `npx create-expo-app@latest --template blank-typescript`; install workspace dependencies: `zustand`, `@react-native-async-storage/async-storage`, `expo-localization`, `i18next`, `react-i18next`, `he`; install dev dependency `@types/he` in apps/mobile/package.json
- [X] T003 [P] Configure apps/mobile/metro.config.js with standard Expo default config: `const { getDefaultConfig } = require('expo/metro-config'); module.exports = getDefaultConfig(__dirname);` (no watchFolders needed; provider lives inside the app per research.md §2)
- [X] T004 [P] Create apps/mobile/app.config.js reading `APP_ENV` to set per-environment `name` suffix and `bundleIdentifier`/`package` suffix (development/staging/production) per research.md §9; create apps/mobile/eas.json with three build profiles (development with `developmentClient: true`, preview, production) per research.md §9; create apps/mobile/.env.local.example with placeholder comment (never commit .env.local)
- [ ] T005 Build and install the blank Expo scaffold on the iOS Simulator by running `npx expo run:ios` from apps/mobile (requires Xcode; this compiles native code, links native modules including AsyncStorage, and installs the app bundle on the simulator); confirm the default Expo screen renders without errors; fix any native linking or build errors before proceeding; this also generates the apps/mobile/ios/ directory which is required for all subsequent simulator runs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provider types, interface, utilities, i18n, Zustand store, and root layout — must all be complete before any screen can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Create apps/mobile/src/providers/types.ts defining: `QuestionType = 'multiple-choice' | 'true-false'`, `Difficulty = 'easy' | 'medium' | 'hard'`, `GameMode = 'quick' | 'configured'`, `GameState = 'setup' | 'in-progress' | 'completed'`, `RoundState = 'in-progress' | 'completed'`; `Question`, `Category`, `QuestionFetchParams` interfaces; `TriviaProviderErrorCode` enum with `NetworkError`, `NoResults`, `InvalidParams`, `ProviderError`; `TriviaProviderError` class extending Error per contracts/trivia-provider.md §Error Contract
- [X] T007 [P] Create apps/mobile/src/providers/interface.ts defining the `TriviaQuestionProvider` interface with `fetchQuestions(params: QuestionFetchParams): Promise<Question[]>`, `fetchCategories(): Promise<Category[]>`, `supportsCategories(): boolean`, `supportsDifficulty(): boolean` per contracts/trivia-provider.md §Interface
- [X] T008 [P] Create apps/mobile/src/utils/shuffle.ts implementing Fisher-Yates shuffle as `shuffle<T>(arr: T[]): T[]`; create apps/mobile/src/utils/htmlDecode.ts wrapping `he.decode(str)` for HTML-encoded OTDB question text per plan.md §Utility Decisions
- [X] T009 Create apps/mobile/src/providers/opentdb/otdbTypes.ts for OTDB API response shapes (`OtdbResponse`, `OtdbQuestion`, `OtdbCategoryResponse`); implement apps/mobile/src/providers/opentdb/OpenTriviaDbProvider.ts satisfying `TriviaQuestionProvider`: `fetchQuestions` calls `GET /api.php` with session token lifecycle (request on first call, reset on code 4, reuse otherwise), maps `"multiple"` → `'multiple-choice'` and `"boolean"` → `'true-false'`, HTML-decodes all text via htmlDecode, shuffles options, generates deterministic question IDs; `fetchCategories` calls `GET /api_category.php`; maps OTDB response codes to `TriviaProviderErrorCode` per contracts/trivia-provider.md §Implementation (depends on T006, T007, T008)
- [X] T010 Create apps/mobile/src/providers/index.ts barrel re-exporting `TriviaQuestionProvider`, all types from types.ts, and `OpenTriviaDbProvider` (depends on T009)
- [X] T011 [P] Create apps/mobile/src/i18n/en.json with all user-facing string keys organized by screen prefix: `home.*` (newGame, resumeGame, loading), `setup.*` (addPlayer, start, quickPlay, chooseCategories, playerName, questionCount), `game.handoff.*` (title, ready), `game.question.*` (title), `game.reveal.*` (correct, wrong, nextQuestion, correctAnswer), `game.standings.*` (title, playAnotherRound, endSession, place), `game.error.*` (title, message, backHome), `game.quit.*` (title, message, confirm, cancel); create apps/mobile/src/i18n/index.ts initializing i18next with `initReactI18next`, reading locale from `expo-localization` (`Localization.locale`) as `lng`, `fallbackLng: 'en'` per research.md §5
- [X] T012 Create apps/mobile/src/state/types.ts defining `Player` (id, name, color, roundScore, cumulativeScore), `Game` (id, players, questionCount, category, difficulty, mode, state, rounds, currentRoundIndex), `Round` (id, questions, turns, currentQuestionIndex, currentPlayerIndex, state), `Turn` (playerId, questionId, selectedAnswer, isCorrect), `GameConfig` interfaces per data-model.md; implement apps/mobile/src/state/gameStore.ts with `GameStoreState` (game, isHydrated, isLoading), all `GameStoreActions` (startGame, submitAnswer, advanceAfterReveal, startNextRound, quitGame), Zustand `persist` middleware using `createJSONStorage(() => AsyncStorage)` with key `@cirquiz/active_game`, `onRehydrateStorage` callback setting `isHydrated = true`, provider singleton `new OpenTriviaDbProvider()`, and exported `setProviderForTesting(p: TriviaQuestionProvider)` test escape hatch; implement submitAnswer game loop algorithm and advanceAfterReveal navigation per plan.md §Game Loop Algorithm (depends on T006, T010)
- [X] T013 Create apps/mobile/app/_layout.tsx as Expo Router root layout calling `i18n` init on mount via `useEffect` and rendering a root `<Stack>` navigator with default screen options (no header on root); create apps/mobile/app/(game)/_layout.tsx stub (full implementation in T016) (depends on T011, T012)

**Checkpoint**: Foundation ready — all user story screens can now be implemented.

---

## Phase 3: User Story 1 — Complete a Full Game (Priority: P1) 🎯 MVP

**Goal**: Players set up a game, answer questions in turn with device handoffs in multiplayer, and reach a final standings screen with correct scores.

**Independent Test**: Launch the app, tap New Game, add 2 players, tap Quick Play, complete all questions via handoffs, and verify the final standings screen shows correct scores with no crashes.

- [X] T014 [US1] Implement apps/mobile/app/index.tsx rendering a full-screen loading/splash state while `isHydrated` is false; once hydrated, render a "New Game" button navigating to setup.tsx; no Resume Game button yet (added in T025); use i18n keys `home.*`
- [X] T015 [US1] Implement apps/mobile/app/setup.tsx with: local component state for player list (names, up to 6); Add Player / Remove Player controls; question count numeric input (default 10); Quick Play mode toggle; Start button calling `startGame(config)` store action; loading overlay while `isLoading` is true; on success navigate to `(game)/handoff.tsx` (players.length > 1) or `(game)/question.tsx` (solo); on `TriviaProviderError` navigate to `(game)/error.tsx`; use i18n keys `setup.*`
- [X] T016 [US1] Implement apps/mobile/app/(game)/_layout.tsx with: active player banner showing `game.players[round.currentPlayerIndex].name` and `.color` rendered on handoff, question, and reveal screens (hidden on standings and error); Quit Game header button shown on handoff, question, reveal, and error screens (hidden on standings); Quit button triggers `Alert.alert` confirmation → on confirm call `quitGame()` → navigate to `index` per plan.md §(game)/_layout.tsx Behaviour; use `<Stack.Screen options={{ headerRight: ... }}>` within each screen for per-screen control
- [X] T017 [US1] Implement apps/mobile/app/(game)/handoff.tsx displaying the current player's name and color prominently and an "I'm Ready" button calling `router.replace('/(game)/question')` per navigation graph; use i18n keys `game.handoff.*`
- [X] T018 [US1] Implement apps/mobile/app/(game)/question.tsx displaying the current question text, shuffled answer option buttons (4 for multiple-choice, 2 for true/false), and active player name/color; on answer tap call `submitAnswer(selectedAnswer)` store action (which handles navigation to next handoff or reveal per game loop algorithm); disable options after tap to prevent double submission; use i18n keys `game.question.*`
- [X] T019 [US1] Implement apps/mobile/app/(game)/reveal.tsx displaying: the correct answer highlighted, each player's name + chosen answer + correct/wrong indicator, each player's updated round score; a "Next Question" button calling `advanceAfterReveal()` store action (which navigates to handoff, question, or standings); use i18n keys `game.reveal.*`
- [X] T020 [US1] Implement apps/mobile/app/(game)/standings.tsx displaying all players ranked by cumulative score (joint positions for ties, no tiebreaker); "End Session" button calling `quitGame()` then `router.replace('/')` (navigates to index.tsx); "Play Another Round" button stubbed as disabled (wired in T028); use i18n keys `game.standings.*`
- [X] T021 [US1] Implement apps/mobile/app/(game)/error.tsx displaying a localized error message (passed via route params or read from store) and a "Back to Home" button calling `quitGame()` then `router.replace('/')` per navigation graph; use i18n keys `game.error.*`

**Checkpoint**: User Story 1 complete — verify live with Maestro MCP:
  1. `mcp__maestro__launch_app` → navigate through 2-player Quick Play game
  2. `mcp__maestro__take_screenshot` at each screen (handoff, question, reveal, standings)
  3. Save screenshots to `specs/001-pass-and-play-trivia/verification/us1/`

---

## Phase 4: User Story 2 — Game Setup & Configuration (Priority: P2)

**Goal**: Players configure a new game with names, unique colors, question count, and optional category/difficulty selection before play begins.

**Independent Test**: Open the app, add 3 players with distinct names and colors, choose a category and difficulty, confirm the game starts with the configured settings and the setup screen blocks invalid configurations.

- [X] T022 [US2] Add color selection to apps/mobile/app/setup.tsx — render the 10-color palette from data-model.md (`#E74C3C`, `#3498DB`, `#2ECC71`, `#F39C12`, `#9B59B6`, `#1ABC9C`, `#E91E63`, `#F1C40F`, `#FF5722`, `#00BCD4`) as circular swatches per player; colors already assigned to other players must render as visually disabled (reduced opacity + no-press); auto-assign the first available color when a player is added; pass selected colors in `GameConfig.players` to `startGame`
- [X] T023 [US2] Add category and difficulty selection to apps/mobile/app/setup.tsx — add Quick Play / Choose Categories toggle; when Choose Categories is selected, call `provider.fetchCategories()` (via store or direct provider import) and render a category picker and difficulty selector (Easy / Medium / Hard / Any); pass selected `category` and `difficulty` to `startGame` GameConfig; show loading indicator while categories are fetching (depends on T022)
- [X] T024 [US2] Add form validation to apps/mobile/app/setup.tsx — disable Start button when `players.length === 0`; show inline error if a player name is empty or duplicates an existing player name; after `startGame` resolves with `questions.length < config.questionCount` (but > 0), show a dismissable `Alert.alert` stating the adjusted question count before the first game screen renders per plan.md §"Fewer questions" UX (depends on T023)

**Checkpoint**: User Story 2 complete — verify live with Maestro MCP and save screenshots to `specs/001-pass-and-play-trivia/verification/us2/`

---

## Phase 5: User Story 3 — Game Persistence & Recovery (Priority: P3)

**Goal**: An in-progress game is automatically saved and can be resumed after the app is closed, backgrounded, or the device locks.

**Independent Test**: Start a game, answer one question, fully close and reopen the app — confirm the Resume Game button appears and the game resumes at the correct screen with scores intact.

- [X] T025 [US3] Update apps/mobile/app/index.tsx to render a "Resume Game" button alongside "New Game" when `game !== null && game.state === 'in-progress'` (only after `isHydrated` is true); on tap navigate to `(game)/handoff.tsx` if `game.players.length > 1` or `(game)/question.tsx` if solo per plan.md §Navigation Graph; use i18n key `home.resumeGame`
- [X] T026 [US3] Add schema version validation to apps/mobile/src/state/gameStore.ts — define `CURRENT_SCHEMA_VERSION = 1`; in the Zustand persist `onRehydrateStorage` callback, check the rehydrated state's `version` field; if missing or less than `CURRENT_SCHEMA_VERSION`, call `quitGame()` to discard stale state gracefully; add `version: number` and `savedAt: string` (ISO 8601, set on every state write) to the persisted state shape per data-model.md §PersistedGameState

**Checkpoint**: User Story 3 complete — verify live with Maestro MCP and save screenshots to `specs/001-pass-and-play-trivia/verification/us3/`

---

## Phase 6: User Story 4 — Continuous Play / Play Another Round (Priority: P4)

**Goal**: At the end of a round, players start another round retaining the same players, cumulative scores, and game settings without re-entering setup.

**Independent Test**: Complete a full game, tap Play Another Round, answer all questions, and verify cumulative scores accumulate correctly across both rounds with the same players and settings.

- [X] T027 [US4] Implement `startNextRound(): Promise<void>` store action in apps/mobile/src/state/gameStore.ts — reset each `player.roundScore` to 0 (cumulative scores are preserved), append a new Round to `game.rounds`, increment `game.currentRoundIndex`, fetch new questions via `provider.fetchQuestions({ count: game.questionCount, category: game.category, difficulty: game.difficulty, excludeIds: previousQuestionIds })` for FR-020 nice-to-have, set `game.state = 'in-progress'`, toggle `isLoading` around the fetch; on `TriviaProviderError` navigate to `(game)/error.tsx` per plan.md §Store Shape
- [X] T028 [US4] Wire the "Play Another Round" button in apps/mobile/app/(game)/standings.tsx to call `startNextRound()` store action and navigate to `(game)/handoff.tsx` (multiplayer) or `(game)/question.tsx` (solo) on success; show loading indicator while `isLoading` is true (depends on T027, T020)
- [X] T029 [P] [US4] Update apps/mobile/app/(game)/reveal.tsx to show each player's cumulative score (total across all rounds) alongside their round score; update apps/mobile/app/(game)/standings.tsx to show per-round breakdown in addition to cumulative totals per plan.md §Score display by screen

**Checkpoint**: User Story 4 complete — verify live with Maestro MCP and save screenshots to `specs/001-pass-and-play-trivia/verification/us4/`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Shared components, custom hooks, and final validation across all user stories.

- [X] T030 [P] Create custom store selector hooks in apps/mobile/src/hooks/useGame.ts (returns `{ game, isHydrated, isLoading }`), apps/mobile/src/hooks/useCurrentPlayer.ts (returns current player from `game.players[round.currentPlayerIndex]`), apps/mobile/src/hooks/useCurrentQuestion.ts (returns current question from `round.questions[round.currentQuestionIndex]`); refactor screens to use these hooks instead of repeated direct store selectors
- [X] T031 [P] Create shared presentational components in apps/mobile/src/components/: `PlayerBadge.tsx` (renders player name + color chip used by active player banner and reveal screen), `AnswerButton.tsx` (selectable answer option with selected/unselected states used by question.tsx), `ScoreRow.tsx` (player name + score row used by reveal.tsx and standings.tsx); extract from inline screen code
- [X] T032 Run quickstart.md validation — `yarn install` from repo root, `cd apps/mobile && yarn test` (confirm all test suites pass), `npx tsc --noEmit` (confirm no TypeScript errors); fix any issues found before marking complete
- [ ] T033 Rebuild and reinstall the fully-implemented app on the iOS Simulator by running `npx expo run:ios` from apps/mobile; wait for Metro to start and the app to install; manually navigate through the full flow (New Game → add 2 players → Quick Play → handoff → question → answer → reveal → complete all questions → standings) to confirm every screen renders correctly; fix any runtime or build errors before running Maestro automated flows in T034
- [ ] T034 [P] Maestro live verification — use `mcp__maestro__launch_app` to open the app on the already-running iOS Simulator (prerequisite: T033 complete); run a full 2-player 5-question game flow using `mcp__maestro__run_flow`, take screenshots at each screen transition using `mcp__maestro__take_screenshot`, run solo mode flow and persistence recovery flow, save all screenshots and flow results to `specs/001-pass-and-play-trivia/verification/` per constitution check Principle V (must complete before merge)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Phase 2 only — P1 MVP
- **User Story 2 (Phase 4)**: Depends on Phase 2; integrates with Phase 3 screens
- **User Story 3 (Phase 5)**: Depends on Phase 2 + Phase 3 (T014 for index.tsx, T012 for store)
- **User Story 4 (Phase 6)**: Depends on Phase 2 + Phase 3 (T020, T012 for store)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|-----------|---------------------|
| US1 (P1) | Phase 2 complete | — (first story) |
| US2 (P2) | Phase 2 complete + US1 screens (T015) | US3 (different files) |
| US3 (P3) | Phase 2 complete + US1 (T014, T012) | US2 (different files) |
| US4 (P4) | Phase 2 complete + US1 (T020, T012) | US2, US3 (different files) |

### Within Each User Story

- Screens depend on the store and root layout (Phase 2 complete)
- Screens are independent of each other except for navigation flow (can be parallelized)
- US2 tasks T022 → T023 → T024 must be sequential (same file, each depends on previous)

### Parallel Opportunities

Within Phase 1: T003 and T004 can run in parallel (different files).
Within Phase 2: T006, T007, T008, T011 can all run in parallel. T009 depends on T006/T007/T008. T010 depends on T009. T012 depends on T006/T010. T013 depends on T011/T012.
Within Phase 3 (after T016): T017, T018, T019, T020, T021 can run in parallel (different files).
Within Phase 6: T029 can run in parallel with T027/T028.
Within Phase 7: T030, T031 can run in parallel. T034 requires T033 first.

---

## Parallel Example: User Story 1 Screens (after T016 complete)

```
# These screens have no shared-file dependencies — run in parallel:
T017: apps/mobile/app/(game)/handoff.tsx
T018: apps/mobile/app/(game)/question.tsx
T019: apps/mobile/app/(game)/reveal.tsx
T020: apps/mobile/app/(game)/standings.tsx
T021: apps/mobile/app/(game)/error.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T013) — **CRITICAL: blocks everything**
3. Complete Phase 3: User Story 1 (T014–T021)
4. **STOP and VALIDATE**: 2-player Quick Play game from start to standings
5. Verify with Maestro MCP — screenshot evidence required before continuing

### Incremental Delivery

1. Setup + Foundational → Foundation ready (T001–T013)
2. User Story 1 → Core game loop works → Validate (T014–T021)
3. User Story 2 → Full setup configuration → Validate (T022–T024)
4. User Story 3 → Persistence + resume → Validate (T025–T026)
5. User Story 4 → Continuous play → Validate (T027–T029)
6. Polish → Hooks, components, final verification (T030–T034)

---

## Notes

- All navigation uses `router.replace` (not `router.push`) to prevent back-button re-exposure of answered questions
- The Zustand store owns navigation in `submitAnswer` and `advanceAfterReveal` — import `router` from `expo-router` inside store actions
- Provider is a module-level singleton in `gameStore.ts`; `setProviderForTesting()` allows test injection without modifying game logic
- `isHydrated` must be checked before reading `game` in `index.tsx` — AsyncStorage hydration is async
- All user-facing strings must use i18n keys from `en.json` — no hardcoded English strings in components
- Use `router.replace` consistently for all in-game screen transitions (handoff → question → reveal → standings)
- Commit after each task or logical group to keep history clean and reversible
- T005 and T033 both run `npx expo run:ios` — T005 verifies the scaffold, T033 verifies the finished app; both require Xcode and an iOS Simulator running
