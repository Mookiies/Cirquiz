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
cd pipeline && source .venv/bin/activate

# Phase 1: Generate questions from Wikipedia
# Tip: Run with --limit 20 first to verify output quality before a full run
python pipeline.py generate --limit 20
python pipeline.py generate  # full run (hours–days)

# Phase 2: LLM self-validation
# Filters invalid questions, corrects difficulty/category, rejects questions where
# the answer is revealed in the question text
python pipeline.py validate

# Phase 3: Deduplicate + score confidence
python pipeline.py verify

# Phase 3b: (Optional) Review false-positive duplicates
# If verify incorrectly flagged a pair (e.g. "currency of Eritrea" vs "currency of Ethiopia"),
# use this to mark them as exempt. Re-running verify afterward will leave them unaffected.
# Keys: k) keep as duplicate  n) not a duplicate (save exemption)  s) skip  q) quit
python pipeline.py dupes

# Phase 4: Review low-confidence questions
python pipeline.py review

# Phase 5: Curate remaining valid questions (human sweep)
# Approve/reject questions that passed verify automatically (confidence ≥ 0.85).
# Resumable — already-approved questions are skipped automatically.
# Keys: 1-0) category  e/m/h) difficulty  a) approve  r) reject  s) skip  q) quit
python pipeline.py curate

# Phase 6: Export final database
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

**If this is an update to an existing shipped DB** (i.e. users already have a previous version on-device), bump the version in `apps/cirquiz/app/_layout.tsx`:

```ts
// Before
const TRIVIA_DB_NAME = 'trivia_v1.db';
// After
const TRIVIA_DB_NAME = 'trivia_v2.db';
```

Changing the name forces `SQLiteProvider` to copy the new asset on the user's next launch (since no file with that name exists yet). The old versioned file is automatically deleted on the same launch.

Then rebuild the app:

```sh
yarn workspace cirquiz ios    # or android
```

The `.db` file is included in the Metro bundle via the `assetExts` configuration in `metro.config.js`. The asset filename in `assets/` stays `trivia.db` always — only `TRIVIA_DB_NAME` needs bumping.

---

## Development Testing (Small Scale)

To verify pipeline correctness without a full run:

```sh
cd pipeline && source .venv/bin/activate

# Generate a small batch from one category only
python pipeline.py generate --category history --limit 20
python pipeline.py validate --limit 20
python pipeline.py verify
python pipeline.py export --output /tmp/test_export.db

# Inspect the output
sqlite3 /tmp/test_export.db "SELECT COUNT(*) FROM questions; SELECT * FROM questions LIMIT 3;"
```

---

## App Integration: Enabling the Local Provider

The local provider is already wired up. After bundling a new database:

1. Copy the exported DB to `apps/cirquiz/assets/trivia.db`.
2. If updating an existing release, bump `TRIVIA_DB_NAME` in `apps/cirquiz/app/_layout.tsx`.
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
tmux new-session -d -s trivia-gen 'cd pipeline && source .venv/bin/activate && caffeinate -is python pipeline.py generate'
tmux attach -t trivia-gen   # attach to watch progress
```
