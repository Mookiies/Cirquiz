# cirquiz Development Guidelines

## Project Structure

Yarn monorepo with a single mobile app:

```text
apps/mobile/
  app/          # Expo Router file-based routing
  src/
    components/
    hooks/
    i18n/
    providers/
    state/      # Zustand stores
    utils/
specs/          # Feature specs and plans
```

## Active Technologies

- **Runtime**: React Native 0.83.2, React 19.2.0
- **Framework**: Expo SDK ~55, Expo Router ~55
- **State**: Zustand ^5 + @react-native-async-storage/async-storage
- **i18n**: i18next + react-i18next
- **Language**: TypeScript ~5.9

## Commands

Run from the monorepo root (uses Yarn workspaces):

```sh
yarn workspace mobile start          # Start Expo dev server
yarn workspace mobile ios            # Run on iOS
yarn workspace mobile android        # Run on Android
yarn workspace mobile lint           # Lint with ESLint
yarn workspace mobile lint:fix       # Lint and auto-fix
yarn workspace mobile format         # Format with Prettier
yarn workspace mobile format:check   # Check formatting
yarn workspace mobile typecheck      # TypeScript type checking
```

> **`npx expo` commands** (e.g. `expo lint`, `expo install`, `expo doctor`) must be run from `apps/mobile/`, not the monorepo root.

## Quality Gates

All changes must pass before committing:

```sh
yarn workspace mobile lint
yarn workspace mobile format:check
yarn workspace mobile typecheck
```

## Code Style

- TypeScript strict mode; follow existing file conventions
- Expo Router for navigation (file-based, under `apps/mobile/app/`)
- Zustand for global state (stores in `apps/mobile/src/state/`)

## Recent Changes

- 001-pass-and-play-trivia: Pass-and-play local multiplayer trivia game with player setup, question flow, handoff screens, reveal, and standings

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->