# Tasks: AI-Generated Trivia Questions

**Input**: Design documents from `/specs/003-ai-question-gen/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ai-provider.md ✓, quickstart.md ✓

**Tests**: Included per plan.md Phase F requirements (unit tests for questionParser/aiPrompts, integration test for AIQuestionProvider, happy-path tests for P1 journeys).

**Organization**: Tasks are grouped by user story. After Phase 2 completes, each story can be implemented and tested independently using a manually placed model file (see quickstart.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete peer tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- All paths are relative to the monorepo root

---

## Phase 1: Setup (Native Dependencies)

**Purpose**: Install and configure native modules required by all subsequent phases.

- [X] T001 Install `llama.rn` and `@dr.pogodin/react-native-fs` by running `npx expo install llama.rn @dr.pogodin/react-native-fs` from `apps/cirquiz/`
- [X] T002 Configure the llama.rn Expo config plugin with `enableEntitlements: true` and `enableOpenCLAndHexagon: true` in the `plugins` array of `apps/cirquiz/app.json`
- [X] T003 Rebuild native modules: run `pod install` in `apps/cirquiz/ios/`; verify the native build compiles without errors on iOS and Android

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type additions and shared model store that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Add `'ai-generated'` to the `QuestionSource` union type and bump the schema version constant to v2 in `apps/cirquiz/src/state/settingsStore.ts`
- [X] T005 [P] Add `topicPrompt?: string` to the `QuestionFetchParams` interface in `apps/cirquiz/src/providers/types.ts`
- [X] T006 [P] Add `aiTopicPrompt?: string` to `GameConfig` and `aiTopicPrompt: string | null` to the `Game` interface in `apps/cirquiz/src/state/types.ts`
- [X] T007 Update `startGame` and `startNextRound` to read `aiTopicPrompt` from the config/game object and forward it in the `QuestionFetchParams` passed to the provider in `apps/cirquiz/src/state/gameStore.ts`
- [X] T008 [P] Create `modelStore.ts` with `ModelStatus` type (`'not_downloaded' | 'downloading' | 'available' | 'error'`), `ModelStoreState` and `ModelStoreActions` interfaces, and a Zustand store that persists `status` and `modelPath` to AsyncStorage under the `@cirquiz/model` key; `downloadProgress`, `isInitializing`, and `llamaContext` are runtime-only (not persisted); expose `initModel()`, `releaseModel()`, `getContext()`, `_setProgress()`, `_setStatus()`, and `_setModelPath()` actions in `apps/cirquiz/src/state/modelStore.ts`

**Checkpoint**: Foundation ready — all type changes compile and modelStore is created.

---

## Phase 3: User Story 1 — Select AI as Question Source (Priority: P1) 🎯 MVP Entry Point

**Goal**: Users can select "AI Generated" as their question source in settings, see the model status badge, and have the selection persist across app sessions.

**Independent Test**: Select "AI Generated" in settings; verify it shows as selected and displays a model status badge; close and reopen the app; verify "AI Generated" is still selected.

### Implementation for User Story 1

- [X] T009 [US1] Add an "AI Generated" `SelectableRow` entry to the question source section in `apps/cirquiz/app/settings.tsx`
- [X] T010 [US1] Add a model status indicator below the AI Generated row in `apps/cirquiz/app/settings.tsx` displaying all five states driven by `modelStore.status` and `modelStore.isInitializing`: `not_downloaded` → "Model not downloaded" text, `downloading` → "Downloading… X%" progress text, `isInitializing === true` → "Loading model…" spinner (row non-interactive), `available` → "Model ready" text, `error` → "Download failed" text
- [X] T011 [US1] Implement model lifecycle in the settings screen in `apps/cirquiz/app/settings.tsx`: when the user selects the AI row and `modelStore.status === 'available'`, call `modelStore.initModel()` and show the `isInitializing` state until it clears; when the user selects any other source row, call `modelStore.releaseModel()`
- [X] T012 [P] [US1] Add settings i18n keys (`settings.aiGenerated`, `settings.modelStatus.notDownloaded`, `settings.modelStatus.downloading`, `settings.modelStatus.initializing`, `settings.modelStatus.available`, `settings.modelStatus.error`, `settings.downloadModel`, `settings.retryDownload`) to `apps/cirquiz/src/i18n/en.json`

**Checkpoint**: User Story 1 complete — "AI Generated" source appears, persists, and shows model status badge in all states.

---

## Phase 4: User Story 2 — Enter Topic Prompt (Priority: P1)

**Goal**: When the AI source is active, the game setup screen replaces the category selector with a topic prompt text input that validates, persists, and pre-fills the user's entry.

**Independent Test**: With AI source selected (mock `modelStore.status` as `'available'`), navigate to setup; verify topic prompt input is shown instead of category selector; enter fewer than 3 characters and verify inline error appears; enter a valid prompt and verify game start is allowed.

### Implementation for User Story 2

- [X] T013 [US2] Replace the `CategorySelector` component with a topic prompt `TextInput` (using `t('setup.topicPrompt')` as label and `t('setup.topicPromptPlaceholder')` as placeholder) when `questionSource === 'ai-generated'` in `apps/cirquiz/app/setup.tsx`
- [X] T014 [US2] Add minimum-length validation in `apps/cirquiz/app/setup.tsx`: before calling `startGame`, check that the topic prompt is ≥ 3 characters; if not, display the `t('setup.topicPromptTooShort')` error message inline and do not proceed
- [X] T015 [US2] Pre-fill the topic prompt `TextInput` on mount with the last-used prompt value (read from the store or AsyncStorage on mount; write the new value to the store before calling `startGame`) in `apps/cirquiz/app/setup.tsx`
- [X] T016 [P] [US2] Add setup i18n keys (`setup.topicPrompt`, `setup.topicPromptPlaceholder`, `setup.topicPromptTooShort`) to `apps/cirquiz/src/i18n/en.json`

**Checkpoint**: User Story 2 complete — topic prompt input replaces category selector, validates, and pre-fills on AI source.

---

## Phase 5: User Story 3 — Play a Full Game with AI-Generated Questions (Priority: P1)

**Goal**: The AI provider generates structurally valid trivia questions via on-device llama.rn inference, which flow through the existing game loop with a loading state and correct error handling.

**Independent Test**: Using a mocked llama.rn context that returns a valid JSON fixture, start a game with AI source, complete all rounds, and verify scoring and question format match existing providers.

### Tests for User Story 3

- [X] T017 [P] [US3] Write unit tests for `questionParser.ts` covering: valid `GeneratedQuestionRaw[]` input produces a correctly shaped `Question[]`; items with missing/empty fields are discarded; when the valid question count after filtering is below `params.count`, `TriviaProviderError(NO_RESULTS)` is thrown; true-false type requires exactly 1 incorrect answer in `apps/cirquiz/src/providers/aigen/__tests__/questionParser.test.ts`
- [X] T018 [P] [US3] Write unit tests for `aiPrompts.ts` covering: `buildPrompt(topic, count, difficulty)` returns strings containing the topic, count, and difficulty values; `GBNF_GRAMMAR` is a non-empty string that includes the `root`, `question`, `correct_answer`, and `incorrect_answers` rule names in `apps/cirquiz/src/providers/aigen/__tests__/aiPrompts.test.ts`

### Implementation for User Story 3

- [X] T019 [P] [US3] Create `aiPrompts.ts` with `GBNF_GRAMMAR` constant (root array of objects with `question`, `type`, `correct_answer`, `incorrect_answers` fields per the contract grammar) and `buildPrompt(topic: string, count: number, difficulty?: Difficulty): { system: string; user: string }` returning the static system prompt and the dynamic user prompt with topic/count/difficulty interpolated in `apps/cirquiz/src/providers/aigen/aiPrompts.ts`
- [X] T020 [P] [US3] Create `questionParser.ts` implementing `parse(rawJson: string, requestedCount: number): Question[]` that validates each `GeneratedQuestionRaw` item (non-empty question ≤ 300 chars, valid type enum, non-empty correct_answer, exactly 3 incorrect answers for multiple-choice or exactly 1 for true-false, no duplicate answer text), discards invalid items, converts valid items to `Question[]`, and throws `TriviaProviderError(NO_RESULTS)` if valid count is below `requestedCount` in `apps/cirquiz/src/providers/aigen/questionParser.ts`
- [X] T021 [US3] Create `AIQuestionProvider.ts` implementing the full `TriviaQuestionProvider` interface: `fetchQuestions` calls `modelStore.getContext()` (throws `TriviaProviderError(PROVIDER_ERROR)` if null), then calls `context.completion({ messages: [...], grammar: GBNF_GRAMMAR, temperature: 0.2, n_predict: 1024, stop: ['<|end|>', '</s>'] })` using the `messages` format (never `prompt`), passes `result.text` to `questionParser.parse()`, deduplicates against `params.excludeIds`; `cancelFetch` calls `context.stopCompletion()` and detects partial/empty output to throw `TriviaProviderError(USER_CANCELLED)`; `resetSession` clears the internal dedup Set; `fetchCategories` returns `[]`; `supportsCategories` returns `false`; `supportsDifficulty` returns `true` in `apps/cirquiz/src/providers/aigen/AIQuestionProvider.ts`
- [X] T022 [P] [US3] Add the `'ai-generated'` case to the `getProvider()` factory function, returning an `AIQuestionProvider` instance in `apps/cirquiz/src/providers/providerFactory.ts`
- [X] T023 [P] [US3] Add the generation loading state to the game round question display screen (locate via Expo Router from `app/setup.tsx`): when `questionSource === 'ai-generated'` and questions are loading at round start, show `t('game.generatingQuestions')` text, `t('game.generatingQuestionsHint')` subtext, and a Cancel button that calls `provider.cancelFetch()`; use the existing `isLoading`/`ShineButton` pattern to disable the Continue button until generation completes; ensure `gameStore` handles `USER_CANCELLED` by navigating back to setup without showing an error screen
- [X] T024 [P] [US3] Add game i18n keys (`game.generatingQuestions`, `game.generatingQuestionsHint`, `game.cancelGeneration`, `game.error.aiNotReady`, `game.error.aiGenerationFailed`, `game.error.aiInsufficientQuestions`) to `apps/cirquiz/src/i18n/en.json`
- [X] T025 [P] [US3] Write integration test for `AIQuestionProvider.fetchQuestions` with a mocked llama.rn context: success path with a valid JSON fixture returns a `Question[]` of the correct length; a fixture with too few valid items throws `TriviaProviderError(NO_RESULTS)`; calling with a null context (mock `modelStore.getContext()` returning null) throws `TriviaProviderError(PROVIDER_ERROR)` in `apps/cirquiz/src/providers/aigen/__tests__/AIQuestionProvider.test.ts`

**Checkpoint**: User Story 3 complete — AI questions generate and flow through the game loop; all unit tests and integration test pass.

---

## Phase 6: User Story 4 — Play Offline After Model is Available (Priority: P1)

**Goal**: Once the model is on-device, AI question generation and gameplay work with no network connection.

**Independent Test**: Manually place the model file per quickstart.md; enable airplane mode; start a game with AI source; verify questions are generated and the full game completes normally.

### Implementation for User Story 4

- [X] T026 [US4] Add a pre-game guard in `apps/cirquiz/app/setup.tsx` that disables the start button and shows a `t('game.error.aiNotReady')` inline error when `questionSource === 'ai-generated'` and `modelStore.status !== 'available'`, preventing game start when the model is not ready (FR-012)
- [X] T027 [P] [US4] Write a happy-path test verifying that a full multi-round AI-source game (mocked llama.rn context, no network calls) completes all rounds with correct scoring and no errors in `apps/cirquiz/src/__tests__/aiOfflineGame.test.ts`

**Checkpoint**: User Story 4 complete — offline game completes without network; setup screen blocks game start when model unavailable.

---

## Phase 7: User Story 5 — Download and Set Up the On-Device Model (Priority: P2)

**Goal**: First-time users are guided through downloading the model with progress display and can retry on failure; integrity is verified after download.

**Independent Test**: With model `status === 'not_downloaded'`, tap Download in settings; verify progress indicator updates; verify model transitions to `available` after a successful download (simulate with a small fixture file in tests).

### Tests for User Story 5

- [X] T028 [P] [US5] Write a happy-path test verifying that selecting "AI Generated" in settings persists the `questionSource` value to AsyncStorage so that after a simulated app restart, `settingsStore` restores `questionSource === 'ai-generated'` in `apps/cirquiz/src/__tests__/aiSourcePersistence.test.ts`
- [X] T029 [P] [US5] Write a happy-path test verifying that with `modelStore.status === 'available'`, a valid topic prompt, and a mocked provider, calling `gameStore.startGame(config)` transitions the game to the loading/generation state in `apps/cirquiz/src/__tests__/aiGameStart.test.ts`

### Implementation for User Story 5

- [X] T030 [US5] Create `modelDownloadService.ts` wrapping `RNFS.downloadFile` with: 500ms progress interval calling `modelStore._setProgress(bytesWritten / contentLength)`; on completion, compute SHA-256 of the downloaded file and compare against the published Hugging Face checksum — on mismatch, delete the file and call `modelStore._setStatus('not_downloaded')`; on match, call `modelStore._setStatus('available')` and `modelStore._setModelPath(path)`; on retry, call `RNFS.isResumable(jobId)` first and use `RNFS.resumeDownload(jobId)` on iOS or restart from the beginning on Android; check available device storage before initiating download and surface a clear error if storage is insufficient in `apps/cirquiz/src/services/modelDownloadService.ts`
- [X] T031 [US5] Wire the Download button (visible when `modelStore.status === 'not_downloaded'`) and progress display in `apps/cirquiz/app/settings.tsx` to `modelDownloadService.startDownload()` and bind the progress text to `modelStore.downloadProgress`
- [X] T032 [US5] Wire the Cancel button (visible when `modelStore.status === 'downloading'`) to `modelDownloadService.cancelDownload()` and the Retry button (visible when `modelStore.status === 'error'`) to `modelDownloadService.retryDownload()` in `apps/cirquiz/app/settings.tsx`

**Checkpoint**: User Story 5 complete — download progress is visible, cancel/retry work, model transitions to available after successful verified download.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate validation and final acceptance verification across all user stories.

- [X] T033 Run `yarn workspace cirquiz lint`, `yarn workspace cirquiz format:check`, and `yarn workspace cirquiz typecheck` from the monorepo root and resolve all violations across every modified and created file
- [ ] T034 Validate all acceptance scenarios from `specs/003-ai-question-gen/spec.md` against the implementation: US1 scenarios 1–3, US2 scenarios 1–4, US3 scenarios 1–4, US4 scenarios 1–3, US5 scenarios 1–5
- [ ] T035 Run quickstart.md validation: fresh dependency install, `pod install`, manual model file placement, and verify the full AI source flow (settings → setup → game) works on a physical device or simulator

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 (needs `modelStore`, `QuestionSource` change)
- **Phase 4 (US2)**: Depends on Phase 2 — independent of US1
- **Phase 5 (US3)**: Depends on Phase 2 — independent of US1, US2
- **Phase 6 (US4)**: Depends on Phase 5 (US3) — needs `AIQuestionProvider` + setup guard in setup.tsx after T013 exists
- **Phase 7 (US5)**: Depends on Phase 2 and Phase 3 UI (T009–T011 must exist before T031–T032 can wire download buttons into the settings screen)
- **Phase 8 (Polish)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — requires `modelStore.ts` (T008)
- **US2 (P1)**: Starts after Phase 2 — no dependency on US1
- **US3 (P1)**: Starts after Phase 2 — no dependency on US1 or US2
- **US4 (P1)**: Starts after US3 (T021 required for `cancelFetch`; T013 required for setup screen base)
- **US5 (P2)**: Starts after Phase 2; T031–T032 start after US1 (T009–T011)

### Within Each User Story

- Tests (T017, T018) can be written before or alongside implementation tasks T019, T020
- T019 and T020 are independent of each other (different new files)
- T021 depends on T019 + T020 being complete
- T022, T023, T024, T025 all depend on T021 but are independent of each other (different files)

### Parallel Opportunities

- **Phase 2**: T004, T005, T006, T008 run in parallel; T007 starts after T006
- **US3 first wave**: T017, T018, T019, T020 all run simultaneously (all independent new files)
- **US3 second wave** (after T021): T022, T023, T024, T025 all run simultaneously (different files)
- **US5**: T028, T029 (tests) run in parallel with T030 (service implementation)

---

## Parallel Example: User Story 3

```bash
# Wave 1 — All four tasks run simultaneously (independent new files):
Task T017: Write unit tests for questionParser.ts
Task T018: Write unit tests for aiPrompts.ts
Task T019: Create aiPrompts.ts (GBNF grammar + prompt builder)
Task T020: Create questionParser.ts (validation + Question[] conversion)

