# Feature Specification: Pass-and-Play Trivia Game

**Feature Branch**: `001-pass-and-play-trivia`
**Created**: 2026-03-07
**Status**: Complete
**Input**: User description: "Develop a local, pass-and-play multiplayer trivia app..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a Full Game (Priority: P1)

One or more players set up a game, answer questions in turn (with device handoffs in multiplayer), and reach a final standings screen.

**Why this priority**: This is the core product loop. Every other story is an enhancement to or dependent on this flow.

**Independent Test**: Launch the app with 2 players, configure and start a game, complete all questions via handoffs, and verify a final standings screen appears with correct scores.

**Acceptance Scenarios**:

1. **Given** the app is open with no active game, **When** players enter their names and colors and tap Start, **Then** the first handoff screen appears addressed to Player 1.
2. **Given** a handoff screen is shown, **When** the named player taps "I'm Ready", **Then** the question screen appears with that player's name and color prominently displayed.
3. **Given** a player is on the question screen, **When** they select an answer, **Then** the answer is recorded silently and the next handoff screen appears (or the Answer Reveal screen if all players have answered).
4. **Given** all players have answered the current question, **When** the Answer Reveal screen is shown, **Then** the correct answer is displayed alongside each player's selection (correct/wrong) and updated scores.
5. **Given** the final question's Answer Reveal is dismissed, **When** the round ends, **Then** the Final Standings screen appears with all players ranked; ties are shown as joint positions with no tiebreaker.
6. **Given** a solo game is in progress, **When** a question is answered, **Then** no handoff screen appears; the Answer Reveal is shown immediately after the single player's answer.

---

### User Story 2 - Game Setup & Configuration (Priority: P2)

Players configure a new game before play begins: names, colors, question count, and optional category/difficulty selection.

**Why this priority**: Setup gates all gameplay; correct configuration is required before User Story 1 is reachable.

**Independent Test**: Open the app, go through the full setup flow with 3 players using distinct names and colors, choose a category and difficulty, confirm the game starts with the correct configuration.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** a user taps "New Game", **Then** a setup screen appears where 1–6 players can be added.
2. **Given** the player setup screen, **When** a user adds a player, **Then** they can enter a custom name and select a color that is not already taken by another player.
3. **Given** no players have been added, **When** the user attempts to proceed, **Then** the Start button is disabled or an error is shown.
4. **Given** the setup screen, **When** the user taps "Quick Play", **Then** the game starts immediately with randomly selected questions.
5. **Given** the setup screen, **When** the user taps "Choose Categories", **Then** available categories and difficulty levels from the question provider are displayed for selection.
6. **Given** the question provider is unavailable at game start, **When** the app attempts to fetch questions, **Then** a clear, user-readable error message is shown and no game begins.

---

### User Story 3 - Game Persistence & Recovery (Priority: P3)

An in-progress game is automatically saved so players can resume after the app is closed, backgrounded, or the device locks.

**Why this priority**: Prevents lost progress in long sessions; can be shipped after the core loop is validated.

**Independent Test**: Start a game, answer one question, fully close the app, reopen it, and confirm the game resumes at the correct state with correct scores intact.

**Acceptance Scenarios**:

1. **Given** a game is in progress, **When** the app is sent to the background and reopened, **Then** the game resumes at the exact screen and state it was in.
2. **Given** a game is in progress, **When** the device is locked and unlocked, **Then** the game resumes without any data loss.
3. **Given** an active game exists, **When** a player taps "Quit Game" and confirms, **Then** the game state is cleared and the home screen is shown.
4. **Given** the home screen, **When** an unfinished game exists in storage, **Then** a "Resume Game" option is clearly presented alongside "New Game".

---

### User Story 4 - Continuous Play / Play Another Round (Priority: P4)

At the end of a round, players can immediately start another round retaining current players, cumulative scores, and game settings.

**Why this priority**: Quality-of-life enhancement for back-to-back sessions; core game is complete without this.

**Independent Test**: Complete a full game, tap "Play Another Round", answer all questions, and verify cumulative scores are correct and settings carried over.

**Acceptance Scenarios**:

1. **Given** the Final Standings screen, **When** a player taps "Play Another Round", **Then** a new round begins with the same players and settings without re-entering setup.
2. **Given** continuous play is active, **When** the Answer Reveal or standings screens are shown, **Then** each player's cumulative score across all completed rounds is visible.

---

### Edge Cases

