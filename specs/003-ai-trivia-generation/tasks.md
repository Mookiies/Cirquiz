# Tasks: AI Trivia Generation Pipeline

**Input**: Design documents from `specs/003-ai-trivia-generation/`
**Branch**: `003-ai-trivia-generation`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize both the Python pipeline project and app integration scaffolding

- [x] T001 Create `pipeline/` directory structure: `pipeline/phases/`, `pipeline/models/`, `pipeline/tests/fixtures/`, `pipeline/logs/`, `pipeline/export/`
- [x] T002 [P] Create `pipeline/requirements.txt` with pinned dependencies: `mlx-lm~=0.22`, `outlines[mlxlm]~=0.2`, `sentence-transformers~=3.0`, `datasets~=2.18`, `python-mwxml~=0.4`, `sqlmodel`, `rich`, `tqdm`, `readchar`, `pytest`, `ruff`
- [x] T003 [P] Create `pipeline/config.py` with typed defaults: `DB_PATH`, `EXPORT_PATH`, `MODEL_NAME` (`mistral-7b-instruct-v0.2`), `CONFIDENCE_THRESHOLD` (`0.85`), `DEDUP_THRESHOLD` (`0.92`), `WIKIPEDIA_DUMP_URL`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data models and CLI entry point that ALL pipeline phases depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `pipeline/models/db.py` — SQLModel ORM definitions for all 4 generation DB tables: `SourceChunk`, `Question`, `ReviewQueue`, `PipelineState`, plus `init_db(path)` helper that creates tables and indexes per data-model.md
- [x] T005 [P] Create `pipeline/models/schemas.py` — Pydantic schemas for Outlines structured output: `GeneratedQuestion` (text, correct_answer, distractor_1/2/3, difficulty, confidence_score) and `GeneratedQuestionBatch` (questions: list[GeneratedQuestion])
- [x] T006 Create `pipeline/pipeline.py` — argparse CLI entry point with five subcommands: `seed`, `generate`, `verify`, `review`, `export`, each wiring to the corresponding phase module; global `--db` flag defaults to `pipeline/generation.db`

**Checkpoint**: Generation DB schema defined, CLI wired — pipeline phases can now be implemented

---

## Phase 3: User Story 1 - Run Generation Pipeline (Priority: P1) 🎯 MVP

**Goal**: A developer can run the pipeline end-to-end and produce a populated SQLite database of grounded multiple-choice questions, resumable after interruption.

**Independent Test**: Run `python pipeline.py generate --category history --limit 20 && python pipeline.py verify && python pipeline.py export --output /tmp/test.db` then verify with `sqlite3 /tmp/test.db "SELECT COUNT(*) FROM questions;"` returns > 0 rows with all required fields.

- [x] T007 [US1] Implement `pipeline/phases/seed.py` — load Jeopardy dataset via `datasets.load_dataset('jeopardy-datasets/jeopardy')`, map each entry's category to one of the 10 target categories, insert into `questions` table with `source_type='seed'`, skip rows already present (idempotent); update `pipeline_state` for `seed` phase
- [x] T008 [US1] Implement Wikipedia extraction in `pipeline/phases/generate.py` — stream-parse a simplewiki XML dump with `mwxml`, split each article into ~300-word passages with sentence boundaries, tag each passage with one of the 10 target categories via keyword mapping, write to `source_chunks` table, mark chunks as unprocessed; skip if dump already parsed (check `pipeline_state`)
- [x] T009 [US1] Implement LLM generation loop in `pipeline/phases/generate.py` — for each unprocessed `source_chunk`, call MLX-LM (Mistral-7B) via Outlines with `GeneratedQuestionBatch` schema to produce 3 questions per chunk, write each question to `questions` table with `source_chunk_id` and `source_type='generated'`, mark chunk as processed, write checkpoint to `pipeline_state.last_processed_id` after every 10 chunks for resumption
- [x] T010 [US1] Implement semantic dedup in `pipeline/phases/verify.py` — embed all non-duplicate questions using `sentence-transformers` (`all-MiniLM-L6-v2`), compute pairwise cosine similarity in batches, flag questions exceeding the `DEDUP_THRESHOLD` (0.92) as `is_duplicate=True` with `duplicate_of` pointing to the canonical question (keep highest-confidence version)
- [x] T011 [US1] Implement confidence scoring in `pipeline/phases/verify.py` — for each generated (non-seed, non-duplicate) question: (1) grounding check — verify correct answer substring appears in source chunk text, penalize if not; (2) auto-approve questions with `confidence_score >= CONFIDENCE_THRESHOLD` by setting `verified=True`; (3) insert questions below threshold into `review_queue` with `reason='low_confidence'`; update `pipeline_state` for `verify` phase
- [x] T012 [US1] Implement `pipeline/phases/export.py` — query generation DB for `verified=True AND rejected=False AND is_duplicate=False`, write to export DB at `EXPORT_PATH` using the minimal schema from data-model.md (questions + categories + metadata tables), seed the 10 fixed category rows, auto-increment `db_version` in the `metadata` table on each export run (read previous value if DB exists, otherwise start at 1), create indexes on `(category, difficulty)` and `(id)`; print summary: total questions, per-category count, per-difficulty count, db_version written
- [x] T013 [US1] Write pytest integration test in `pipeline/tests/test_pipeline.py` — seed 10 hardcoded test questions, run generate against a stub source chunk (no LLM call, inject mock Outlines response), run verify, run export to temp DB; assert export DB has required schema, all fields non-null, at least one question per difficulty level