# Wave 2 — After T021 completes (all four run simultaneously, different files):
Task T022: Add 'ai-generated' case to providerFactory.ts
Task T023: Add generation loading state to game round screen
Task T024: Add game i18n keys to en.json
Task T025: Write AIQuestionProvider integration test
```

---

## Implementation Strategy

### MVP First (P1 Stories: US1–US4)

1. Complete Phase 1: Setup (native install + app.json config)
2. Complete Phase 2: Foundational (type changes + modelStore)
3. Complete Phase 3: US1 — AI source row + model status badge in settings
4. Complete Phase 4: US2 — Topic prompt input in setup
5. Complete Phase 5: US3 — AI provider + game integration + tests
6. Complete Phase 6: US4 — Offline guard + offline happy-path test
7. **STOP and VALIDATE**: Manually place model file per quickstart.md; run through all P1 acceptance scenarios on device
8. Demo / submit for review

### Incremental Delivery

1. Phase 1 + 2 → Types compile; modelStore exists
2. + US1 → AI source selectable in settings with model status badge
3. + US2 → Topic prompt input on setup screen
4. + US3 → AI questions generate and game plays end-to-end (using manually placed model)
5. + US4 → Offline guard confirmed; offline game test passes
6. + US5 → Full in-app download flow for end users
7. Phase 8 → Quality gates + final acceptance sweep

### Parallel Team Strategy

With multiple developers (after Phase 2 complete):

- Developer A: US1 (Phase 3) → US5 wiring (T031–T032)
- Developer B: US2 (Phase 4)
- Developer C: US3 core logic (T019, T020, T021) → US3 integration (T022–T025) → US4 (T026–T027)
- Developer D: US5 service (T030) → US5 tests (T028, T029)

---

## Notes

- [P] tasks operate on different files with no dependencies on incomplete peer tasks at the same dependency level
- [Story] label maps each task to a specific user story for traceability
- Tests are included per plan.md Phase F: unit tests for `questionParser.ts` and `aiPrompts.ts`, integration test for `AIQuestionProvider`, and happy-path tests for P1 journeys
- US1–US4 can all be validated using a manually placed model file — full download flow (US5) is not required for P1 validation
- **`n_gpu_layers: 99` MUST be set in `initLlama()`** — omitting it silently drops to CPU-only throughput (~10–20 tok/s) and will likely exceed the SC-001 30-second target
- **Always use `messages` format, never `prompt`** — Phi-3.5-mini's chat template is embedded in the GGUF and applied automatically; manually formatting `<|system|>` tokens will double-apply the template
- All new user-visible strings must use `t()` calls and be added to `en.json` inline as each phase is implemented — no hardcoded strings at any point
- `en.json` is modified by T012, T016, and T024 across different phases; coordinate these changes to avoid merge conflicts when working in parallel across stories
- Commit after each task or logical group and run quality gates before committing
