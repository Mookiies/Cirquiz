# Research: AI-Generated Trivia Questions

**Feature**: 003-ai-question-gen
**Date**: 2026-03-15
**Status**: Complete — all NEEDS CLARIFICATION resolved; gaps 2–7 from 2026-03-15 review addressed

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

**Expected inference speed**: 30–60 tokens/second on iPhone 12 (A14 Bionic) with Metal GPU acceleration enabled (`n_gpu_layers: 99`). A batch of 5 questions (~500–800 tokens output) completes in roughly 8–27 seconds — within the SC-001 30-second target with margin.

**Critical**: Metal acceleration requires `n_gpu_layers: 99` in `initLlama()`. Metal is compiled in automatically on iOS but is a no-op if `n_gpu_layers` is 0 or absent. Without it, CPU-only speed is 10–20 tok/s and a 500–800 token batch takes 25–80 seconds, which risks exceeding SC-001. `n_gpu_layers: 99` must be set explicitly in `AIQuestionProvider.ts`.

iPhone 12 ships with the A14 Bionic, which supports Metal GPU Family Apple7 — confirmed compatible with llama.rn's Metal backend. On Android, GPU acceleration depends on the device (OpenCL on Adreno GPUs); the 30-second target is a best-effort on Android and may not be met on all devices.

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

## Decision 6: llama.rn `initLlama` Configuration

**Decision**: Use the following configuration for all `initLlama()` calls:

```ts
const context = await initLlama({
  model: modelPath,    // absolute file:// path from modelStore
  n_ctx: 2048,         // prompt (~300 tok) + grammar output (~800 tok) + margin
  n_gpu_layers: 99,    // offload all layers to Metal (iOS) / OpenCL (Android)
  n_threads: 4,        // reasonable default; llama.rn picks optimal if omitted
});
```

**Rationale**:
- `n_ctx: 2048` — the system prompt + user prompt total ~300 tokens; a 5-question batch output is ~800 tokens. 2048 provides comfortable headroom without wasting RAM on a larger context.
- `n_gpu_layers: 99` — this is what actually enables Metal on iOS. Metal is compiled in at build time but only activates when `n_gpu_layers > 0`. Setting 99 offloads all layers; llama.cpp clamps to the actual layer count if the model has fewer. This is the difference between hitting and missing SC-001 (see Decision 2 speed note).
- `n_threads: 4` — safe default for iPhone 12 class; can be left unset to let llama.rn auto-detect.

**`initLlama` is not a singleton**: each call returns a new `LlamaContext` with a unique internal ID. `AIQuestionProvider` holds the context as a module-level variable, initialized lazily on first `fetchQuestions` call and reused for the app session. `releaseAllLlama()` is called if `modelStore` transitions to `'not_downloaded'` or `'error'` (e.g., integrity failure on retry).

---

## Decision 7: llama.rn Completion API

**Decision**: Use `context.completion()` with the `messages` array format and explicit `grammar` param:

```ts
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
const jsonText = result.text;
```

**Chat template**: When `messages` is passed, llama.rn automatically applies the chat template embedded in the GGUF file (Phi-3.5-mini ships with its template in model metadata). Manual formatting of `<|system|>...<|end|><|user|>...` tokens is **not required** and should not be done — doing so would double-apply the template. Use `messages`, not `prompt`.

**Why `temperature: 0.2`**: Low temperature reduces hallucination for factual trivia. Higher values increase variety but risk factual errors (SC-006 ≥95% accuracy target).

**Why `n_predict: 1024`**: Upper bound to prevent runaway generation. 5 questions × ~150–200 tokens each ≈ 750–1000 tokens. 1024 is a safe ceiling; GBNF grammar will complete the array before this limit in normal operation.

**`result.text`**: Returns the raw generated string. With the GBNF grammar active, this is always valid JSON matching the grammar schema — `questionParser.ts` still validates field-level constraints (non-empty strings, correct answer count, etc.) that grammar alone cannot enforce.

---

## Decision 8: iOS Entitlements for Large Model Loading

**Decision**: Enable `enableEntitlements: true` in the llama.rn Expo config plugin in `app.json`.

```json
{
  "plugins": [
    ["llama.rn", { "enableEntitlements": true }]
  ]
}
```

This sets two iOS entitlements automatically:
- `com.apple.developer.kernel.increased-memory-limit` — allows the app to use more than the default memory ceiling (required for a 2.39 GB model)
- `com.apple.developer.kernel.extended-virtual-addressing` — enables extended virtual address space on 64-bit devices

**Without these entitlements**: iOS will kill the app when it tries to load the model into RAM. This is a hard requirement for the feature to function on device.

**Build note**: The plugin also sets `forceCxx20: true` in Xcode build settings (C++20 is required by llama.cpp). This is handled automatically by the plugin and requires no manual Podfile edits.

**Android**: No equivalent entitlements required. GPU acceleration (OpenCL/Hexagon NPU) is opt-in via `enableOpenCLAndHexagon: true` in the plugin config — include this for best Android performance but it is not a hard requirement.

---

## Decision 9: Model Init Lifecycle

**Decision**: `modelStore` owns the llama context. The model is loaded when the user selects "AI Generated" as their question source and released when they switch to any other source.

```
User selects 'ai-generated' in settings (modelStore.status === 'available')
  └─ settings screen calls modelStore.initModel() directly
  └─ await initLlama({ model: modelPath, n_ctx: 2048, n_gpu_layers: 99, ... })
  └─ context stored in modelStore; a loading indicator is shown in settings during init

User is on AI source
  └─ same context reused for all rounds (model stays in RAM while AI source is active)

User selects a different source in settings
  └─ settings screen calls modelStore.releaseModel() directly
  └─ releaseAllLlama() → context = null (~2.5 GB freed)

modelStore transitions to 'not_downloaded' or 'error' (integrity failure / retry)
  └─ modelStore.releaseModel() → releaseAllLlama()
  └─ context = null
```

**Why load on source selection, not at game start**: Loading is tied to the user's explicit intent. When the user picks AI source, they are committing to the feature — paying the 5–15s load cost at settings time means the model is ready when they reach the game setup screen. It also avoids a confusing double-loading-indicator (model init + question generation) at round start.

**Why release on source switch**: ~2.5 GB of RAM should not be held while the user is on a different source. The 5–15s reload cost if they switch back is acceptable — it happens at the settings screen, not mid-game.

**Why keep model in RAM across rounds (while AI source is active)**: Releasing between rounds would make each round's start 35–45 seconds (5–15s reload + 8–27s generation), far exceeding SC-001. The model stays loaded for as long as AI source is selected.

**`AIQuestionProvider` gets context from `modelStore`**: The provider does not own or init the context itself. `fetchQuestions` calls `modelStore.getContext()` and throws `PROVIDER_ERROR` if it returns null (model not loaded). This is a programming error guard — the UI prevents starting a game when AI source is not ready.

---

## Unresolved / Deferred

- **Model distribution URL**: Where the model GGUF file is hosted (Hugging Face direct, CDN, app-specific bucket). This is an operational decision for implementation. Recommend Hugging Face direct download as the default since `bartowski/Phi-3.5-mini-instruct-GGUF` is publicly available.
- **Model versioning**: If a new GGUF version is published, how existing users migrate. Deferred to post-MVP; the `modelPath` in the store can be used to detect stale files in a future update.
