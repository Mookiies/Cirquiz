# cirquiz Development Guidelines

## Project Structure

Yarn monorepo with a single mobile app:

```text
apps/cirquiz/
  app/          # Expo Router file-based routing
  src/
    avatars.ts
    components/
    hooks/
    i18n/
    providers/
    state/      # Zustand stores
    theme.ts
    utils/
specs/          # Feature specs and plans
```

## Active Technologies
- TypeScript ~5.9 + React Native 0.83.2, Expo SDK ~55, Expo Router ~55, Zustand ^5, @react-native-async-storage/async-storage, react-native-reanimated, i18next + react-i18nex (002-provider-settings)
- AsyncStorage — `@cirquiz/settings` (new) and `@cirquiz/active_game` (existing) (002-provider-settings)
- TypeScript ~5.9, React Native 0.83.2, React 19.2.0 (003-ai-question-gen)
- AsyncStorage (`@cirquiz/model` key for model state; existing `@cirquiz/settings` key for source preference) (003-ai-question-gen)

- **Runtime**: React Native 0.83.2, React 19.2.0
- **Framework**: Expo SDK ~55, Expo Router ~55
- **State**: Zustand ^5 + @react-native-async-storage/async-storage
- **Animations**: react-native-reanimated (use this for all animations)
- **i18n**: i18next + react-i18next
- **Language**: TypeScript ~5.9

## Commands

Run from the monorepo root (uses Yarn workspaces):

```sh
yarn workspace cirquiz start          # Start Expo dev server
yarn workspace cirquiz ios            # Run on iOS
yarn workspace cirquiz android        # Run on Android
yarn workspace cirquiz lint           # Lint with ESLint
yarn workspace cirquiz lint:fix       # Lint and auto-fix
yarn workspace cirquiz format         # Format with Prettier
yarn workspace cirquiz format:check   # Check formatting
yarn workspace cirquiz typecheck      # TypeScript type checking
```

> **`npx expo` commands** (e.g. `expo lint`, `expo install`, `expo doctor`) must be run from `apps/cirquiz/`, not the monorepo root.

## Quality Gates

All changes must pass before committing:

```sh
yarn workspace cirquiz lint
yarn workspace cirquiz format:check
yarn workspace cirquiz typecheck
```

## Code Style

- TypeScript strict mode; follow existing file conventions
- Expo Router for navigation (file-based, under `apps/cirquiz/app/`)
- Zustand for global state (stores in `apps/cirquiz/src/state/`)

## Recent Changes
- 003-ai-question-gen: Added TypeScript ~5.9, React Native 0.83.2, React 19.2.0
- 002-provider-settings: Added TypeScript ~5.9 + React Native 0.83.2, Expo SDK ~55, Expo Router ~55, Zustand ^5, @react-native-async-storage/async-storage, react-native-reanimated, i18next + react-i18nex

- 001-pass-and-play-trivia: Pass-and-play local multiplayer trivia game with player setup, question flow, handoff screens, reveal, and standings

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
