# Implementation Plan: AI-Generated Trivia Questions

**Branch**: `003-ai-question-gen` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)

## Summary

Add "AI Generated" as a third question source for Cirquiz, using an on-device language model (Phi-3.5-mini-instruct via `llama.rn`) to generate factually accurate trivia questions from a free-form user topic prompt. Questions are generated on-demand at the start of each round, matching the existing provider interface. Model download management (progress, retry, integrity check) is included in this feature. The feature is fully offline once the model is downloaded.

---

## Technical Context

**Language/Version**: TypeScript ~5.9, React Native 0.83.2, React 19.2.0
**Primary Dependencies**:
- `llama.rn` — on-device LLM inference (llama.cpp bindings); GBNF grammar for structured output
- `@dr.pogodin/react-native-fs` — large file download with progress; streams to disk (no background download; app must stay open, same approach as pocketpal-ai)
- Zustand ^5 — new `modelStore` for download state
- `@react-native-async-storage/async-storage` — model path + status persistence

**Storage**: AsyncStorage (`@cirquiz/model` key for model state; existing `@cirquiz/settings` key for source preference)
**Testing**: Jest + React Native Testing Library (existing setup)
**Target Platform**: iOS 16+ (New Architecture required for llama.rn), Android (API 24+)
**Project Type**: Mobile app (Expo SDK 55, bare workflow)
**Performance Goals**: Question generation ≤ 30 seconds per round on iPhone 12 class device (SC-001); this intentionally exceeds the constitution's <2s target — see Constitution Check exception below
**Constraints**: Model file ~2.39 GB on-device storage; offline after download; no API keys required
**Scale/Scope**: Single-user, local device; model loaded once per app session

---

## Constitution Check

*GATE: Must pass before implementation begins.*

### I. Code Quality ✅
- `AIQuestionProvider`, `questionParser`, `aiPrompts`, `modelDownloadService`, and `modelStore` each have a single responsibility matching the existing file-per-concern convention
- No duplication: GBNF grammar lives in one place (`aiPrompts.ts`); parser lives in one place (`questionParser.ts`)
- Lint and format gates enforced per CLAUDE.md before every commit

### II. Testing Standards ✅
- P1 journeys that need happy-path tests:
  - **P1-1**: User selects "AI Generated" source in settings → persists across sessions
  - **P1-2**: User enters topic prompt → game starts → AI questions are generated → game completes
  - **P1-3**: Offline game with downloaded model completes without network
- Tests written alongside implementation, not after

### III. UX Consistency ✅
- Model status badge in settings follows existing `SelectableRow` design language
- Topic prompt input follows existing text input conventions (see `AnimatedPlayerRow` name input)
- Loading state during generation uses existing `isLoading` / `ShineButton` loading prop pattern
- Error messages use existing `TriviaProviderError` + error screen pattern
- All new strings go through i18next (existing `en.json`)

### IV. Performance — EXCEPTION DOCUMENTED ⚠️
- **Exception**: AI question generation takes up to 30 seconds per round (SC-001) — this exceeds the constitution's <2s primary interaction target
- **Rationale**: Inference latency on an on-device LLM is hardware-bounded. There is no architectural change that reduces this without changing the model (smaller model = worse accuracy, violating SC-006)
- **Mitigation**: A loading indicator is shown for the full generation duration; users are aware they are waiting for AI generation. This is analogous to a slow network fetch and uses the same loading UX pattern.
- **Non-regression**: Existing provider flows (OTDB, The Trivia API) are not affected

---

## Project Structure

### Documentation (this feature)

