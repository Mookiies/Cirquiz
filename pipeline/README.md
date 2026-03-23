# Trivia Generation Pipeline

Generates a SQLite database of multiple-choice trivia questions using local LLMs (MLX-LM on Apple Silicon), grounded in Wikipedia and seed datasets.

For full detail see [`specs/003-ai-trivia-generation/quickstart.md`](../specs/003-ai-trivia-generation/quickstart.md).

## Setup

```sh
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> First run downloads Mistral-7B (~4 GB) and the simplewiki dump (~1 GB) automatically. Ensure ~10 GB free disk space.

## Running

```sh
cd pipeline && source .venv/bin/activate
python pipeline.py generate    # generate questions from Wikipedia (hours–days; resumable)
python pipeline.py validate    # LLM self-validation: filter bad questions, correct difficulty/category
python pipeline.py verify      # deduplicate + score confidence
python pipeline.py review      # adjudicate low-confidence questions (optional)
python pipeline.py curate      # human sweep of all remaining valid questions (optional)
python pipeline.py export      # write export DB, prints db_version
```

Each phase is resumable — re-run after interruption and it picks up from the last checkpoint.

## Quick Test Run

```sh
cd pipeline && source .venv/bin/activate
python pipeline.py generate --category history --limit 20
python pipeline.py validate
python pipeline.py verify
python pipeline.py export --output /tmp/test.db
sqlite3 /tmp/test.db "SELECT COUNT(*) FROM questions;"
```

## Bundling into the App

After `export` prints `db_version written: N`:

```sh
cp pipeline/export/cirquiz_questions.db apps/cirquiz/assets/trivia.db
```

Then bump `BUNDLED_DB_VERSION` to `N` in `apps/cirquiz/src/providers/local/LocalDatabaseProvider.ts` and rebuild the app.

## Long Runs

Use `caffeinate -is` to prevent macOS from sleeping mid-run (`-i` prevents idle sleep, `-s` prevents system sleep):

```sh
cd pipeline && source .venv/bin/activate && caffeinate -is python pipeline.py generate
```

Or in a detached tmux session so you can close the terminal:

```sh
tmux new-session -d -s trivia-gen 'cd pipeline && source .venv/bin/activate && caffeinate -is python pipeline.py generate'
tmux attach -t trivia-gen
```

## Pipeline Architecture

### Question Generation & Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                         │
│   HuggingFace Wikipedia (clean plain text, 20220301.simple) │
└────────────────────────┬────────────────────────────────────┘
                         │ stream articles → chunk into ~450-word passages
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1 · GENERATE                                         │
│  LLM reads each passage and writes N questions              │
│  Each question: text · correct_answer · 3 distractors       │
│                 category · difficulty · confidence_score     │
│                                                             │
│  ┌─────────────────────────────────┐                        │
│  │  Feedback block (prepended)     │                        │
│  │  · Category corrections         │                        │
│  │  · Difficulty corrections       │                        │
│  │  · Factual error corrections    │                        │
│  │  · Distractor corrections       │                        │
│  │  · Human-rejected examples      │  ◄── from feedback DB  │
│  └─────────────────────────────────┘                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2 · VALIDATE                                         │
│  LLM reviews each question for quality                      │
│                                                             │
│  Fast pre-checks (no LLM call):                             │
│    · Malformed question text or answers                     │
│    · Answer appears verbatim in question                    │
│    · Temporal/subjective/source-referencing language        │
│                                                             │
│  LLM checks:                                                │
│    · Factual correctness & unambiguity                      │
│    · Plausible distractors                                  │
│    · Self-contained (no passage required)                   │
│    · Correct category & difficulty                          │
│                                                             │
│  ┌─────────────────────────────────┐                        │
│  │  Feedback block (prepended)     │                        │
│  │  · Category calibration         │                        │
│  │  · Difficulty calibration       │                        │
│  │  · Validator over-corrections   │  ◄── from feedback DB  │
│  └─────────────────────────────────┘                        │
│                                                             │
│  Outcomes:  rejected (rejection_source='validator')         │
│             flagged  → review_queue (category/diff mismatch)│
│             passed   → verified=true                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3 · VERIFY                                           │
│  · Semantic dedup   (cosine similarity ≥ 0.83 → duplicate)  │
│  · Grounding check  (answer substring in source passage?)   │
│  · Confidence gate  (score ≥ 0.85 → auto-approved)         │
│                      score < 0.85 → review_queue            │
└──────────┬──────────────────────────────┬───────────────────┘
           │ high confidence              │ low confidence /
           │ auto-approved                │ grounding failed
           ▼                              ▼
┌──────────────────────┐      ┌──────────────────────────────┐
│  PHASE 5 · CURATE    │      │  PHASE 4 · REVIEW            │
│  Human sweeps all    │      │  Human adjudicates flagged   │
│  verified questions  │      │  questions one by one        │
│                      │      │                              │
│  a) approve          │      │  a) approve                  │
│  x) edit             │      │  y) accept validator suggestion│
│  r) reject           │      │  x) edit                     │
│  s) skip             │      │  r) reject                   │
└──────────┬───────────┘      └──────────────┬───────────────┘
           │                                 │
           └──────────────┬──────────────────┘
                          │ human decisions recorded
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  FEEDBACK DATABASE  (generation.db · questions table)       │
│                                                             │
│  Signal 1 · Human corrections  (edited=1)                   │
│    original_* columns capture what the model first wrote    │
│    current columns capture what the human changed it to     │
│                                                             │
│  Signal 2 · Validator over-corrections                      │
│    validator suggested a change; human disagreed            │
│    review_queue.validator_suggestion_accepted = false        │
│                                                             │
│  Signal 3 · Human rejections  (tracked, NOT used as feedback)│
│    passed generation + validation; human still rejected     │
│    rejection_source = 'human'                               │
│    ⚠ Excluded from feedback — without a structured reason   │
│    the signal is too noisy (factual error vs. poor wording  │
│    are indistinguishable). Tracked for future use once      │
│    rejection categorisation is added.                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FEEDBACK RETRIEVER  (phases/feedback.py)                   │
│                                                             │
│  At run start: embed all feedback examples with             │
│  all-MiniLM-L6-v2 → in-memory index                        │
│                                                             │
│  Per question/chunk: cosine similarity search → top-8       │
│  most relevant examples injected into prompt                │
│                                                             │
│  Scales to thousands of examples — context stays bounded    │
└────────────────────────┬────────────────────────────────────┘
                         │ loops back into generate & validate
                         └──────────────────────────────────────►
```

### Key Design Principles

- **Seed data** (`source_type='seed'`) bypasses generate, validate, and verify — it is pre-approved ground truth
- **Deduplication** runs on every verify pass, so lowering `DEDUP_THRESHOLD` in `config.py` retroactively catches more near-duplicates on the next run
- **Feedback is zero-maintenance** — every human approval/correction/rejection automatically becomes a calibration example on the next pipeline run
- **Export** only includes `verified=true, rejected=false, is_duplicate=false` — the feedback DB and export DB are separate files

## Linting

```sh
source .venv/bin/activate
ruff check .
```
