# Data Model: AI Trivia Generation Pipeline

**Branch**: `003-ai-trivia-generation` | **Date**: 2026-03-21

---

## Overview

Two separate databases serve distinct purposes:
- **Generation DB** (`pipeline/generation.db`): Internal pipeline state — full provenance, confidence, and review metadata
- **Export DB** (`pipeline/export/cirquiz_questions.db` → `apps/cirquiz/assets/trivia.db`): Minimal schema shipped with the app

---

## Generation DB (Internal)

### `source_chunks`

Passages extracted from Wikipedia or other source documents. Each chunk is the grounding context used to generate one or more questions.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment |
| `source_type` | TEXT | NOT NULL | `'wikipedia'` or `'seed'` |
| `source_url` | TEXT | | Wikipedia article URL |
| `source_title` | TEXT | | Article or dataset title |
| `category` | TEXT | NOT NULL | One of the 10 target categories |
| `text` | TEXT | NOT NULL | Raw passage (~300 words) |
| `processed` | BOOLEAN | DEFAULT 0 | Whether LLM generation has been run on this chunk |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

**Index**: `(category, processed)` — used to resume generation from the last unprocessed chunk

---

### `questions`

All generated (and seed) multiple-choice questions, including internal metadata.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment |
| `source_chunk_id` | INTEGER | REFERENCES source_chunks(id) | NULL for seed questions |
| `source_type` | TEXT | NOT NULL | `'generated'` or `'seed'` |
| `text` | TEXT | NOT NULL | Question text |
| `correct_answer` | TEXT | NOT NULL | The one correct answer |
| `distractor_1` | TEXT | NOT NULL | Wrong answer option |
| `distractor_2` | TEXT | NOT NULL | Wrong answer option |
| `distractor_3` | TEXT | NOT NULL | Wrong answer option |
| `category` | TEXT | NOT NULL | One of the 10 target categories |
| `difficulty` | TEXT | NOT NULL | `'easy'`, `'medium'`, or `'hard'` |
| `confidence_score` | REAL | | 0.0–1.0; NULL for seed questions |
| `is_duplicate` | BOOLEAN | DEFAULT 0 | Flagged by semantic dedup pass |
| `duplicate_of` | INTEGER | REFERENCES questions(id) | ID of canonical question if duplicate |
| `grounded` | BOOLEAN | DEFAULT 1 | Whether correct answer appears in source chunk |
| `verified` | BOOLEAN | DEFAULT 0 | Auto-approved (confidence ≥ threshold) or manually approved |
| `rejected` | BOOLEAN | DEFAULT 0 | Manually rejected during review |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

**Indexes**:
- `(category, difficulty, verified, rejected, is_duplicate)` — export filter query
- `(confidence_score, verified, rejected)` — review queue query

**State transitions**:
```
generated → confidence_score assigned →
  if score >= 0.85:  verified = 1 (auto-approved)
  if score < 0.85:   enters review_queue
    → reviewer approves: verified = 1
    → reviewer rejects:  rejected = 1
```

---

### `review_queue`

Human review tasks for low-confidence questions.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY | Auto-increment |
| `question_id` | INTEGER | REFERENCES questions(id) | |
| `reason` | TEXT | NOT NULL | `'low_confidence'` or `'grounding_failed'` |
| `status` | TEXT | DEFAULT 'pending' | `'pending'`, `'approved'`, `'rejected'` |
| `reviewer_notes` | TEXT | | Optional notes from reviewer |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| `reviewed_at` | TIMESTAMP | | Set when status changes from pending |

**Index**: `(status)` — used to fetch pending review items

---

### `pipeline_state`

Checkpoint table for pipeline resumption.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY | Single row per phase |
| `phase` | TEXT | UNIQUE NOT NULL | `'seed'`, `'generate'`, `'verify'`, `'review'`, `'export'` |
| `status` | TEXT | DEFAULT 'pending' | `'pending'`, `'running'`, `'complete'` |
| `last_processed_id` | INTEGER | | Last processed source_chunk or question ID |
| `items_processed` | INTEGER | DEFAULT 0 | Progress counter |
| `items_total` | INTEGER | | Total items for this phase (set at phase start) |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

---

## Export DB (App Bundle)

Minimal schema. No pipeline metadata. This is what ships in the app.

### `questions`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | UUID or deterministic hash |
| `text` | TEXT | NOT NULL | Question text |
| `correct_answer` | TEXT | NOT NULL | |
| `distractor_1` | TEXT | NOT NULL | |
| `distractor_2` | TEXT | NOT NULL | |
| `distractor_3` | TEXT | NOT NULL | |
| `category` | TEXT | NOT NULL | One of the 10 target categories |
| `difficulty` | TEXT | NOT NULL CHECK IN ('easy','medium','hard') | |

**Indexes**:
- `(category, difficulty)` — primary filter for `fetchQuestions()`
- `(id)` — used by provider's `excludeIds` query

### `metadata`

Key-value store for database-level metadata.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `key` | TEXT | PRIMARY KEY | e.g., `'db_version'` |
| `value` | TEXT | NOT NULL | e.g., `'1'` |

**Single required row**: `('db_version', '<integer>')` — auto-incremented by the `export` phase on each run. Used for pipeline-internal version tracking and to generate the `TRIVIA_DB_NAME` bump instruction printed at the end of export. The app itself does not read this value; version detection is handled by the on-disk filename (`trivia_v{N}.db`) in `apps/cirquiz/app/_layout.tsx`.

---

### `categories`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | TEXT | PRIMARY KEY | Slug (e.g., `'arts_and_literature'`) |
| `name` | TEXT | NOT NULL | Display name (e.g., `'Arts & Literature'`) |

**Rows (fixed 10)**:

| id | name |
|----|------|
| `arts_and_literature` | Arts & Literature |
| `film_and_tv` | Film & TV |
| `general_knowledge` | General Knowledge |
| `geography` | Geography |
| `history` | History |
| `music` | Music |
| `science` | Science |
| `sport_and_leisure` | Sport & Leisure |
| `society_and_culture` | Society & Culture |
| `food_and_drink` | Food & Drink |

---

## App Provider Model

The `LocalDatabaseProvider` class maps export DB rows to the app's internal `Question` type:

```
Export DB row → Question {
  id:            questions.id
  type:          'multiple-choice'  (always, for now)
  text:          questions.text
  options:       [correct_answer, distractor_1, distractor_2, distractor_3]  (shuffled)
  correctAnswer: questions.correct_answer
  category:      questions.category
  difficulty:    questions.difficulty  (Difficulty enum: 'easy' | 'medium' | 'hard')
}
```

Session state (used question IDs) is held in-memory within the provider instance and cleared on `resetSession()`. It is not persisted to the database.

---

## Difficulty Rubric (LLM Prompt Definition)

The generating LLM assigns difficulty based on this rubric (embedded in the generation prompt):

| Level | Definition |
|-------|-----------|
| `easy` | Common knowledge; most adults would know the answer (e.g., "What planet is closest to the Sun?") |
| `medium` | Requires specific knowledge of the subject; pub quiz regulars would know (e.g., "What year did the Berlin Wall fall?") |
| `hard` | Obscure, nuanced, or requires deep expertise; specialists or dedicated trivia enthusiasts would know |