```text
specs/003-ai-question-gen/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: library + model + download decisions
├── data-model.md        # Phase 1: type changes + new entities
├── quickstart.md        # Phase 1: dev setup guide
├── contracts/
│   └── ai-provider.md   # Phase 1: provider interface contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
apps/cirquiz/
  src/
    providers/
      types.ts                        # MODIFY: add topicPrompt to QuestionFetchParams
      providerFactory.ts              # MODIFY: add 'ai-generated' case
      aigen/                          # NEW directory
        AIQuestionProvider.ts         # NEW: implements TriviaQuestionProvider
        aiPrompts.ts                  # NEW: GBNF grammar + prompt template builder
        questionParser.ts             # NEW: validates LLM output → Question[]
    state/
      settingsStore.ts                # MODIFY: add 'ai-generated' to QuestionSource; bump version
      types.ts                        # MODIFY: add aiTopicPrompt to GameConfig + Game
      gameStore.ts                    # MODIFY: thread aiTopicPrompt through startGame/startNextRound
      modelStore.ts                   # NEW: Zustand store for model download state
    services/
      modelDownloadService.ts         # NEW: wraps @dr.pogodin/react-native-fs (RNFS.downloadFile)
    i18n/
      en.json                         # MODIFY: new settings/setup/error keys
  app/
    settings.tsx                      # MODIFY: add AI source row + model status + download UI
    setup.tsx                         # MODIFY: topic prompt input (replaces CategorySelector for AI)
```

**Structure Decision**: Single mobile app project (Option 1/3 hybrid — mobile-only, no backend). All new code in the existing `apps/cirquiz/src/` tree, following established provider / state / service layering.

---

## Out of Scope

- **User-selectable models**: Allowing users to choose between multiple GGUF models (e.g., Phi-3.5-mini vs SmolLM2) is deferred to a future feature. The `modelStore` and `AIQuestionProvider` are intentionally designed around a single model to keep this feature scoped. The architecture (one store entry per model, provider reads `modelPath`) can be extended to multi-model without breaking changes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Question generation >2s (Constitution IV) | On-device LLM inference is hardware-bounded; Phi-3.5-mini generates ~10–20 tok/s on iPhone 12 | Smaller/faster model has ~9% worse MMLU accuracy, violating SC-006 (≥95% factual correctness target) |

---

## Implementation Sequence

### Phase A — Foundation (no UI, no native)
1. Add `'ai-generated'` to `QuestionSource`; bump `settingsStore` schema version (v2)
2. Add `topicPrompt?: string` to `QuestionFetchParams`
3. Add `aiTopicPrompt` to `GameConfig` and `Game` in `state/types.ts`
4. Update `gameStore.startGame` and `startNextRound` to read + pass `aiTopicPrompt`
5. Install `llama.rn` and `@dr.pogodin/react-native-fs`; verify native build

### Phase B — AI Provider (core logic, testable in isolation)
6. Create `aiPrompts.ts` — GBNF grammar string + `buildPrompt(topic, count, difficulty)` function
7. Create `questionParser.ts` — validates `GeneratedQuestionRaw[]` → `Question[]`, throws `TriviaProviderError(NO_RESULTS)` if count insufficient
8. Create `AIQuestionProvider.ts` — implements full `TriviaQuestionProvider` interface using llama.rn
9. Add `'ai-generated'` case to `providerFactory.ts`

### Phase C — Model Download (state + service)
10. Create `modelStore.ts` — Zustand store with `status`, `downloadProgress`, `modelPath`; persisted to `@cirquiz/model`
11. Create `modelDownloadService.ts` — wraps background downloader; fires `modelStore` actions for progress + completion; runs SHA-256 integrity check on completion

### Phase D — Settings UI
12. Add "AI Generated" `SelectableRow` to `settings.tsx`
13. Add model status indicator below the AI row (badge: not downloaded / downloading with % / ready / error)
14. Add Download / Retry button that calls `modelDownloadService`
15. Add download size display (~2.4 GB) shown before first download

### Phase E — Setup UI
16. In `setup.tsx`, when `questionSource === 'ai-generated'`, replace the `CategorySelector` with a topic prompt `TextInput`
17. Validate minimum prompt length (≥ 3 chars) before calling `startGame`; show inline error message
18. Pre-fill last-used prompt from `settingsStore` or a dedicated persisted value

### Phase F — i18n + Polish
19. Add all new i18n keys to `en.json`
20. Replace any hardcoded strings from D/E with `t()` calls

### Phase G — Testing
21. Unit tests: `questionParser.ts` (valid input, malformed input, insufficient count)
22. Unit tests: `aiPrompts.ts` (prompt shape, grammar string structure)
23. Integration test: `AIQuestionProvider.fetchQuestions` with a mocked llama.rn context
24. Happy-path tests for P1 journeys (settings selection persists, game starts with AI source, error screen on generation failure)
