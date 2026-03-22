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
python pipeline.py generate    # generate questions from Wikipedia (hours–days; resumable)
python pipeline.py validate    # LLM self-validation: filter bad questions, correct difficulty/category
python pipeline.py verify      # deduplicate + score confidence
python pipeline.py review      # adjudicate low-confidence questions (optional)
python pipeline.py export      # write export DB, prints db_version
```

Each phase is resumable — re-run after interruption and it picks up from the last checkpoint.

## Quick Test Run

```sh
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

```sh
tmux new-session -d -s trivia-gen 'cd pipeline && source .venv/bin/activate && python pipeline.py generate'
tmux attach -t trivia-gen
```

## Linting

```sh
source .venv/bin/activate
ruff check .
```
