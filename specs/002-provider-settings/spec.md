# Feature Specification: Question Source Selection

**Feature Branch**: `002-provider-settings`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "I want to support https://the-trivia-api.com/docs/#section/Introduction in addition to otdb. I want users to be able to choose between these two question sources. They can do this from a setting menu. The settings are available on the index and the setup screen, but not within the game itself."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select a Question Source (Priority: P1)

A user wants to switch the trivia question source from the default (Open Trivia Database) to The Trivia API. They open the settings menu from the home screen, choose The Trivia API, and start a game — questions come from the newly selected source.

**Why this priority**: This is the entire value of the feature. Without the ability to choose a source, nothing else matters.

**Independent Test**: Open the app, access settings from the home screen, switch the question source to The Trivia API, start a new game, and verify that questions are successfully fetched and the game runs to completion.

**Acceptance Scenarios**:

1. **Given** the home screen is visible, **When** the user taps the settings control, **Then** the app navigates to a dedicated settings screen showing the currently active question source.
2. **Given** the settings screen is open, **When** the user selects a different question source, **Then** the selection is confirmed and the settings screen reflects the new selection.
3. **Given** The Trivia API is selected, **When** the user starts a new game with Quick Play, **Then** questions are fetched from The Trivia API and the game proceeds normally.
4. **Given** Open Trivia Database is selected, **When** the user starts a new game, **Then** questions are fetched from OTDB and the game proceeds normally (existing behavior preserved).
5. **Given** the settings screen is accessible from the home screen, **When** the user navigates to game setup, **Then** the same settings entry point is also available from the setup screen.
6. **Given** the user is on the settings screen, **When** they tap back, **Then** they are returned to the screen they came from (home or setup).

---

### User Story 2 - Source Preference Persists (Priority: P2)

A user selects The Trivia API as their preferred source, plays a game, and later closes the app. When they reopen the app, their source preference is remembered — they do not need to reconfigure it each session.

**Why this priority**: Without persistence, users must reconfigure their preference every launch, which is frustrating. However, the selection feature (US1) delivers value even without persistence.

**Independent Test**: Select The Trivia API in settings, fully close the app, reopen it, and verify the settings menu still shows The Trivia API as the active source without any user action.

**Acceptance Scenarios**:

1. **Given** a user has selected The Trivia API, **When** the app is fully closed and reopened, **Then** The Trivia API remains the active question source.
2. **Given** a user has never changed the setting, **When** the app is opened for the first time or after a fresh install, **Then** the default source (Open Trivia Database) is active.

---

### User Story 3 - Setup Adapts to Selected Source (Priority: P3)

The game setup screen reflects the capabilities of the currently selected question source. When a source is selected that has different categories, the category list in setup updates to show only what the active source supports.

**Why this priority**: Improves setup quality and prevents configuration mismatches, but the game remains fully playable without this (both sources handle unknown or empty category gracefully).

**Independent Test**: Select The Trivia API, navigate to game setup and open the category selector — verify only The Trivia API's categories are shown. Switch back to OTDB and verify the list updates.

**Acceptance Scenarios**:

1. **Given** The Trivia API is the active source, **When** a user opens the category selector in game setup, **Then** only The Trivia API's available categories are shown.
2. **Given** OTDB is the active source, **When** a user opens the category selector in game setup, **Then** OTDB's categories are shown (existing behavior).
3. **Given** a user changes the question source from the setup screen, **When** they return to the setup form, **Then** the category options reflect the newly selected source and any previously chosen category is cleared.

---

### Edge Cases

- What if a user changes the question source while the setup screen is open? — Categories MUST reset to the new source's options; any previously selected category MUST be cleared, and a brief notice MUST be shown to the user indicating that their category selection was reset.
- What if the selected source is unavailable at game start? — The existing error flow applies (user-readable error, game does not start); the source setting is unaffected.
- What if a user opens settings from the setup screen, changes the source, and navigates back? — The setup screen updates to reflect the new source; the user returns to setup via back navigation on the settings screen.
- What if both sources are unavailable at the same time? — Each source fails independently; the error reflects the currently active source's failure only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST support two question sources: Open Trivia Database (existing) and The Trivia API.
- **FR-002**: Users MUST be able to select their preferred question source via a dedicated settings screen (a separate navigable route, not a modal or inline control).
- **FR-003**: The settings screen MUST be accessible from the home screen.
- **FR-004**: The settings screen MUST be accessible from the game setup screen.
- **FR-005**: The settings screen MUST NOT be accessible from within an active game (handoff, question, reveal, standings, or error screens).
- **FR-006**: The currently active question source MUST be clearly displayed in the settings screen so users always know which source is selected.
- **FR-007**: The selected question source MUST be persisted locally and survive app close and reopen.
- **FR-012**: The settings screen MUST provide back navigation to return to whichever screen the user came from (home or setup).
- **FR-008**: The default question source for a new install MUST be Open Trivia Database (preserving existing behavior).
- **FR-009**: When the active source is changed, the category list in game setup MUST update to reflect the new source's available categories.
- **FR-010**: When the active source is changed while the setup screen is open, any previously selected category MUST be cleared and a brief notice MUST be shown informing the user that their category selection was reset.
- **FR-011**: The selected question source applies to all new games started after the change; any game already in progress is unaffected.

### Key Entities

- **AppSettings**: A persisted, device-local record of user preferences. Initially holds a single field: the selected question source. Not synced across devices.
- **QuestionSource**: An enumerated choice representing a supported trivia data source (Open Trivia Database or The Trivia API). Determines which provider fetches questions and which categories are available in setup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch question sources and complete a full game using the newly selected source with no errors under normal conditions.
- **SC-002**: The selected question source is correctly restored after app close and reopen in 100% of tested cases.
- **SC-003**: The settings entry point is reachable in 2 taps or fewer from both the home screen and the setup screen.
- **SC-004**: When the source is changed on the setup screen, the category list visibly updates before the user can tap Start.
- **SC-005**: The settings menu is unreachable from any in-game screen (handoff, question, reveal, standings, error) in 100% of tested configurations.

## Clarifications

### Session 2026-03-11

- Q: How is the settings UI presented — modal/sheet, dedicated screen, or inline? → A: Dedicated settings screen (new navigable route with back navigation).
- Q: When a source change clears a previously selected category in setup, should the user be notified? → A: Yes — show a brief notice (toast) informing the user that their category selection was reset.

## Assumptions

- Open Trivia Database remains the default; its existing behavior is fully preserved when it is the active source.
- The Trivia API requires no API key for the question volumes typical of this app (free tier is sufficient).
- The Trivia API does not support True/False questions; when it is the active source, games consist of multiple-choice questions only. This is an acceptable limitation and does not require a special warning beyond the natural absence of that option in setup.
- Both sources share the same difficulty level values (easy / medium / hard), so the difficulty selector does not change when the source changes.
- Settings are device-local; no user account or cloud sync is involved.
- The settings UI is a dedicated navigable screen — no per-source advanced configuration is required.
