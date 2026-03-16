# Contract: AIQuestionProvider

**Feature**: 003-ai-question-gen
**Date**: 2026-03-15

---

## Interface Implemented

`AIQuestionProvider` implements the existing `TriviaQuestionProvider` interface unchanged:

```ts
interface TriviaQuestionProvider {
  fetchQuestions(params: QuestionFetchParams): Promise<Question[]>;
  fetchCategories(): Promise<Category[]>;
  supportsCategories(): boolean;
  supportsDifficulty(): boolean;
  resetSession(): void;
  cancelFetch(): void;
}
```

---

## Method Contracts

### `fetchQuestions(params)`

| Aspect | Behavior |
|--------|----------|
| `params.topicPrompt` | Required. If missing or below minimum length, throws `TriviaProviderError(INVALID_PARAMS)` |
| `params.count` | Number of questions to generate. Must be ≥ 1. |
| `params.difficulty` | Optional. Passed into the generation prompt. Defaults to mixed if absent. |
| `params.excludeIds` | IDs of questions already asked in previous rounds of the current game. AI provider skips any generated question whose text matches an excluded entry. Populated by `gameStore` per round; cleared by `resetSession()` at the start of each new game. |
| `params.category` | Ignored — prompt replaces categories for this source. |
| **Success** | Returns `Question[]` of exactly `params.count` valid questions. |
| **Insufficient** | If fewer than `params.count` valid questions are produced after generation, throws `TriviaProviderError(NO_RESULTS)`. Caller displays error and returns to setup. |
| **Model unavailable** | If llama.rn context is not initialized, throws `TriviaProviderError(PROVIDER_ERROR)`. |

### `fetchCategories()`

Returns an empty array — categories are not supported for this source.

### `supportsCategories()`

Returns `false`. Setup screen hides the category selector when this source is active.

### `supportsDifficulty()`

Returns `true`. Difficulty is passed into the generation prompt.

### `cancelFetch()`

Calls `context.stopCompletion()` on the active llama context, interrupting an in-progress `fetchQuestions` call. The interrupted `context.completion()` promise resolves with partial output; `AIQuestionProvider` detects the incomplete result and throws `TriviaProviderError(USER_CANCELLED)`.

`gameStore` catches `USER_CANCELLED` specifically and navigates back to the setup screen without showing an error screen. All other error codes continue to show the error screen as before.

### `resetSession()`

Clears the internal set of previously generated question IDs used for cross-round deduplication, so that questions from a prior game are no longer excluded. Called by `gameStore.startGame()` at the start of each new game — not between rounds.

---

## Error Codes Used

| Code | When |
|------|------|
| `TriviaProviderErrorCode.INVALID_PARAMS` | `topicPrompt` is missing or too short (< 3 characters) |
| `TriviaProviderErrorCode.NO_RESULTS` | Generated fewer valid questions than requested |
| `TriviaProviderErrorCode.PROVIDER_ERROR` | Model not loaded / llama.rn inference failure |
| `TriviaProviderErrorCode.USER_CANCELLED` | User tapped Cancel during generation; `gameStore` handles this by returning to setup silently |

---

## GBNF Grammar Contract

The grammar enforces this JSON array structure per generation call:

```
root     ::= "[" ws item ("," ws item)* "]"
item     ::= "{" ws q-key ws "," ws type-key ws "," ws ca-key ws "," ws ia-key ws "}"
q-key    ::= "\"question\":" ws string
type-key ::= "\"type\":" ws ("\"multiple-choice\"" | "\"true-false\"")
ca-key   ::= "\"correct_answer\":" ws string
ia-key   ::= "\"incorrect_answers\":" ws "[" ws string ("," ws string)* ws "]"
ws       ::= [ \t\n]*
string   ::= "\"" [^"]* "\""
```

Any output that does not match this grammar is rejected at the token-sampling level by llama.rn — invalid JSON is not possible.

---

## ModelStore Contract

### Model Status States

