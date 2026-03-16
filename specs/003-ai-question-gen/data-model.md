# Data Model: AI-Generated Trivia Questions

**Feature**: 003-ai-question-gen
**Date**: 2026-03-15

---

## Modified Types

### `QuestionSource` (settingsStore.ts)

```ts
// Before
type QuestionSource = 'otdb' | 'the-trivia-api';

// After
type QuestionSource = 'otdb' | 'the-trivia-api' | 'ai-generated';
```

### `QuestionFetchParams` (providers/types.ts)

```ts
interface QuestionFetchParams {
  count: number;
  category?: string;        // existing — ignored by AI provider
  difficulty?: Difficulty;  // existing — passed to AI via prompt
  excludeIds?: string[];    // existing — AI provider uses for deduplication
  topicPrompt?: string;     // NEW — required when source is 'ai-generated'
}
```

### `GameConfig` (state/types.ts)

```ts
interface GameConfig {
  players: { name: string; avatar: string }[];
  questionCount: number;
  category?: string;
  difficulty?: Difficulty;
  mode: GameMode;
  aiTopicPrompt?: string;  // NEW — set when source is 'ai-generated'
}
```

### `Game` (state/types.ts)

```ts
interface Game {
  id: string;
  players: Player[];
  questionCount: number;
  category: string | null;
  difficulty: Difficulty | null;
  mode: GameMode;
  state: GameState;
  rounds: Round[];
  currentRoundIndex: number;
  aiTopicPrompt: string | null;  // NEW — persisted for cross-round consistency
}
```

---

## New Types

### `ModelStatus` (state/modelStore.ts)

```ts
type ModelStatus = 'not_downloaded' | 'downloading' | 'available' | 'error';
```

State transitions:

```
not_downloaded ──[user initiates download]──► downloading
downloading    ──[completes + integrity OK]──► available
downloading    ──[fails / interrupted]───────► error
error          ──[user retries]──────────────► downloading
available      ──[file missing/corrupted*]──► not_downloaded
```

*Corruption detected at download-completion integrity check only (not at game time).

### `ModelStoreState` (state/modelStore.ts)

```ts
interface ModelStoreState {
  status: ModelStatus;
  downloadProgress: number;        // 0.0–1.0; runtime only, not persisted
  modelPath: string | null;        // absolute path on device; persisted
  isInitializing: boolean;         // true while initLlama() is in progress; runtime only
  llamaContext: LlamaContext | null; // runtime only, not persisted
}

interface ModelStoreActions {
  startDownload: () => Promise<void>;
  cancelDownload: () => void;
  retryDownload: () => Promise<void>;
  initModel: () => Promise<void>;  // called by settingsStore when 'ai-generated' selected
  releaseModel: () => Promise<void>; // called by settingsStore when switching away from AI source
  getContext: () => LlamaContext | null; // called by AIQuestionProvider.fetchQuestions
  _setProgress: (progress: number) => void;   // internal, called by download service
  _setStatus: (status: ModelStatus) => void;  // internal
  _setModelPath: (path: string | null) => void; // internal
}
```

**Persistence**: `status` and `modelPath` are persisted to AsyncStorage under `@cirquiz/model`. `downloadProgress`, `isInitializing`, and `llamaContext` are runtime-only and reset on app restart.

### `GeneratedQuestionRaw` (providers/aigen/questionParser.ts — internal)

The intermediate shape parsed from LLM JSON output before validation and conversion to `Question`:

```ts
interface GeneratedQuestionRaw {
  question: string;
  type: 'multiple-choice' | 'true-false';
  correct_answer: string;
  incorrect_answers: string[];
}
```

Validation rules (enforced by `questionParser.ts`):
- `question`: non-empty string, ≤ 300 characters
- `type`: must be `'multiple-choice'` or `'true-false'`
- `correct_answer`: non-empty string
- `incorrect_answers`: for `multiple-choice` must have exactly 3 items; for `true-false` must have exactly 1 item (the opposite of correct_answer)
- No duplicate text between `correct_answer` and any `incorrect_answer`

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/state/modelStore.ts` | Zustand store for model download state |
| `src/services/modelDownloadService.ts` | Wraps download library; handles progress, retry, integrity |
| `src/providers/aigen/AIQuestionProvider.ts` | Implements `TriviaQuestionProvider` using llama.rn |
| `src/providers/aigen/aiPrompts.ts` | GBNF grammar definition + prompt template builder |
| `src/providers/aigen/questionParser.ts` | Validates/converts raw LLM output to `Question[]` |

---

## Modified Files Summary

| File | Change |
|------|--------|
| `src/providers/types.ts` | Add `topicPrompt?: string` to `QuestionFetchParams` |
| `src/providers/providerFactory.ts` | Add `'ai-generated'` case |
| `src/state/settingsStore.ts` | Add `'ai-generated'` to `QuestionSource`; bump schema version |
| `src/state/types.ts` | Add `aiTopicPrompt` to `GameConfig` and `Game` |
| `src/state/gameStore.ts` | Pass `aiTopicPrompt` through `startGame` / `startNextRound`; update `Game` init |
| `app/settings.tsx` | Add AI source `SelectableRow` + model status indicator |
| `app/setup.tsx` | Add topic prompt input when `questionSource === 'ai-generated'` |
| `src/i18n/en.json` | New i18n keys (see below) |

---

## New i18n Keys

```json
{
  "settings": {
    "aiGenerated": "AI Generated",
    "modelStatus": {
      "notDownloaded": "Model not downloaded",
      "downloading": "Downloading… {{percent}}%",
      "initializing": "Loading model…",
      "available": "Model ready",
      "error": "Download failed"
    },
    "downloadModel": "Download Model (~2.4 GB)",
    "retryDownload": "Retry Download"
  },
  "setup": {
    "topicPrompt": "Topic",
    "topicPromptPlaceholder": "e.g. Ancient Rome, 80s pop music…",
    "topicPromptTooShort": "Please enter a more specific topic"
  },
  "game": {
    "generatingQuestions": "Generating questions…",
    "generatingQuestionsHint": "This may take up to 30 seconds",
    "cancelGeneration": "Cancel",
    "error": {
      "aiNotReady": "AI model is not available. Please download it in Settings.",
      "aiGenerationFailed": "Could not generate questions. Try a more specific topic.",
      "aiInsufficientQuestions": "Not enough questions could be generated. Try a different topic."
    }
  }
}
```
