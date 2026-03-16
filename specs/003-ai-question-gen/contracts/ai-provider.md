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
| `params.excludeIds` | Used to skip previously asked questions (text-based dedup). |
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

### `resetSession()`

Clears the internal set of previously generated question texts (for deduplication across rounds). Called by `gameStore.startGame()` at the start of each new game.

---

## Error Codes Used

| Code | When |
|------|------|
| `TriviaProviderErrorCode.INVALID_PARAMS` | `topicPrompt` is missing or too short (< 3 characters) |
| `TriviaProviderErrorCode.NO_RESULTS` | Generated fewer valid questions than requested |
| `TriviaProviderErrorCode.PROVIDER_ERROR` | Model not loaded / llama.rn inference failure |

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
- Integrity check is SHA-256 comparison against a published checksum
- If integrity fails after download, file is deleted and status set to `'not_downloaded'`

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