| Status | Meaning | Can Start Game |
|--------|---------|---------------|
| `not_downloaded` | No model file on device | No |
| `downloading` | Download in progress | No |
| `available` | File present and integrity verified | Yes |
| `error` | Download failed or integrity failed | No |

### Download Service Guarantees

- Progress updates fire at most every 500ms to avoid UI jank
- On app kill during download, state is persisted as `'error'`; user must retry
- **Resume (iOS only)**: `RNFS.isResumable(jobId)` is checked before retry; if resumable, `RNFS.resumeDownload(jobId)` continues from the interrupted byte offset. On Android, retry always restarts from the beginning — this is acceptable given the alternative complexity.
- Integrity check is SHA-256 comparison against a published checksum
- If integrity fails after download, file is deleted and status set to `'not_downloaded'`

---

## llama.rn Integration

### Ownership: `modelStore` owns the llama context

`modelStore` is responsible for calling `initLlama` and `releaseAllLlama`. `AIQuestionProvider` never calls these directly — it receives the context via `modelStore.getContext()`.

**`modelStore` additions** (beyond the state shape in data-model.md):

```ts
// Called by settingsStore when user selects 'ai-generated'
async initModel(): Promise<void> {
  const context = await initLlama({
    model: state.modelPath!,
    n_ctx: 2048,
    n_gpu_layers: 99, // required for Metal on iOS — do not omit
    n_threads: 4,
  });
  set({ llamaContext: context });
}

// Called by settingsStore when user selects any other source,
// and on integrity failure / retry
async releaseModel(): Promise<void> {
  await releaseAllLlama();
  set({ llamaContext: null });
}

// Called by AIQuestionProvider.fetchQuestions
getContext(): LlamaContext | null {
  return get().llamaContext;
}
```

`initModel()` is only called when `modelStore.status === 'available'`. The **settings screen** is responsible for checking this before calling `modelStore.initModel()` — if status is not `'available'`, the screen shows the download prompt instead. `settingsStore` is not involved in model lifecycle management.

During `initModel()`, `modelStore` exposes an `isInitializing: boolean` flag (runtime-only, not persisted) so the settings screen can show a loading indicator while the 5–15s model load completes.

### `context.completion` call (per `fetchQuestions` invocation, in `AIQuestionProvider`)

```ts
const context = modelStore.getContext();
if (!context) throw new TriviaProviderError(TriviaProviderErrorCode.PROVIDER_ERROR);

const result = await context.completion({
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(topic, count, difficulty) },
  ],
  grammar: GBNF_GRAMMAR,
  temperature: 0.2,
  n_predict: 1024,
  stop: ['<|end|>', '</s>'],
});

const parsed = questionParser.parse(result.text); // throws TriviaProviderError on failure
```

**Key rules**:
- Always use `messages`, never `prompt`. Phi-3.5-mini's chat template is embedded in the GGUF and applied automatically — manually formatting `<|system|>` tokens will double-apply the template and break output quality.
- `n_gpu_layers: 99` is required. Metal is compiled in on iOS but does nothing without this parameter. Omitting it drops throughput to CPU-only (~10–20 tok/s) and risks exceeding SC-001.
- `grammar` is the GBNF string from `aiPrompts.ts`. With grammar active, `result.text` is structurally valid JSON — but `questionParser` still validates field-level constraints.

---

## Prompt Template Contract

The system prompt and user prompt sent to the model for each generation call:

**System prompt** (static, loaded once):
```
You are a trivia question generator. Generate accurate, factual multiple-choice trivia questions.
All facts must be verifiable and correct. Never invent facts.
Respond only with valid JSON matching the provided schema. Do not include explanations.
```

**User prompt** (dynamic, built per call):
```
Generate {{count}} trivia question(s) about "{{topic}}" at {{difficulty}} difficulty.
For multiple-choice questions: provide 1 correct answer and 3 distinct incorrect answers.
For true-false questions: provide the correct boolean answer and its opposite.
```

The topic prompt is sanitized (trimmed, length-validated) before insertion.