- What if all players tie on the final score? — All must be shown as joint first place; no tiebreaker prompt.
- What if the question provider returns fewer questions than requested? — The app accepts what is available and informs players of the adjusted count; if zero questions are returned, a graceful error is shown.
- What if only 1 player is added? — Solo mode is supported; a single player can play through a full game and see their own final score.
- What if a selected color is taken by the time a second player picks? — Colors already assigned must appear visually unavailable throughout setup.
- What if the same question appears across rounds in a continuous play session? — The app SHOULD avoid repeating questions from prior rounds within the same session, but this is a nice-to-have; repeated questions are acceptable if unavoidable.
- What if a player quits mid-round? — Quitting always requires confirmation; game state is cleared on confirmation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST support 1 to 6 players per game; a single-player (solo) game MUST be a valid configuration.
- **FR-002**: Each player MUST have a unique display name and a unique color chosen from a fixed palette; the palette MUST contain more colors than the maximum player count so players always have real choice; duplicate names or colors within the same game MUST be prevented.
- **FR-003**: Users MUST be able to configure the total number of questions before starting a game.
- **FR-004**: Users MUST be able to choose between Quick Play (random questions) and category/difficulty selection at setup, populated from whatever the active question provider supports.
- **FR-005**: In multiplayer games, the app MUST display a dedicated handoff screen before every player's turn; the question MUST NOT appear until that player taps a confirmation control. In solo mode, the handoff screen MUST be skipped entirely.
- **FR-006**: During the question phase, the active player's name and color MUST be prominently displayed.
- **FR-007**: A player's answer MUST be recorded silently; no correctness indication MUST appear until all players have answered the current question.
- **FR-008**: After all players have answered a question, the app MUST show an Answer Reveal screen displaying: the correct answer, each player's name with their specific chosen answer, a correct/wrong indicator per player, and updated standings before advancing.
- **FR-009**: Every player MUST answer the same questions in the same order; turn structure per question is Player 1 → Player 2 → ... → Player N before moving to the next question.
- **FR-010**: Supported question types MUST be limited to Multiple Choice and True/False.
- **FR-011**: Questions MUST be sourced through an abstracted TriviaQuestionProvider interface; the initial implementation MUST use an external API.
- **FR-012**: The TriviaQuestionProvider interface MUST be decoupled from game logic so it can be replaced with a local or custom source without modifying other code.
- **FR-013**: The active game state MUST be persisted locally and survive app backgrounding, full closure, and device lock.
- **FR-014**: Users MUST be able to quit the current game at any time; quitting MUST require explicit confirmation before clearing state.
- **FR-015**: The Final Standings screen MUST display all players ranked by score; tied scores MUST appear as joint positions with no tiebreaker mechanic.
- **FR-016**: The Final Standings screen MUST offer a "Play Another Round" action that starts a new round with the same players, cumulative scores, and prior settings.
- **FR-017**: If the question provider fails at game start, the app MUST display a clear error message and prevent the game from starting.
- **FR-018**: All user-facing strings MUST be externalized into a localization resource file to support future language additions; the initial shipped language is English only.
- **FR-019**: The app MUST be delivered on both iOS and Android; feature parity between platforms is required.
- **FR-020** *(nice-to-have)*: Within a continuous play session, the app SHOULD avoid repeating questions from previous rounds; this is a best-effort enhancement, not a hard requirement.
- **FR-021**: The question provider session MUST reset when a new game starts, ensuring each new game draws from a fresh question pool. The session MUST persist across rounds within the same game to enable FR-020 question deduplication.

### Key Entities

- **Player**: A participant identified by a unique name and color; holds a per-round score and a cumulative score across rounds.
- **Game**: A configured session containing a player list, question count, and category/difficulty settings; progresses through states: setup → in-progress → completed.
- **Round**: A single play-through of the configured question set; multiple rounds within the same game session share players and settings.
- **Question**: A trivia item of type Multiple Choice or True/False; contains the prompt, answer options, and the correct answer; sourced via TriviaQuestionProvider.
- **TriviaQuestionProvider**: An abstract interface that accepts parameters (count, category, difficulty) and returns a list of Questions; decoupled from any specific data source.
- **Turn**: A single player's attempt to answer one question; records the player, the question, the selected answer, and whether it was correct.
- **GameState**: The persisted snapshot of an in-progress game used for recovery; includes current question index, all recorded turns, and current scores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players can complete a full 2-player, 10-question game from setup to final standings with no errors under normal conditions.
- **SC-002**: Game state is fully restored after app closure with zero data loss in all tested recovery scenarios (background, close, lock).
- **SC-003**: The handoff screen prevents any question from being visible before the ready confirmation in 100% of tested cases; no answer can be recorded before confirmation.
- **SC-004**: The TriviaQuestionProvider implementation can be swapped without modifying game logic; verified by substituting a mock provider in tests.
- **SC-005**: When the external question source is unavailable at game start, the app displays an error and returns to a usable state without crashing.
- **SC-006**: Tied final scores are displayed correctly in all tested configurations (2-way tie, 3-way tie, all-players tie).

## Clarifications

### Session 2026-03-07

- Q: What is the minimum number of players required to start a game? → A: 1 (solo mode is supported; no minimum of 2 required).
- Q: Should the handoff screen appear in solo mode? → A: No — solo mode skips the handoff screen entirely; flow is question → silent answer record → reveal → next question.
- Q: On the Answer Reveal screen, how much answer detail is shown per player? → A: Show each player's name, their specific chosen answer, and a correct/wrong indicator.
- Q: On app launch with an unfinished game, should the app auto-resume or present a choice? → A: Show the home screen with a prominent "Resume Game" option alongside "New Game"; do not auto-resume.
- Note: All user-facing strings MUST be externalized to support localization; initial supported language is English only.

## Assumptions

- Target platforms are iOS **and** Android mobile; both platforms MUST be supported. The monorepo is structured to deliver to both.
- An existing free trivia API (e.g., Open Trivia Database) will be used as the first question provider; specific API selection is a technical decision deferred to planning.
- Each correct answer is worth 1 point; scoring is fixed with no partial credit or weighting.
- There is no user account or cloud sync system; all data is local and session-scoped.
- Minimum question count per game is 1; the UI will suggest a sensible default (e.g., 10).
- Category and difficulty options shown during setup are populated dynamically from the active provider.
- All user-facing strings MUST be externalized (e.g., via a localization/strings file) to support adding languages in the future; the initial supported language is English only.
