# Implementation Plan: AI Trivia Generation Pipeline

**Branch**: `003-ai-trivia-generation` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)

---

## Summary

Build two deliverables: (1) a Python pipeline that generates a SQLite database of 50k+ factually-grounded multiple-choice trivia questions using MLX-LM (Mistral-7B) on the developer's M1 Max, and (2) a `LocalDatabaseProvider` TypeScript class that implements the existing `TriviaQuestionProvider` interface, reading from the exported database bundled as an Expo asset for offline gameplay.

---

## Technical Context

### Pipeline (Python developer tool)

**Language/Version**: Python 3.12.3 (3.14 is incompatible with outlines/sentence-transformers)
**Primary Dependencies**: mlx-lm ~0.22, outlines[mlxlm] ~0.2, sentence-transformers ~3.0 (`all-MiniLM-L6-v2`), datasets ~2.18 (HuggingFace), python-mwxml ~0.4, SQLModel, rich, tqdm
**Storage**: SQLite — generation DB (internal, full schema) + export DB (minimal schema for app bundle)
**Testing**: pytest
**Target Platform**: macOS, Apple M1 Max, 32GB unified memory
**Project Type**: CLI batch processing tool
**Performance Goals**: Generate + verify 50k questions in a multi-day background run; review CLI responds immediately to keyboard input
**Constraints**: All processing within 32GB unified memory, no external compute, no network dependency during generation
**Scale/Scope**: Target 50k–200k questions total; simplewiki for development iteration, enwiki for production scale

### App Integration (TypeScript / React Native)

**Language/Version**: TypeScript ~5.9
**Primary Dependencies**: expo-sqlite ~14.x (new addition)
**Storage**: Pre-populated SQLite bundled as Metro asset
**Testing**: Existing ESLint + Prettier + TypeScript checks; new unit test for `LocalDatabaseProvider`
**Target Platform**: iOS + Android, React Native 0.83.2, Expo SDK ~55
**Performance Goals**: `fetchQuestions()` must return results no slower than online providers (<2s, SC-006)
**Constraints**: Offline-capable (no network); database must be accessible from Metro bundle

---

## Constitution Check

### I. Code Quality
- **Pipeline**: Each phase (`seed`, `generate`, `verify`, `review`, `export`) is a standalone Python module. Functions do one thing. `ruff` for linting.
- **App integration**: `LocalDatabaseProvider` follows the single-responsibility pattern of existing providers. ESLint + Prettier must pass (`yarn workspace cirquiz lint && format:check`).
- No duplication: the `TriviaQuestionProvider` interface is reused as-is; no parallel type definitions.

### II. Testing Standards
- **P1 (pipeline generation)**: pytest integration test that seeds 10 questions and generates 5 from a Wikipedia stub, verifies DB output schema. Written before pipeline code ships.
- **P3 (offline gameplay)**: Unit test for `LocalDatabaseProvider.fetchQuestions()` using a test fixture database. Written alongside the provider implementation.
- Failing test suite blocks merge per constitution.

### III. UX Consistency
- **Exception**: The pipeline is a developer-only CLI tool with no app UI. Constitution III does not apply to the pipeline.
- **App integration**: The local provider selection UI (if added to settings) must match the existing online source selection pattern. No new design language introduced.

### IV. Performance
- `LocalDatabaseProvider.fetchQuestions()` uses indexed SQLite queries — expected sub-100ms response, well within the <2s target.
- The pipeline is a background tool; no interactive performance requirement.
- The bundled database adds to app binary size — monitor during build; flag if it exceeds 50MB.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-ai-trivia-generation/
├── plan.md              ← This file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pipeline-cli.md
│   └── local-provider.md
├── checklists/
│   └── requirements.md
└── tasks.md             ← Created by /speckit.tasks
```

### Source Code

```text
# Python pipeline (NEW — developer tool, not part of Yarn workspace)
pipeline/
├── pipeline.py              ← CLI entry point (argparse subcommands)
├── phases/
│   ├── seed.py              ← Load Jeopardy + other seed datasets
│   ├── generate.py          ← MLX-LM Wikipedia chunk → Q&A generation
│   ├── verify.py            ← Semantic dedup + confidence scoring
│   ├── review.py            ← Terminal CLI review loop
│   └── export.py            ← Filter + write minimal export DB
├── models/
│   ├── schemas.py           ← Pydantic schemas for LLM structured output
│   └── db.py                ← SQLModel ORM (generation DB tables)
├── config.py                ← Defaults: threshold, paths, model name
├── tests/
│   └── test_pipeline.py     ← pytest integration tests
├── requirements.txt
└── README.md                ← Quickstart summary

# App integration (MODIFIED existing files + NEW files)
apps/cirquiz/
├── assets/
│   └── trivia.db            ← NEW: exported question database (manual copy)
├── metro.config.js          ← MODIFIED: add 'db' to assetExts
└── src/
    └── providers/
        ├── types.ts          ← MODIFIED: add 'local' to QuestionSource
        ├── providerFactory.ts ← MODIFIED: register LocalDatabaseProvider
        └── local/
            └── LocalDatabaseProvider.ts  ← NEW
```

---

## Complexity Tracking

No constitution violations. The two-database approach (generation + export) is justified by data separation requirements (SC-004, no internal metadata in shipped app) and is simpler than a single schema with conditional field population.

---

## Verification

End-to-end validation steps:

1. **Pipeline correctness (small scale)**:
   ```sh
   cd pipeline && python pipeline.py generate --category history --limit 20
   python pipeline.py verify
   python pipeline.py export --output /tmp/test.db
   sqlite3 /tmp/test.db "SELECT COUNT(*) FROM questions;"
   ```

2. **Quality checks (app)**:
   ```sh
   yarn workspace cirquiz lint
   yarn workspace cirquiz format:check
   yarn workspace cirquiz typecheck
   ```

3. **Offline gameplay (device)**:
   - Bundle `trivia.db` into app assets
   - Enable airplane mode
   - Select local question source in settings
   - Complete a full game session — verify no errors, no question repeats

4. **Unit tests**:
   ```sh
   cd pipeline && pytest tests/
   ```
