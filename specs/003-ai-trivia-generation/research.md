# Research: AI Trivia Generation Pipeline

**Branch**: `003-ai-trivia-generation` | **Date**: 2026-03-21

---

## 1. LLM Inference on Apple Silicon

**Decision**: MLX-LM (Apple's Metal framework)

**Rationale**: MLX-LM achieves ~55–70 tok/sec on an M1 Max Q4 model, versus Ollama's ~35–60 tok/sec for the same model. More importantly, MLX runs in-process as a Python library—no daemon, no HTTP overhead, full programmatic control over batch generation. Critical for a pipeline that needs to generate 50k+ questions over multiple days.

**Alternatives considered**:
- **Ollama**: Easier CLI setup but requires a running server process, 5–10x slower for sustained batch throughput, and no native Python integration for structured output.
- **Cloud API (GPT-4o-mini, Gemini Flash)**: Cheapest estimate ~$15–50 for 200k questions, but introduces network dependency, cost variability, and rate limiting during long runs.

---

## 2. Structured Output from LLM

**Decision**: Outlines (v0.2+) with the `mlxlm` backend

**Rationale**: Outlines uses Finite State Machine (FSM) constrained decoding to guarantee output conforms to a Pydantic schema at the token level—no retries, no JSON repair. It integrates directly with mlx-lm without an intermediary server. For a pipeline generating 50k+ questions, eliminating retry overhead meaningfully reduces total runtime.

**Alternatives considered**:
- **Instructor**: The natural choice for Pydantic-schema LLM output, but it only supports OpenAI-compatible APIs. Using it with mlx-lm requires wrapping the model in `mlx-openai-server`, adding ~10% latency and another dependency.
- **Manual JSON prompting + validation**: Unreliable at scale; even well-prompted 7B models malform JSON ~5% of the time.

---

## 3. LLM Model Choice

**Decision**: Mistral-7B-Instruct v0.2 (Q4_K_M quantization)

**Rationale**: Instruction-tuned for prompt compliance, ~4.1GB model weight leaves ~28GB headroom in 32GB unified memory for embeddings, SQLite buffers, and pipeline state. Achieves ~33 tok/sec sustained throughput on M1 Max. Q4_K_M quantization introduces ~1.5–2% quality loss vs fp16, acceptable for trivia generation where grounding verification catches errors.

**Alternatives considered**:
- **Llama 3.1 8B (Q4_K_M)**: ~4.5GB, slightly larger, similar throughput. Good alternative—either works.
- **Qwen2.5 7B**: Strong at structured output tasks; secondary option if Mistral output quality is insufficient.
- **Llama 3.1 70B (Q4)**: ~38GB—does not fit in 32GB unified memory.

---

## 4. Semantic Deduplication

**Decision**: `sentence-transformers` with `all-MiniLM-L6-v2`, cosine similarity threshold 0.92

**Rationale**: `all-MiniLM-L6-v2` produces 384-dim embeddings at ~3,000 sentences/sec on CPU—sufficient for deduplicating 200k questions without GPU. The 0.92 cosine threshold was chosen to catch paraphrased near-duplicates while avoiding false positives between genuinely distinct questions. The threshold is configurable.

**Alternatives considered**:
- **`all-mpnet-base-v2`**: Higher accuracy (87–88% STS-B vs 84–85%) but 2x slower and 2x larger (768-dim). Overkill for dedup at this scale.
- **FAISS approximate nearest neighbor**: Useful if corpus exceeds 100k and exact cosine search becomes slow. Can be added as an optimization without changing the interface.

---

## 5. Seed Data Source

**Decision**: HuggingFace `datasets` library, loading the Jeopardy dataset (~217k questions)

**Rationale**: The Jeopardy dataset is freely available, high-quality, and covers diverse categories. Loading via `datasets` is a single function call with no scraping. This seeds the database immediately and reduces the LLM generation load (only generate what the seed data doesn't cover in target categories/difficulties).

**Alternatives considered**:
- **OpenTriviaDB dump**: Good supplement but smaller (~30k questions) and format is less consistent.
- **Web scraping trivia sites**: Lower quality (errors propagate), legal ambiguity, more infrastructure to maintain.

---

## 6. Wikipedia Source for Grounded Generation

**Decision**: Simple English Wikipedia dump (simplewiki), with an upgrade path to full English Wikipedia (enwiki) for production scale

**Rationale**: simplewiki (~85MB compressed, ~400MB uncompressed) processes in under 10 minutes, making it viable for iteration and development. It provides ~1,000–2,000 well-structured passages per category. For production (200k questions), enwiki (~22GB compressed) can be substituted by changing the dump URL—the parsing pipeline is identical.

**Parsing library**: `python-mwxml` (streaming XML parser, memory-efficient iterator over Wikipedia articles)

**Alternatives considered**:
- **`wikipedia-api` Python library**: Fetches individual articles via API—too slow for bulk processing of thousands of articles.
- **Direct HTTP fetching**: Network-dependent, rate-limited, not resumable.

---

## 7. App Database Bundling (Expo SDK 55)

**Decision**: `expo-sqlite` v14+ with the pre-populated `.db` file copied from app assets on first launch

**Rationale**: expo-sqlite is already the canonical SQLite solution for Expo apps. The recommended pattern for a bundled pre-populated DB is: include the `.db` file as a Metro asset (add `'db'` to `assetExts` in `metro.config.js`), then on first app launch copy it from the assets bundle to the document directory using `expo-file-system`, and open it with `SQLite.openDatabaseAsync()`. This is a one-time copy; subsequent launches open directly from the document directory.

**expo-sqlite is not currently installed** in the app — it must be added via `npx expo install expo-sqlite`.

**Alternatives considered**:
- **JSON file asset**: Simple but impractical at 50k+ questions (parse time, memory allocation at startup).
- **Embedded SQLite via `react-native-sqlite-storage`**: Third-party library, less Expo-native, more native build complexity.

---

## 8. Pipeline Project Location

**Decision**: `pipeline/` directory at the monorepo root (`/Users/malcom.scruggs/src/cirquiz/pipeline/`)

**Rationale**: The Python pipeline is a developer tool, not part of the Yarn workspace or app bundle. Placing it at the repo root keeps it discoverable without polluting the `apps/` workspace. It is fully self-contained with its own `requirements.txt` and `README.md`.

---

## 9. Export DB Schema vs Generation DB Schema

**Decision**: Two separate SQLite databases

- **Generation DB** (`pipeline/generation.db`): Full schema including source chunks, confidence scores, review state, pipeline resumption checkpoints. Never shipped to users.
- **Export DB** (`pipeline/export/cirquiz_questions.db`): Minimal schema—only fields the app needs (id, text, correct_answer, 3 distractors, category, difficulty). Manually copied to `apps/cirquiz/assets/` before app builds.

**Rationale**: Separating the schemas keeps the app bundle minimal and prevents accidental leakage of internal pipeline metadata (source text, confidence scores, review notes) into the shipped app.
