# Feature Specification: AI-Generated Trivia Questions

**Feature Branch**: `003-ai-question-gen`
**Created**: 2026-03-15
**Status**: Draft

## Clarifications

### Session 2026-03-15

- Q: Should AI questions be generated all at once before the game starts (single batch) or fetched per-round on demand like existing providers? → A: Per-round on demand (Option B) — consistent with existing provider interface; user sees a loading state at the start of each round.
- Q: When generation produces fewer valid questions than a round requires (after malformed ones are discarded), what should happen? → A: Hard failure (Option A) — show a user-friendly error and return to the setup screen; no partial rounds.
- Q: What should happen when the user submits a nonsensical, offensive, or extremely vague prompt? → A: Minimum length validation + vagueness hint (Option C) — reject prompts below a minimum length with an inline message; if a valid-length prompt yields no usable questions, show an error suggesting the user try a more specific topic.
- Q: How should the system handle a corrupted or incomplete model file? → A: Verify integrity once immediately after download completes (Option C); no integrity check at game time — if the model is corrupted post-download, it is caught as a standard generation failure (FR-013).
- Q: How should "mid-range device" in SC-001 be defined to make the criterion testable? → A: iPhone 12 or equivalent Android flagship from approximately 3 years prior to release (Option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select AI as Question Source (Priority: P1)

A user navigates to the app settings and selects "AI Generated" as their question source. This activates the feature and persists the preference across sessions.

**Why this priority**: This is the entry point to the entire feature. Without it, no other story is reachable.

**Independent Test**: Select "AI Generated" in settings, verify it is saved and reflected when returning to the settings screen.

**Acceptance Scenarios**:

1. **Given** the settings screen is open, **When** the user taps "AI Generated", **Then** it becomes the active question source and is visually indicated as selected.
2. **Given** "AI Generated" has been selected, **When** the app is closed and reopened, **Then** "AI Generated" remains the active question source.
3. **Given** the AI model has not been downloaded yet, **When** the user selects "AI Generated", **Then** a clear indication is shown that model setup is required before playing.

---

### User Story 2 - Enter Topic Prompt for Question Generation (Priority: P1)

Before starting a game with the AI source active, the user enters a free-form text prompt describing the subject they want trivia questions about (e.g., "80s pop music", "Ancient Rome", "Marvel superheroes").

**Why this priority**: The custom topic prompt is the defining value of this feature — without it, AI questions have no differentiating advantage over existing sources.

**Independent Test**: With AI source selected and model available, enter a topic prompt on the setup screen and verify the game generates questions relevant to that topic.

**Acceptance Scenarios**:

1. **Given** AI is the active question source, **When** the user reaches the game setup screen, **Then** a topic prompt input field is displayed.
2. **Given** the user enters a topic prompt, **When** the game starts, **Then** all generated questions are topically related to the entered prompt.
3. **Given** the user leaves the prompt empty, **When** they attempt to start the game, **Then** they are prompted to enter a topic before proceeding.
4. **Given** a previously used prompt, **When** the user opens setup again, **Then** the last-used prompt is pre-filled for convenience.

---

### User Story 3 - Play a Full Game with AI-Generated Questions (Priority: P1)

The on-device AI model generates a complete set of trivia questions from the user's topic prompt, and these questions flow through the existing game format without any changes to the round or scoring experience.

**Why this priority**: This is the core gameplay loop. The generated questions must be indistinguishable in format and flow from questions sourced from other providers.

**Independent Test**: Complete a full multi-round game using an AI-generated question set; verify all rounds complete normally and scoring functions correctly.

**Acceptance Scenarios**:

1. **Given** a topic prompt has been entered and the model is available, **When** a new round begins, **Then** questions for that round are generated on demand and a loading indicator is shown until the first question is ready.
2. **Given** questions have been generated, **Then** each question has exactly one correct answer, at least two incorrect options, and clearly readable question text.
3. **Given** a player answers a question, **When** the answer is revealed, **Then** the correct answer is factually accurate for the given topic.
4. **Given** a game session is in progress, **Then** no question is repeated within the same session.

---

### User Story 4 - Play Offline After Model is Available (Priority: P1)

Once the on-device model has been set up, the user can generate questions and play full games with no internet connection.

**Why this priority**: Offline support is a stated core requirement. Without it, the AI source offers no advantage over the existing network-dependent providers.

**Independent Test**: Enable airplane mode after model download, start a game with AI source, and verify questions are generated and the game completes normally.

**Acceptance Scenarios**:

1. **Given** the model is downloaded and no internet connection is available, **When** the user starts a game, **Then** questions are generated and the game proceeds normally.
2. **Given** no internet connection and the model is not downloaded, **When** the user attempts to start a game, **Then** a clear message explains that the model must be downloaded first (which requires a connection).
3. **Given** the model is available on device, **Then** question generation speed is not dependent on network conditions.

---

### User Story 5 - Download and Set Up the On-Device Model (Priority: P2)

When a user first selects the AI question source, they are guided through downloading the local AI model needed for offline generation.

**Why this priority**: Model setup is a prerequisite for P1 stories but is a one-time action. It is P2 because the settings selection story (P1) can be tested without completing a download.

**Independent Test**: Select AI source for the first time, initiate model download, verify progress is shown, and confirm the source becomes usable after download completes.

**Acceptance Scenarios**:

1. **Given** the user selects "AI Generated" and the model is not yet on device, **When** the download prompt is shown, **Then** the estimated download size is displayed clearly.
2. **Given** the user initiates the download, **Then** a progress indicator is visible until the download completes.
3. **Given** the download completes successfully, **Then** the model's integrity is verified and the user is able to start a game with AI-generated questions immediately without additional steps.
4a. **Given** the integrity check after download fails, **Then** the model is marked as unavailable and the user is prompted to re-download.
4. **Given** the download is interrupted (e.g., connection lost), **Then** the user is informed and can retry without starting over from the beginning.
5. **Given** insufficient device storage, **When** the user attempts the download, **Then** a clear message states that more storage is required.

---

### Edge Cases

- What happens when the model generates a question in an invalid or unparseable format?
- If generation produces fewer valid questions than a round requires, the system shows a user-friendly error and returns the user to the setup screen; partial rounds are not permitted.
- Prompts below a minimum length are rejected inline before generation begins, with a message prompting the user to be more specific. If a valid-length prompt produces no usable questions, the error message specifically suggests trying a more descriptive topic.
- What happens if the device runs out of storage during model download?
- What happens if question generation takes too long on a lower-end device?
- What happens if the user switches question sources mid-game setup (before starting)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST offer "AI Generated" as a selectable question source alongside existing sources (Open Trivia DB and The Trivia API) in the settings screen.
- **FR-002**: System MUST persist the selected question source (including AI Generated) across app sessions.
- **FR-003**: Users MUST be able to enter a free-form text prompt describing the trivia topic before starting a game when AI Generated is the active source. Prompts below a minimum character length MUST be rejected with an inline validation message before generation is attempted.
- **FR-004**: System MUST generate trivia questions entirely on-device using a local language model, with no network requests required during generation.
- **FR-005**: System MUST generate questions that conform to the existing question structure: a question text, one correct answer, and at least two incorrect options.
- **FR-006**: System MUST support both multiple-choice and true/false question types in AI-generated output.
- **FR-007**: System MUST support all existing difficulty levels (easy, medium, hard) for AI-generated questions, communicating the desired difficulty to the model at generation time.
- **FR-008**: System MUST deduplicate questions within a single game session so no question is presented twice.
- **FR-009**: System MUST validate the structure of generated questions before presenting them; malformed questions MUST be discarded. If the remaining valid questions are fewer than a round requires, the system MUST surface a user-friendly error and return the user to the setup screen.
- **FR-010**: System MUST display the model's download/availability status to the user (not downloaded, downloading, ready to use).
- **FR-011**: System MUST guide the user through downloading the on-device model including showing estimated download size and progress.
- **FR-012**: System MUST prevent starting a game with the AI source if the on-device model is not available.
- **FR-013**: System MUST handle question generation failures gracefully, surfacing a user-friendly error and returning the user to the setup screen.
- **FR-017**: System MUST generate questions on-demand at the start of each round (consistent with the existing provider interface), displaying a loading state while generation is in progress.
- **FR-014**: System MUST retain the last-used topic prompt and pre-fill it on subsequent game setups when AI is the active source.
- **FR-015**: The free-form topic prompt fully replaces the category selector for the AI question source; the category selector is not shown when AI Generated is the active source.
- **FR-016**: System MUST provide complete model download management as part of this feature, including download initiation, progress tracking, failure recovery (resume/retry), and device storage validation.
- **FR-018**: System MUST verify model file integrity immediately after download completes; if verification fails, the model MUST be marked as unavailable and the user prompted to re-download.

### Key Entities

- **AI Question Source**: A selectable question provider that generates trivia questions on-device; has availability states: `not_downloaded`, `downloading`, `ready`.
- **Topic Prompt**: User-provided free-form text describing the subject for question generation; stored between sessions for convenience; scoped to the game session it generates questions for.
- **On-Device Model**: The locally stored language model file(s) required for question generation; must be downloaded before first use; device storage is a constraint.
- **Generated Question**: A trivia question produced by the AI that conforms to the existing Question structure (question text, correct answer, incorrect options, category, difficulty).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Questions for each round are generated and ready to play in under 30 seconds at the start of each round on an iPhone 12 or equivalent Android flagship (approximately 3 years prior to release).
- **SC-002**: 100% of questions presented to users during gameplay have a structurally valid format (non-empty question text, exactly one correct answer marked, at least two total options).
- **SC-003**: Users can complete a full multi-round game using the AI source with no internet connection after the model has been downloaded.
- **SC-004**: A first-time user can complete model download and start their first AI-generated game without external assistance or documentation.
- **SC-005**: At least 90% of generated questions are topically relevant to the user's prompt, as verified by manual review of a representative sample.
- **SC-006**: Factual accuracy of generated answers meets or exceeds 95% correctness across a standard review set (50 generated questions per topic, reviewed manually or via a reference source).

## Assumptions

- The on-device model is downloaded by the user and not pre-bundled in the app binary, due to file size constraints.
- A single shared model handles all topic prompts; separate per-topic models are not required.
- Question generation occurs on-demand at the start of each round, consistent with the existing provider interface; questions are not pre-cached for future sessions.
- The AI source does not require an API key, account registration, or subscription.
- The existing game flow (setup → rounds → handoff → reveal → standings) is unchanged; only the question provider differs.
- The model download requires an internet connection; once downloaded, the model is fully self-contained.
- Accuracy is enforced through model selection and prompt design; there is no post-generation fact-checking against an external source.
- A single fixed model is used; user-selectable model options are explicitly out of scope for this feature and deferred to a future feature.
