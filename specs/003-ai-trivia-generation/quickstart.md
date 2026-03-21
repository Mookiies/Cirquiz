# Quickstart: AI Trivia Generation Pipeline

**Branch**: `003-ai-trivia-generation`

---

## Prerequisites

- Python 3.12 (managed via asdf — `pipeline/.tool-versions` pins it automatically)
- MLX-LM downloads models to `~/.cache/huggingface/hub` — ensure ~10GB free disk space
- Node / Yarn already set up for the app workspace

---

## Pipeline Setup

```sh
# From monorepo root
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Running the Pipeline (Full Flow)

Each phase is independent and resumable. Run phases in order:

```sh
# Phase 1: Load seed data (Jeopardy dataset)
python pipeline.py seed

# Phase 2: Generate questions from Wikipedia
# Tip: Run with --limit 100 first to verify output quality before a full run
python pipeline.py generate --limit 100
python pipeline.py generate  # full run (hours–days)

# Phase 3: Deduplicate + score confidence
python pipeline.py verify

# Phase 4: Review low-confidence questions
python pipeline.py review

# Phase 5: Export final database
python pipeline.py export
```

**Resuming after interruption**: Just re-run the same command. Each phase checks `pipeline_state` and resumes from the last checkpoint.

---

## Bundling the Database into the App

After `export` completes:

```sh
# From monorepo root
cp pipeline/export/cirquiz_questions.db apps/cirquiz/assets/trivia.db
```

Then rebuild the app:

```sh
yarn workspace cirquiz ios    # or android
```

The `.db` file is included in the Metro bundle via the `assetExts` configuration in `metro.config.js`.

---

## Development Testing (Small Scale)

To verify pipeline correctness without a full run:

```sh
# Generate 50 questions from one category only
python pipeline.py generate --category history --limit 20
python pipeline.py verify
python pipeline.py export --output /tmp/test_export.db

# Inspect the output
sqlite3 /tmp/test_export.db "SELECT COUNT(*) FROM questions; SELECT * FROM questions LIMIT 3;"
```

---

## App Integration: Enabling the Local Provider

After bundling the database:

1. In `providerFactory.ts`, add `'local'` to the `QuestionSource` type and return a `LocalDatabaseProvider` for that case.
2. In `settingsStore.ts`, add `'local'` as a selectable option.
3. Run quality checks before committing:

```sh
yarn workspace cirquiz lint
yarn workspace cirquiz format:check
yarn workspace cirquiz typecheck
```

---

## Monitoring a Long Pipeline Run

For multi-day generate runs, use a named tmux session:

```sh
tmux new-session -d -s trivia-gen 'cd pipeline && source .venv/bin/activate && python pipeline.py generate'
tmux attach -t trivia-gen   # attach to watch progress
```
