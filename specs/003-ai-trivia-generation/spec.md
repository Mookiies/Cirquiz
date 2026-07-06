# Feature Specification: AI Trivia Question Generation Pipeline

**Feature Branch**: `003-ai-trivia-generation`
**Created**: 2026-03-21
**Status**: Draft

## Clarifications

### Session 2026-03-21

- Q: What type of interface should the human review tool use? → A: Terminal CLI — question displayed in terminal, keyboard input to approve/reject/edit.
- Q: How is difficulty (easy/medium/hard) assigned to generated questions? → A: LLM-assigned — the generating LLM labels difficulty based on the question's obscurity/nuance, guided by a rubric in the prompt.
- Q: How does the pipeline's generated database get bundled into the app? → A: Manual copy — the pipeline outputs a final export-ready `.db` file; the developer copies it into the app assets directory before building.
- Q: What is the confidence threshold for manual review? → A: 0.85 — questions scoring below this enter the human review queue; questions at or above are auto-approved.

---

## Overview

Build an offline-first trivia question database for the cirquiz app. This involves two distinct deliverables:

1. **Generation pipeline** — A developer-run tool that produces a validated, factually-grounded database of multiple-choice trivia questions across all target categories and difficulty levels.
2. **App integration** — A new offline question provider backed by the embedded database, so players can enjoy the game without an internet connection.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Generation Pipeline (Priority: P1)

As a developer, I can invoke the pipeline from the command line, and it processes source data into a SQLite database of trivia questions. The pipeline runs unattended for multiple days on local hardware and is resumable if interrupted.

**Why this priority**: This is the foundation — nothing else is possible without a generated question database.

**Independent Test**: Run the pipeline against a small subset (e.g., one Wikipedia category + a few hundred seed questions). Verify that output rows are written to the database with all required fields populated and that the pipeline can be stopped and restarted without reprocessing completed work.

**Acceptance Scenarios**:

1. **Given** the pipeline is started for the first time, **When** it runs to completion, **Then** the SQLite database contains at least the target volume of multiple-choice questions distributed across all 10 categories and three difficulty levels.
2. **Given** the pipeline is mid-run and the process is killed, **When** it is restarted, **Then** it resumes from where it left off without re-processing already-completed source chunks.
3. **Given** a source chunk is processed, **When** the LLM generates a question, **Then** every generated question is stored alongside its source reference, confidence score, and all required fields (text, correct answer, three distractors, category, difficulty).

---

### User Story 2 - Review Low-Confidence Questions (Priority: P2)

As a developer, I can view and adjudicate questions that fell below the confidence threshold. I can approve, reject, or edit questions through a simple interface before they are marked as verified.

**Why this priority**: Ensures factual accuracy of the final database by allowing human oversight on uncertain cases, without requiring manual review of every question.

**Independent Test**: Populate the database with a mix of high- and low-confidence questions. Open the review interface and verify that only questions below the threshold appear, and that approve/reject actions persist correctly.

**Acceptance Scenarios**:

1. **Given** the database contains questions with confidence below the threshold, **When** the developer opens the review tool, **Then** only unverified low-confidence questions are presented for review, one at a time.
2. **Given** a question is shown, **When** the developer approves it, **Then** the question is marked verified and no longer appears in the review queue.
3. **Given** a question is shown, **When** the developer rejects it, **Then** the question is excluded from the final export and removed from the review queue.

---

### User Story 3 - Offline Gameplay via Embedded Database (Priority: P3)

As an app player, I can start and complete a full game session without any internet connection, using questions sourced from the embedded local database. The experience is indistinguishable from an online game session.

**Why this priority**: Delivers the core user-facing value of this feature — offline-capable gameplay.

**Independent Test**: Disable network access on a device with the embedded database installed. Start a game using the local question source. Verify that a full game completes with properly shuffled, non-repeating questions from the requested category and difficulty.

**Acceptance Scenarios**:

1. **Given** the device has no network access, **When** a player selects the local question source and starts a game, **Then** questions load and gameplay proceeds normally with no error state.
2. **Given** a game is in progress, **When** rounds advance, **Then** previously seen questions are not repeated within the same session.
3. **Given** a player selects a specific category and difficulty, **When** the game starts, **Then** all served questions match the requested category and difficulty.

---

### Edge Cases

- What happens when the pipeline exhausts all Wikipedia chunks for a given category before hitting the question target? The pipeline should log the shortfall and continue with remaining categories.
- What happens when the LLM generates a question where the correct answer is not verifiably grounded in the source chunk? The question should receive a low confidence score and enter the human review queue rather than being auto-rejected.
- What happens if the local database is missing or corrupted after app install? The app must fall back to an online provider and surface a non-blocking warning to the developer (not the player).
- What happens when the app ships a new version with an updated `trivia.db`? On next launch the provider compares the bundled DB version against the installed version; if the bundled version is newer it replaces the installed copy before opening the connection.
- What happens when a category in the embedded database has fewer questions than requested for a round? The provider should serve all available questions for that category and signal the shortage.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Pipeline