**Checkpoint**: US1 complete — run independent test above and confirm output. Pipeline MVP is done.

---

## Phase 4: User Story 2 - Review Low-Confidence Questions (Priority: P2)

**Goal**: A developer can adjudicate low-confidence questions one at a time in the terminal before export.

**Independent Test**: Seed the generation DB with 5 questions in the `review_queue` (status=pending). Run `python pipeline.py review`. Press `a` for the first, `r` for the second, `s` for the third, `q` to quit. Verify the first two are updated in the DB (`verified=True` and `rejected=True` respectively) and the third remains `status=pending`.

- [x] T014 [US2] Implement `pipeline/phases/review.py` — fetch all `review_queue` rows with `status='pending'` ordered by confidence ASC, display each question with the terminal format from `contracts/pipeline-cli.md` (question text, correct answer, distractors, source text, confidence, progress counter), read single-key input (`a`/`e`/`r`/`s`/`q`) via `readchar` or `sys.stdin`, on approve set `questions.verified=True` and `review_queue.status='approved'`, on reject set `questions.rejected=True` and `review_queue.status='rejected'`, on edit open `$EDITOR` with the question JSON pre-filled and re-validate on save, on skip advance to next without updating, on quit exit loop cleanly; use `rich` for display formatting

**Checkpoint**: US2 complete — run independent test above and verify DB state.

---

## Phase 5: User Story 3 - Offline Gameplay via Embedded Database (Priority: P3)

**Goal**: The app can serve questions from a bundled local SQLite database with no network access, indistinguishable from online play.

**Independent Test**: Copy a small test `trivia.db` (≥20 questions) to `apps/cirquiz/assets/trivia.db`, enable airplane mode on device, select local source in settings, start a full game — verify it completes with no errors and no repeated questions.

- [x] T015 [P] [US3] Install `expo-sqlite` (`npx expo install expo-sqlite` from `apps/cirquiz/`) and update `apps/cirquiz/metro.config.js` to add `'db'` to `assetExts` (alongside the existing SVG transformer config)
- [x] T016 [P] [US3] Add `'local'` to the `QuestionSource` union type in `apps/cirquiz/src/state/settingsStore.ts`
- [x] T017 [US3] Create `apps/cirquiz/src/providers/local/LocalDatabaseProvider.ts` — implement `TriviaQuestionProvider`; declare a `BUNDLED_DB_VERSION` integer constant at the top of the file (set to the version printed by the last `export` run, incremented manually each time a new `trivia.db` is copied to assets); initialization: (1) read installed version from AsyncStorage key `@cirquiz/local_db_version`, (2) if `BUNDLED_DB_VERSION` > installed version (or no stored version), copy the bundled `trivia.db` asset to the document directory using `expo-file-system` overwriting any existing file, then persist `BUNDLED_DB_VERSION` to AsyncStorage, (3) open DB connection with `expo-sqlite`; `fetchQuestions()` queries with optional `category`/`difficulty` filters and `excludeIds` exclusion in a single indexed SQL query, shuffles options before returning; `fetchCategories()` reads the `categories` table; `supportsCategories()` and `supportsDifficulty()` return `true`; `resetSession()` is a no-op (session dedup handled by `gameStore` via `excludeIds`); throw a typed `TriviaProviderError` if DB is missing or empty
- [x] T018 [P] [US3] Write unit test for `LocalDatabaseProvider` in `apps/cirquiz/src/providers/local/__tests__/LocalDatabaseProvider.test.ts` — using a small in-memory or fixture `.db` file: assert `fetchQuestions()` returns the correct count, respects `category` and `difficulty` filters, excludes IDs in `excludeIds`, and shuffles options; assert `fetchCategories()` returns all 10 categories; assert `resetSession()` does not throw
- [x] T019 [US3] Register `LocalDatabaseProvider` in `apps/cirquiz/src/providers/providerFactory.ts` — add `'local'` case to the `getProvider()` factory, return a `LocalDatabaseProvider` instance
- [x] T020 [US3] Expose `'local'` as a selectable question source in `apps/cirquiz/src/state/settingsStore.ts` — add it to the valid source options alongside existing providers
- [x] T021 [US3] Generate a minimal development fixture `trivia.db` (≥20 questions, all 10 categories represented, all 3 difficulty levels) using the pipeline export command against seed data only; copy to `apps/cirquiz/assets/trivia.db` so the app can build and be tested without a full pipeline run

