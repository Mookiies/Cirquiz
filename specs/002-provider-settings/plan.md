# Implementation Plan: Question Source Selection

**Branch**: `002-provider-settings` | **Date**: 2026-03-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-provider-settings/spec.md`

## Summary

Add The Trivia API as a second question source alongside the existing Open Trivia Database, with a persisted user setting to select between them and a dedicated settings screen accessible from the home and setup screens. The existing `TriviaQuestionProvider` interface is extended with a second concrete implementation; a lightweight settings Zustand store persists the active source via AsyncStorage; and the game store resolves the active provider at runtime from the settings store.

## Technical Context

**Language/Version**: TypeScript ~5.9
**Primary Dependencies**: React Native 0.83.2, Expo SDK ~55, Expo Router ~55, Zustand ^5, @react-native-async-storage/async-storage, react-native-reanimated, i18next + react-i18next
**Storage**: AsyncStorage — `@cirquiz/settings` (new) and `@cirquiz/active_game` (existing)
**Testing**: Jest (existing test runner inferred from `__tests__/` directories and jest config in `apps/cirquiz/`)
**Target Platform**: iOS + Android (React Native / Expo)
**Project Type**: mobile-app
**Performance Goals**: Settings screen renders instantly (static content); question fetch target <2s, consistent with existing behavior
**Constraints**: Free tier of The Trivia API — no API key, stateless (no server-side sessions), non-commercial use only; device-local settings, no cloud sync
**Scale/Scope**: Single device, two question sources, one settings preference

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Code Quality** | New `TheTriviaApiProvider` mirrors the existing `OpenTriviaDbProvider` pattern. Provider selection extracted to a factory. `useCategoryLoader` updated to use the active provider instead of importing OTDB directly (removes current coupling). No duplication introduced. Lint/format gates enforced. | ✅ PASS |
| **II. Testing Standards** | US1 (P1): at least one automated test for the happy-path journey of switching sources and starting a game. Written alongside implementation. New provider unit-tested analogously to `OpenTriviaDbProvider.test.ts`. | ✅ PASS |
| **III. UX Consistency** | Settings screen uses `GradientScreen`, `SelectableRow`, and `IconButton` — same components used elsewhere. Navigation uses standard Expo Router `router.push/back()` stack behavior. Toast for category reset follows the spec's "brief notice" requirement — no bespoke UI patterns introduced. | ✅ PASS |
| **IV. Performance** | Settings screen is static; no async data fetch. Provider is resolved at call time, not in a blocking render path. No N+1 fetching: categories are still fetched once on demand. Existing question-fetch flow is unchanged. | ✅ PASS |

*No constitution violations. Complexity Tracking section not required.*

## Project Structure

### Documentation (this feature)

```text
specs/002-provider-settings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
apps/cirquiz/
├── app/
│   ├── _layout.tsx              # No change (settings screen auto-registered)
│   ├── index.tsx                # Add gear IconButton → router.push('/settings')
│   ├── setup.tsx                # Add gear IconButton + observe source changes
│   └── settings.tsx             # NEW: dedicated settings screen
│
└── src/
    ├── providers/
    │   ├── interface.ts         # Unchanged
    │   ├── types.ts             # Unchanged
    │   ├── index.ts             # Export TheTriviaApiProvider
    │   ├── providerFactory.ts   # NEW: getProvider(source) — singleton per source
    │   ├── opentdb/             # Unchanged
    │   │   └── OpenTriviaDbProvider.ts
    │   └── thetriviaapi/        # NEW
    │       ├── TheTriviaApiProvider.ts
    │       ├── triviaApiTypes.ts
    │       └── __tests__/
    │           └── TheTriviaApiProvider.test.ts
    │
    ├── state/
    │   ├── gameStore.ts         # Resolve provider via providerFactory at call time
    │   └── settingsStore.ts     # NEW: QuestionSource + AsyncStorage persistence
    │
    ├── hooks/
    │   └── useCategoryLoader.ts # Update: load from active provider, not hardcoded OTDB
    │
    └── i18n/
        └── en.json              # Add settings.* translation keys
```

**Structure Decision**: Single mobile-app layout (Option 3). All changes are co-located within `apps/cirquiz/`. No new packages or build targets required. Provider hierarchy extends the existing `providers/` directory, matching the established `opentdb/` pattern.

## Complexity Tracking

> No violations to justify. Constitution check passed without exceptions.