- **FR-001**: The pipeline MUST generate multiple-choice questions, each with exactly one correct answer and three distinct distractors.
- **FR-002**: Every generated question MUST be grounded in a source document chunk; the source reference MUST be stored alongside the question.
- **FR-003**: The pipeline MUST assign a confidence score (0.0–1.0) to each question based on grounding strength and round-trip verification.
- **FR-004**: Questions with a confidence score below the configurable threshold MUST be placed in a human review queue rather than auto-approved.
- **FR-005**: The pipeline MUST support resumption after interruption without reprocessing already-completed source chunks.
- **FR-006**: The pipeline MUST cover all 10 target categories: Arts & Literature, Film & TV, General Knowledge, Geography, History, Music, Science, Sport & Leisure, Society & Culture, Food & Drink.
- **FR-007**: The pipeline MUST generate questions at easy, medium, and hard difficulty levels within each category. Difficulty MUST be assigned by the generating LLM based on a prompt rubric that defines obscurity and nuance criteria for each level.
- **FR-008**: The pipeline MUST deduplicate questions semantically — questions with near-identical meaning MUST be collapsed to a single entry.
- **FR-009**: Source data MUST be drawn from existing freely available datasets (e.g., Wikipedia dumps, existing trivia datasets) without requiring custom web scraping.

#### Human Review

- **FR-010**: The review tool MUST present low-confidence questions one at a time with the source text visible, via a terminal CLI interface.
- **FR-011**: The reviewer MUST be able to approve, reject, or edit a question's text or answers using keyboard input in the terminal.

#### App Integration

- **FR-012**: The app MUST include a new local question provider that reads from the embedded database.
- **FR-013**: The local provider MUST implement the existing `TriviaQuestionProvider` interface (`fetchQuestions`, `fetchCategories`, `supportsCategories`, `supportsDifficulty`, `resetSession`).
- **FR-014**: The local provider MUST support filtering by category and difficulty.
- **FR-015**: The local provider MUST accept an `excludeIds` parameter and exclude those question IDs from query results, matching existing provider behavior.
- **FR-016**: The embedded database MUST be bundled with the app and accessible without network connectivity. The pipeline MUST produce a final export-ready `.db` file that the developer manually copies into the app's assets directory before each app build that includes an updated question set.
- **FR-017**: The app MUST detect when a newly bundled database version is newer than the installed version and automatically replace the installed copy on next launch, without requiring user action.

### Key Entities

- **Question**: A multiple-choice trivia item with text, a correct answer, three distractors, category, difficulty, confidence score, verified status, and a reference to the source document chunk.
- **Source Chunk**: A passage from a source document (e.g., a Wikipedia section) used to ground question generation. Stores the source URL/title and the raw text passage.
- **Difficulty**: A label (easy, medium, or hard) assigned by the generating LLM based on a rubric. Easy = commonly known facts; Medium = requires specific knowledge of the subject; Hard = obscure, nuanced, or requires deep expertise.
- **Category**: One of the 10 target categories. Questions are tagged with exactly one category.
- **Review Queue Entry**: A reference to a question below the confidence threshold, pending human adjudication.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The final exported database contains at least 50,000 verified multiple-choice questions (questions either auto-approved above the confidence threshold or manually approved through review).
- **SC-002**: Questions are distributed across all 10 categories, with no single category representing more than 20% of the total.
- **SC-003**: Questions are distributed across difficulty levels, with easy, medium, and hard each representing at least 25% of the total.
- **SC-004**: 100% of questions in the exported database have a source reference traceable to the original document chunk.
- **SC-005**: A full offline game session (any category, any difficulty, any supported player count) completes without errors on a device with no network access.
- **SC-006**: The local provider returns question sets no slower than the existing online providers under equivalent conditions (i.e., users perceive no degradation in loading speed when switching to the local source).
- **SC-007**: The pipeline is fully resumable — a forced interruption mid-run and restart produces the same final output as an uninterrupted run.

---

## Assumptions

- The target question volume for the initial generation run is approximately 50,000–200,000 questions; the pipeline should be designed to support the upper bound but the minimum export target is 50,000 verified questions.
- The default confidence threshold for auto-approval is 0.85; questions scoring below this enter the human review queue. This threshold is configurable.
- The app will offer the local database as a selectable question source alongside the existing online providers, not as a replacement.
- The embedded database format will be SQLite, bundled as a static asset with the app build. JSON is unsuitable at this scale due to memory and parse time constraints.
- The pipeline is a developer-only tool (Python, run locally on the developer's machine). It does not need to be packaged for end-user distribution.
- The 10 target categories match The Trivia API's category taxonomy, which is already used in the app's existing provider.
- Hardware constraint: the generation pipeline must run on an Apple M1 Max (32GB unified memory) without requiring external compute resources.