**Checkpoint**: US3 complete — run independent test above with airplane mode.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, documentation, and final validation

- [x] T022 Run app quality checks and fix any issues: `yarn workspace cirquiz lint && yarn workspace cirquiz format:check && yarn workspace cirquiz typecheck`
- [ ] T023 Run Python linting and fix any issues: `ruff pipeline/` (requires pipeline venv — run after `pip install -r requirements.txt`)
- [x] T024 [P] Write `pipeline/README.md` — condensed quickstart: venv setup, one-liner per phase, export-to-app copy step; reference `specs/003-ai-trivia-generation/quickstart.md` for full detail
- [ ] T025 End-to-end validation: run the full pipeline on simplewiki + seed data, export to `apps/cirquiz/assets/trivia.db`, build and run the app in airplane mode, complete a full game session per `specs/003-ai-trivia-generation/quickstart.md` validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks Phases 3, 4, 5
- **Phase 3 (US1)**: Depends on Phase 2 — T007–T009 can proceed in order; T010–T011 depend on T009; T012 depends on T010–T011
- **Phase 4 (US2)**: Depends on Phase 2 only — can run in parallel with Phase 3 (different file: `review.py`)
- **Phase 5 (US3)**: Depends on Phase 2 only — T015/T016 parallel; T017 depends on T015+T016; T018 (unit test) runs alongside T017; T019/T020 depend on T017
- **Phase 6 (Polish)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1**: Requires Phase 2 complete. No dependency on US2 or US3.
- **US2**: Requires Phase 2 complete. No dependency on US1 or US3.
- **US3**: Requires Phase 2 (types.ts) complete. T021 (fixture DB) depends on T007 + T012 from US1 — US3 cannot be fully tested without a fixture DB, which requires the seed and export phases to be implemented first.

### Within Phase 3 (US1)

```
T004 (db.py) ──→ T007 (seed)
             ──→ T008 (Wikipedia extract) ──→ T009 (LLM generate)
T005 (schemas.py) ──→ T009 (LLM generate)
T009 ──→ T010 (dedup) ──→ T011 (confidence) ──→ T012 (export)
T004 + T012 ──→ T013 (integration test)
```

---

## Parallel Opportunities

### Phase 1
```
T002 requirements.txt    ─┐
T003 config.py           ─┘ run together
```

### Phase 2
```
T005 schemas.py          ─┐
(while T004 db.py runs)  ─┘ T005 can start once entity names are known from T004
```

### Phase 3 + 4 (after Phase 2)
```
T007 seed.py             ─┐
T014 review.py (US2)     ─┘ completely independent files
```

### Phase 5 (after T016 completes)
```
T015 expo-sqlite + metro  ─┐
T016 types.ts update      ─┘ run together → then T017 + T018 together → then T019, T020 together
T021 fixture DB           ─ requires T007 + T012 (US1) to be complete first
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — `db.py`, `schemas.py`, `pipeline.py` CLI
3. Phase 3: US1 — `seed.py`, `generate.py`, `verify.py`, `export.py` + integration test
4. **STOP**: Validate with `python pipeline.py generate --limit 20 && export --output /tmp/test.db`
5. Pipeline MVP complete — questions can be generated and exported

### Full Delivery

After MVP:
1. Phase 4 (US2): Add terminal review CLI
2. Phase 5 (US3): Add app integration + fixture DB
3. Phase 6: Quality gates + end-to-end validation

---

## Notes

- The `CONFIDENCE_THRESHOLD` in `config.py` defaults to `0.85` but can be overridden via `--threshold` flag per `contracts/pipeline-cli.md`
- T021 (fixture DB) requires T007 (seed.py) and T012 (export.py) to be implemented first — run `python pipeline.py seed` then `python pipeline.py export` against seed-only data to get a real fixture without a full LLM generation run
- For multi-day `generate` runs, use `tmux new-session -d -s trivia-gen 'cd pipeline && source .venv/bin/activate && python pipeline.py generate'`
- All Python files use `ruff` for linting; all app files use ESLint + Prettier
- T023 requires the pipeline venv to be set up first: `cd pipeline && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
