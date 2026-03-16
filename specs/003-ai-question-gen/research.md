# Research: AI-Generated Trivia Questions

**Feature**: 003-ai-question-gen
**Date**: 2026-03-15
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: On-Device LLM Inference Library

**Decision**: `llama.rn` (package: `llama.rn` by mybigday)

**Rationale**: The non-negotiable requirement for this feature is reliable structured JSON output. Each generated question must have a strict schema (question text, one correct answer, three incorrect answers). `llama.rn` supports GBNF grammar-constrained sampling, which forces the model to emit tokens that conform to a defined grammar from the very first token — making malformed output structurally impossible. `react-native-executorch` has no documented equivalent.

**Alternatives considered**:

| Library | JSON Mode | Maturity | Notes |
|---------|-----------|----------|-------|
| `llama.rn` ✅ | GBNF grammar + JSON Schema | v0.11.2 (stable) | Chosen |
| `react-native-executorch` | Not documented | v0.7.2 (pre-1.0) | Simpler hook API but can't guarantee structured output |

**Additional llama.rn capabilities relevant to this feature**:
- Streaming token-by-token callback (can show live generation progress)
- iOS Metal GPU acceleration + Android OpenCL / Hexagon NPU
- Requires React Native New Architecture — satisfied by RN 0.83.2 ✅
- Requires bare workflow — satisfied by Expo SDK 55 (bare) ✅
- Package installs as a native module; ~147 MB package overhead (before model files)

**Note on `@pocketpalai/llama.rn`**: This is a fork maintained by the pocketpal-ai project. The upstream `llama.rn` from mybigday is the canonical package and is referenced in the pocketpal-ai source as a dependency. Use the upstream package.

**Important — llama.rn has no download functionality**: `llama.rn` / `initLlama()` only accepts a local file path (`file:///path/to/model.gguf`). It does not download models, and it does not expose a model-loading progress callback (the underlying llama.cpp supports one, but it is not surfaced in the RN binding). The pocketpal-ai app handles this with a separate download layer (`react-native-fs` + custom `LlamaService`) that downloads the GGUF file first, then passes the local path to `initLlama()`. Our architecture follows the same pattern: `modelDownloadService.ts` downloads the file, `modelStore` tracks state, and `AIQuestionProvider` calls `initLlama({ model: localPath })` only after `modelStore.status === 'available'`. The indeterminate model-loading phase (after download, before first inference) should show a spinner rather than a progress bar.

---

## Decision 2: Model Selection

**Decision**: Phi-3.5-mini-instruct (3.8B parameters), quantized to Q4_K_M
**Expected file size**: ~2.39 GB
**Source**: Hugging Face — `bartowski/Phi-3.5-mini-instruct-GGUF`

**Rationale**: Factual accuracy is the primary constraint (SC-006: ≥95% correctness). Among models that fit on a mid-range device, Phi-3.5-mini achieves the highest MMLU score (69%) by a significant margin. Combined with GBNF grammar forcing valid JSON structure, this gives the best chance of meeting the accuracy target.

| Model | Params | MMLU | Q4 Size | JSON Quality |
|-------|--------|------|---------|--------------|
| **Phi-3.5-mini-instruct** ✅ | 3.8B | 69% | 2.39 GB | Perfect (with GBNF) |
| Llama-3.2-3B | 3B | 63.4% | ~1.8 GB | Good |
| SmolLM2-1.7B | 1.7B | 59.6% | ~1.0 GB | Good |
| Gemma-2B | 2B | 57.8% | ~1.3 GB | Good |
| Qwen2.5-1.5B | 1.5B | 53.6% | ~0.9 GB | Good |

**Expected inference speed**: 10–20 tokens/second on iPhone 12 class device (CPU). A batch of 5 questions (~500–800 tokens output) should complete in 25–50 seconds, within the SC-001 30-second target for most rounds.

**Fallback if 2.39 GB is too large for target users**: SmolLM2-1.7B at ~1.0 GB (Q4), accepting ~9% accuracy reduction.

**Structured output approach**:
Use llama.rn's GBNF grammar to constrain output. The grammar enforces the schema per question batch:
```
root  ::= "[" ws question ("," ws question)* "]"
question ::= "{" ws
  "\"question\":" ws string "," ws
  "\"type\":" ws ("\"multiple-choice\"" | "\"true-false\"") "," ws
  "\"correct_answer\":" ws string "," ws
  "\"incorrect_answers\":" ws "[" ws string ("," ws string)* "]" ws
"}"
```

---

## Decision 3: Model Download Library

