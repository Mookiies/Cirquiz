# Tasks: Question Source Selection

**Input**: Design documents from `/specs/002-provider-settings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths are relative to the monorepo root

---

## Phase 1: Setup

No project initialization needed — all dependencies (`@react-native-async-storage/async-storage`, `zustand`, `react-native-reanimated`, etc.) are already installed. No new packages required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New provider implementation and factory — required by all three user stories before any story work can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Create `apps/cirquiz/src/providers/thetriviaapi/triviaApiTypes.ts` with TypeScript types for The Trivia API v2 response shape (`TriviaApiQuestion`, `TriviaApiResponse`)
- [X] T002 Implement `apps/cirquiz/src/providers/thetriviaapi/TheTriviaApiProvider.ts` — `fetchQuestions` (GET `/v2/questions` with `limit`, `categories`, `difficulties` params + response mapping), `fetchCategories` (hardcoded 10-entry array), `supportsCategories` → `true`, `supportsDifficulty` → `true`, `resetSession` → no-op
- [X] T003 Write `apps/cirquiz/src/providers/thetriviaapi/__tests__/TheTriviaApiProvider.test.ts` — unit tests covering HTTP fetch and response mapping, `fetchCategories` returns all 10 categories, `supportsCategories`/`supportsDifficulty` return `true`, `resetSession` is a no-op, error handling for failed fetch
- [X] T004 Create `apps/cirquiz/src/providers/providerFactory.ts` with `getProvider(source: QuestionSource): TriviaQuestionProvider` — module-scoped singleton per source key; export `setProviderForTesting(source, provider)` for test injection
- [X] T005 [P] Update `apps/cirquiz/src/providers/index.ts` to export `TheTriviaApiProvider` and `getProvider`

**Checkpoint**: Foundation ready — `TheTriviaApiProvider` and `getProvider` factory are available for all user story phases.

---

## Phase 3: User Story 1 — Select a Question Source (Priority: P1) 🎯 MVP

**Goal**: Users can open a settings screen from the home or setup screen, switch between Open Trivia Database and The Trivia API, and the selected source is used for all subsequent games.

**Independent Test**: Open the app, access settings from the home screen, switch the question source to The Trivia API, start a new game, and verify that questions are successfully fetched and the game runs to completion.

### Implementation for User Story 1

- [X] T006 [P] [US1] Add `settings.*` translation keys to `apps/cirquiz/src/i18n/en.json` — `title`, `questionSource`, `otdb`, `theTriviaApi`, `categoryResetNotice`
- [X] T007 [US1] Create `apps/cirquiz/src/state/settingsStore.ts` — export `QuestionSource` type (`'otdb' | 'the-trivia-api'`), create Zustand store with `questionSource: QuestionSource` (default `'otdb'`) and `setQuestionSource` action (in-memory only; persistence added in US2)
- [X] T008 [US1] Update `apps/cirquiz/src/state/gameStore.ts` — remove module-level `let provider = new OpenTriviaDbProvider()`; resolve provider via `getProvider(useSettingsStore.getState().questionSource)` at call time inside `startGame`, `retryFetch`, and `startNextRound`
- [X] T009 [US1] Update `apps/cirquiz/src/state/__tests__/gameStore.test.ts` — add test: call `setProviderForTesting('the-trivia-api', mockProvider)`, set `questionSource` to `'the-trivia-api'`, call `startGame`, assert mock `TheTriviaApiProvider` was used to fetch questions
- [X] T010 [US1] Create `apps/cirquiz/app/settings.tsx` — dedicated settings screen using `GradientScreen` + `SelectableRow` for OTDB and The Trivia API rows, active source indicator (checked/selected state), calls `setQuestionSource` on tap, back navigation via `router.back()`
- [X] T011 [P] [US1] Add gear `IconButton` to `apps/cirquiz/app/index.tsx` that calls `router.push('/settings')`
- [X] T012 [P] [US1] Add gear `IconButton` to `apps/cirquiz/app/setup.tsx` (header area, alongside existing controls) that calls `router.push('/settings')`

**Checkpoint**: User Story 1 complete — verify: settings opens from home and setup, source switches to The Trivia API, new game fetches TTA questions, back navigation returns to the originating screen.

---

## Phase 4: User Story 2 — Source Preference Persists (Priority: P2)

**Goal**: The selected question source survives app close and reopen; defaults to Open Trivia Database on first install.

**Independent Test**: Select The Trivia API in settings, fully close the app, reopen it, and verify the settings screen still shows The Trivia API as the active source without any user action.

### Implementation for User Story 2

- [X] T013 [US2] Update `apps/cirquiz/src/state/settingsStore.ts` — wrap store with Zustand `persist` middleware using `createJSONStorage(() => AsyncStorage)` at key `@cirquiz/settings`; add `isHydrated: boolean` to state; exclude `isHydrated` from persisted partials (same pattern as `gameStore.ts`)
- [X] T014 [US2] Write `apps/cirquiz/src/state/__tests__/settingsStore.test.ts` — tests for default value (`'otdb'`), `setQuestionSource` updates state, `isHydrated` is `false` before rehydration and `true` after, and persisted value is restored on re-init (mock AsyncStorage)

**Checkpoint**: User Story 2 complete — verify: select TTA, close app, reopen, settings shows TTA; fresh install / cleared storage defaults to OTDB.

---

## Phase 5: User Story 3 — Setup Adapts to Selected Source (Priority: P3)

**Goal**: The category list in game setup reflects the active provider's categories; switching source while setup is open clears the selected category and shows a brief toast notice.

**Independent Test**: Select The Trivia API, navigate to game setup and open the category selector — verify only The Trivia API's 10 categories are shown. Switch back to OTDB and verify the list updates to OTDB's categories.

### Implementation for User Story 3

- [X] T015 [US3] Update `apps/cirquiz/src/hooks/useCategoryLoader.ts` — replace hardcoded `new OpenTriviaDbProvider()` with `getProvider(useSettingsStore.getState().questionSource)` so categories load from the active provider; re-fetch when `questionSource` changes
- [X] T016 [US3] Update `apps/cirquiz/app/setup.tsx` — observe `questionSource` from `useSettingsStore` in a `useEffect`; when source changes and a category is currently selected, clear it and display a brief non-blocking toast notice

**Checkpoint**: User Story 3 complete — verify: TTA active → setup shows 10 TTA categories; OTDB active → setup shows OTDB categories; changing source while setup is open clears selected category and shows toast.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 Run quality gates from monorepo root: `yarn workspace cirquiz lint && yarn workspace cirquiz format:check && yarn workspace cirquiz typecheck` — resolve all errors
- [X] T018 Validate all US1 acceptance scenarios from `specs/002-provider-settings/quickstart.md` — confirm navigation flow, source switching, and full-game completion with both providers

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks — proceed to Phase 2 immediately
- **Foundational (Phase 2)**: No prior dependencies — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion (T001–T005)
- **US2 (Phase 4)**: Depends on US1 (T007 must exist before T013 extends it)
- **US3 (Phase 5)**: Depends on Phase 2 (T004 for `getProvider`) and US1 (T007 for `useSettingsStore`)
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: Unblocked after Phase 2 completes
- **US2 (P2)**: Extends `settingsStore.ts` created in T007 — must follow US1
- **US3 (P3)**: Requires `getProvider` (T004) and `useSettingsStore` (T007) — can start after Phase 2 and T007

### Within Each Phase

- T001 → T002 (types before implementation)
- T002 → T003 (or parallel — test can be written against the interface)
- T002 → T004 (provider before factory)
- T006 → T010 (i18n keys before settings screen UI)
- T007 → T008 (store before gameStore integration)
- T008 → T009 (gameStore implementation before its test)
- T007 → T010 (store before settings screen)
- T011 and T012 are parallel (different files)
- T007 → T013 (in-memory store before adding persistence)
- T015 → T016 (category loader before setup observes source changes)

---

## Parallel Example: User Story 1

```bash
# After T006 and T007 complete, these can run in parallel:
T011: "Add gear IconButton to apps/cirquiz/app/index.tsx"
T012: "Add gear IconButton to apps/cirquiz/app/setup.tsx"

# T006 can run in parallel with T007 (different files):
T006: "Add settings.* keys to apps/cirquiz/src/i18n/en.json"
T007: "Create apps/cirquiz/src/state/settingsStore.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (`TheTriviaApiProvider` + factory)
2. Complete Phase 3: User Story 1 (settings screen + navigation + `gameStore` integration)
3. **STOP and VALIDATE**: Switch source to The Trivia API, play a full game, verify TTA questions are served
4. Demo / ship if ready

### Incremental Delivery

1. **Phase 2** → Provider + factory ready
2. **US1** → Settings screen, source switching, both providers work → **MVP**
3. **US2** → Source preference persists across sessions
4. **US3** → Category list adapts to active provider + toast on change

---

## Notes

- No new packages needed; all dependencies are already installed in the monorepo
- `setProviderForTesting` export from `providerFactory.ts` keeps test injection clean and separate from production routing
- US2 is a minimal incremental change to the store created in US1 (add `persist` middleware)
- US3 can be developed in parallel with US2 once Phase 2 and T007 are done
- Run quality gates (`lint`, `format:check`, `typecheck`) after each phase checkpoint before committing
