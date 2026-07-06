# Contract: Pipeline CLI

**Type**: Command-line interface (Python)
**Location**: `pipeline/pipeline.py`

The pipeline is invoked via subcommands, one per phase. Each phase is idempotent and resumable.

---

## Commands

### `seed`

Load existing trivia datasets into the generation database. Runs once; re-running skips already-loaded records.

```
python pipeline.py seed [--db PATH] [--limit N]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--db` | `pipeline/generation.db` | Path to generation database |
| `--limit` | (none) | Max questions to load from seed sources |

**Output**: Populates `questions` table with `source_type='seed'` rows.

---

### `generate`

Run LLM generation against Wikipedia source chunks. Resumable—skips already-processed chunks.

```
python pipeline.py generate [--db PATH] [--category CAT] [--limit N] [--model MODEL]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--db` | `pipeline/generation.db` | Path to generation database |
| `--category` | (all) | Limit generation to one category |
| `--limit` | (none) | Max source chunks to process in this run |
| `--model` | `mistral-7b-instruct-v0.2` | MLX model name or path |

**Output**: Populates `questions` with `source_type='generated'` rows; updates `source_chunks.processed`.

---

### `verify`

Run semantic deduplication and grounding verification. Idempotent.

```
python pipeline.py verify [--db PATH] [--threshold FLOAT]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--db` | `pipeline/generation.db` | Path to generation database |
| `--threshold` | `0.85` | Confidence cutoff; questions below this enter the review queue |

**Output**: Updates `questions.is_duplicate`, `questions.confidence_score`, `questions.verified`; populates `review_queue`.

---

### `review`

Interactive terminal CLI for adjudicating low-confidence questions.

```
python pipeline.py review [--db PATH]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--db` | `pipeline/generation.db` | Path to generation database |

**Terminal UI per question**:
```
[Question 42 / 318 — Confidence: 0.61 — Category: History — Difficulty: medium]

Q: Which empire constructed the aqueducts that supplied Rome with fresh water?
A: Roman Empire
D: Greek Empire | Byzantine Empire | Ottoman Empire

Source: "Roman aqueducts were engineering marvels, constructed between 312 BC and 226 AD..."

[a] Approve  [e] Edit  [r] Reject  [s] Skip  [q] Quit
>
```

**Output**: Updates `review_queue.status`, `questions.verified`, `questions.rejected`.

---

### `export`

Produce the final minimal export database from verified questions.

```
python pipeline.py export [--db PATH] [--output PATH]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--db` | `pipeline/generation.db` | Path to generation database |
| `--output` | `pipeline/export/cirquiz_questions.db` | Output path for export database |

**Filter applied**: `verified = 1 AND rejected = 0 AND is_duplicate = 0`

**Output**: Creates (or overwrites) the export SQLite database with the minimal app schema. Prints a summary: total questions, breakdown by category, breakdown by difficulty.

---

## Progress & Logging

All commands write structured progress to stdout using `rich` (color-coded, progress bars). Each command also writes a log file to `pipeline/logs/<phase>_<timestamp>.log`.

The `pipeline_state` table in the generation DB records the last processed ID for each phase, enabling exact resumption after interruption.