**Decision**: `@dr.pogodin/react-native-fs`
**Background downloads**: Not supported — app must remain open during download (same approach as pocketpal-ai)
**Integrity verification**: SHA-256 hash via a native hash library after download completes

**Rationale**: Background download adds significant complexity (config plugin, platform permissions, task recovery logic) with no major organizational backing available. The same trade-off was made by pocketpal-ai, which uses `@dr.pogodin/react-native-fs` and simply requires the user to keep the app open.

`expo-file-system` was the preferred option (staying in the Expo ecosystem) but has two blockers for this specific use case:

1. **`createDownloadResumable` is deprecated in SDK 55** and will throw at runtime. The replacement is `File.downloadFileAsync` from the new `expo-file-system` API.
2. **Memory architecture**: `expo-file-system` buffers downloaded data in memory rather than streaming to disk. While GitHub issue #8395 was closed in 2020, subsequent reports (issues #15797, #20262, #23826) confirm large-file crashes continued in later SDK versions. The core architecture — no incremental disk writes — has not changed. For a 2.39 GB file this is a meaningful risk on constrained devices.

If `File.downloadFileAsync` (the new non-deprecated API) turns out to stream to disk in SDK 55, this decision should be revisited — expo-file-system would then be the right choice. `@dr.pogodin/react-native-fs` streams directly to disk natively and avoids this entirely.

| Library | Streams to disk | Resume (iOS) | Progress | Actively maintained | 2-3 GB safe |
|---------|----------------|-------------|----------|--------------------|----|
| `@dr.pogodin/react-native-fs` ✅ | Yes (native) | Yes | Yes | Yes (Dr. Pogodin) | ✅ |
| `expo-file-system` | No (memory buffer) | Yes (iOS only) | Yes | Yes (Expo Inc.) | ❌ deprecated API + memory concern |
| `@kesha-antonov/react-native-background-downloader` | Yes | Yes | Yes | No major backer | ✅ |
| `react-native-fs` (original) | Yes | Yes | Yes | Abandoned | ✅ |

**Download API** (`@dr.pogodin/react-native-fs`):
```ts
RNFS.downloadFile({
  fromUrl: MODEL_URL,
  toFile: destinationPath,
  progressInterval: 500,
  progress: ({ bytesWritten, contentLength }) => {
    modelStore._setProgress(bytesWritten / contentLength);
  },
}).promise;
```

**Resume**: iOS only via `RNFS.isResumable(jobId)` + `RNFS.resumeDownload(jobId)`. On Android, a failed download restarts from the beginning — acceptable given the alternative complexity.

**Integrity verification**: After download, compute SHA-256 of the local file and compare against the published checksum from Hugging Face. If mismatch, delete the file and set `modelStore.status = 'not_downloaded'`.

---

## Decision 4: Topic Prompt Flow in Existing Architecture

**Decision**: Add `topicPrompt?: string` to `QuestionFetchParams`; add `aiTopicPrompt?: string` to `GameConfig` and `Game`.

**Rationale**: The existing `fetchQuestions(params: QuestionFetchParams)` is the provider interface contract. The cleanest extension is a new optional field `topicPrompt` in params — other providers ignore it, the AI provider reads it. The game must persist `aiTopicPrompt` on the `Game` object so `startNextRound()` can pass it on subsequent rounds (consistent with how `category` and `difficulty` are already persisted).

**Alternative considered**: Pass topic as the `category` field (since AI source doesn't use categories). Rejected — type aliasing unrelated concepts increases confusion.

---

## Decision 5: Model State Management

**Decision**: New dedicated `modelStore.ts` Zustand store (not merged into `settingsStore`).

**Rationale**: Model state is volatile (downloading, error recovery, progress) and operational — distinct from user preferences. Keeping it separate follows the existing separation between `settingsStore` (preferences) and `gameStore` (game state). The model store is persisted to AsyncStorage only for `status` and `modelPath`; ephemeral `downloadProgress` is runtime-only.

**State shape**:
```ts
type ModelStatus = 'not_downloaded' | 'downloading' | 'available' | 'error';

interface ModelStoreState {
  status: ModelStatus;
  downloadProgress: number; // 0–1, runtime only
  modelPath: string | null;  // persisted
}
```

---

## Unresolved / Deferred

- **Model distribution URL**: Where the model GGUF file is hosted (Hugging Face direct, CDN, app-specific bucket). This is an operational decision for implementation. Recommend Hugging Face direct download as the default since `bartowski/Phi-3.5-mini-instruct-GGUF` is publicly available.
- **Model versioning**: If a new GGUF version is published, how existing users migrate. Deferred to post-MVP; the `modelPath` in the store can be used to detect stale files in a future update.
