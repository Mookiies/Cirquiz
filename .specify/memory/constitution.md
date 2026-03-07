<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — new principle (V. Live Verification via Maestro) added
Modified principles: None renamed
Added sections: V. Live Verification via Maestro
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ Constitution Check guidance updated for Principle V
  - .specify/templates/spec-template.md ✅ Independent Test guidance updated for Maestro
  - .specify/templates/tasks-template.md ✅ Checkpoints and Polish phase updated for Maestro
Deferred TODOs: None
-->

# Cirquiz Constitution

## Core Principles

### I. Code Quality

- Code MUST be readable and focused. Functions should do one thing.
- Duplication MUST be removed before a feature is considered done.
- Lint and formatting checks MUST pass. Suppressions require a comment.

### II. Testing Standards

- P1 user journeys MUST have at least one automated test covering the happy path.
- Tests MUST be written before or alongside implementation, not after.
- A failing test suite MUST block merge.

### III. UX Consistency

- UI patterns (navigation, errors, loading states) MUST be consistent across the app.
- Error messages MUST be user-readable and actionable where possible.
- New screens MUST follow the existing design language before shipping.

### IV. Performance Requirements

- Primary interactions MUST feel responsive (target <2s on a mid-range device).
- New features MUST NOT introduce obvious regressions to existing flows.
- N+1 data-fetching patterns are not allowed.

### V. Live Verification via Maestro

All P1 user journeys MUST be verified against the running app using the Maestro MCP before
a feature is considered done. Required steps:

- Launch the app with `mcp__maestro__launch_app` on a simulator or real device.
- Confirm expected UI state via `mcp__maestro__inspect_view_hierarchy` and/or
  `mcp__maestro__take_screenshot`.
- Run scenario flows with `mcp__maestro__run_flow` or `mcp__maestro__run_flow_files`
  where a repeatable flow exists.

Unit tests and static analysis alone do NOT satisfy verification for any UI-facing feature.
At least one Maestro-based check MUST be performed per P1 user story, and its result
(screenshot or passing flow output) MUST be documented in the feature's `specs/` directory
before merge.

**Rationale**: Cirquiz is a mobile app. Static tests can miss rendering issues, navigation
bugs, and platform-specific behavior. Maestro MCP provides direct inspection of the running
app, making acceptance verification concrete and reproducible.

## Governance

This constitution guides technical and implementation decisions for the Cirquiz monorepo.

- **Constitution Check**: Each feature plan (`plan.md`) MUST include a brief note on how
  all five principles apply or are intentionally excepted.
- **Exceptions**: Deviations from a principle MUST be noted in `plan.md` with a one-line
  rationale.
- **Amendments**: Use semantic versioning — MAJOR for removals/redefinitions, MINOR for
  additions, PATCH for wording. Update `LAST_AMENDED_DATE` on any change.
- This is a personal project; governance is lightweight by design. Common sense prevails.

**Version**: 1.1.0 | **Ratified**: 2026-03-07 | **Last Amended**: 2026-03-07
