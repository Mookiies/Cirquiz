<!--
SYNC IMPACT REPORT
==================
Version change: (unversioned template) → 1.0.0
Added sections: I. Code Quality, II. Testing Standards, III. UX Consistency, IV. Performance, Governance
Templates reviewed:
  - .specify/templates/plan-template.md ✅ Constitution Check section present; no changes needed
  - .specify/templates/spec-template.md ✅ Aligns with principles; no changes needed
  - .specify/templates/tasks-template.md ✅ Aligns with principles; no changes needed
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

## Governance

This constitution guides technical and implementation decisions for the Cirquiz monorepo.

- **Constitution Check**: Each feature plan (`plan.md`) MUST include a brief note on how the four principles apply or are intentionally excepted.
- **Exceptions**: Deviations from a principle MUST be noted in `plan.md` with a one-line rationale.
- **Amendments**: Use semantic versioning — MAJOR for removals/redefinitions, MINOR for additions, PATCH for wording. Update `LAST_AMENDED_DATE` on any change.
- This is a personal project; governance is lightweight by design. Common sense prevails.

**Version**: 1.0.0 | **Ratified**: 2026-03-07 | **Last Amended**: 2026-03-07
