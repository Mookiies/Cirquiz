# Research: Pass-and-Play Trivia Game

## 1. Expo + React Native for Cross-Platform Mobile

**Decision**: Expo SDK (latest stable) with Expo Router for navigation.

**Rationale**: Expo gives a single TypeScript codebase that compiles to both iOS and Android — exactly what FR-019 requires. Expo Router provides file-based navigation (similar to Next.js) that is now the Expo-recommended approach and aligns well with the screen-per-state structure of this app. EAS Build handles cloud builds for both platforms without requiring a local Xcode/Android Studio setup on every machine.

**Alternatives considered**:
- Bare React Native: More control but loses Expo's managed workflow; overkill for a personal project.
- Flutter: Cross-platform but different language (Dart); no advantage here given the JS/TS ecosystem preference.

---

## 2. Monorepo Structure

**Decision**: yarn workspaces monorepo with a single current workspace (`apps/cirquiz`). The `TriviaQuestionProvider` interface and implementations live inside `apps/cirquiz/src/providers/` — not a separate package.

The root `package.json` defines workspaces:
```json
{
  "name": "cirquiz",
  "private": true,
  "workspaces": ["apps/*"]
}
```

**Rationale**: The monorepo structure is retained to accommodate a future `apps/api` workspace (custom trivia API). However, extracting the provider into a separate `packages/trivia-provider` npm package is unnecessary now: there is only one consumer (`apps/cirquiz`), and a separate package introduces Metro symlink resolution complexity with no current benefit. FR-012 (decoupled provider) is satisfied by a well-typed TypeScript interface in `src/providers/interface.ts` — no package boundary required.

**Metro configuration**: Because the provider is inside `apps/cirquiz` (not a cross-package symlink), `metro.config.js` can use the standard default config:
```javascript
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```

**EAS Build**: Always run `eas build` from within `apps/cirquiz/` — EAS reads `app.json`/`app.config.js` from the directory it is invoked in.

**Future `apps/api`**: When a custom trivia backend is added, it gets its own workspace at `apps/api/`. If shared types are needed across workspaces at that point, a `packages/shared` package can be introduced and the Metro cross-package configuration applied then.

**Alternatives considered**:
- Separate `packages/trivia-provider`: Provides a hard package boundary, but adds Metro watchFolders/nodeModulesPaths complexity for a single-consumer internal module.
- Turborepo: Adds caching and pipeline features; useful at scale but unnecessary overhead here.

---

## 3. State Management

**Decision**: Zustand for in-memory game state, with a persistence middleware layer writing to AsyncStorage.

**Critical: React Native requires a custom AsyncStorage adapter** — Zustand's `persist` middleware defaults to `localStorage` which does not exist in React Native. The store must be wired explicitly:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

persist(stateCreator, {
  name: '@cirquiz/active_game',
  storage: createJSONStorage(() => AsyncStorage),
})
```
Without `createJSONStorage`, the persist middleware silently fails to hydrate on relaunch (FR-013 would silently break).

**Rationale**: Zustand is lightweight (~1kB), has first-class TypeScript support, and its `persist` middleware integrates directly with AsyncStorage — satisfying FR-013 (game state survives closure/lock) with minimal boilerplate. React Context + useReducer is an alternative but becomes verbose for nested game state across many screens.

**Alternatives considered**:
- Redux Toolkit: Robust but heavyweight for a personal project.
- React Context: No extra dependency, but manual persistence wiring and performance concerns with deeply nested state.

---

## 4. Local Persistence

**Decision**: `@react-native-async-storage/async-storage` via Zustand's persist middleware.

**Rationale**: AsyncStorage is the standard key-value store for React Native; it is async, non-blocking, and survives app closure and device lock (FR-013). Game state is not sensitive, so expo-secure-store is unnecessary overhead.

**Alternatives considered**:
- expo-secure-store: Encrypted, but intended for sensitive data (tokens, credentials) — overkill for game state.
- SQLite (expo-sqlite): Relational, but the game state is a single JSON document and does not benefit from relational querying.

---

## 5. Localization

**Decision**: `i18next` + `react-i18next` with a single `en.json` strings file in `apps/cirquiz/src/i18n/`. Use `expo-localization` for device locale detection.

**React Native initialization notes**:
- Do NOT use the `initReactI18next` + browser language detector (`i18next-browser-languagedetector`) — that package is browser-only.
- Use `expo-localization` to read `Localization.locale` and pass it to `i18next.init()` as the `lng` option.
- Only required plugin is `initReactI18next`.

```typescript
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

i18n.use(initReactI18next).init({
  lng: Localization.locale,
  fallbackLng: 'en',
  resources: { en: { translation: en } },
});
```

**Rationale**: i18next is the most widely used i18n library in the React/React Native ecosystem, has strong TypeScript support, and makes adding a second language as simple as adding a new JSON file. Satisfies FR-018 (externalized strings, English first).

**Alternatives considered**:
- expo-localization alone: Provides locale detection but no string management.
- LinguiJS: Excellent but heavier tooling; better suited for teams than solo projects.

---

## 6. Open Trivia Database (OTDB) API

**Decision**: Use OTDB as the initial `TriviaQuestionProvider` implementation.

**Key API facts**:
- Base URL: `https://opentdb.com/api.php`
- Parameters: `amount` (1–50), `category` (numeric ID), `difficulty` (easy/medium/hard), `type` (multiple/boolean)
- Categories endpoint: `https://opentdb.com/api_category.php` — returns 24 categories (General Knowledge, Film, Music, Sports, History, Science, etc.)
- **Session tokens**: `https://opentdb.com/api_token.php?command=request` — returns a token that, when passed with each request, guarantees no question repeats until all questions in the pool are exhausted. This is the implementation mechanism for FR-020 (nice-to-have: no repeat questions across rounds).
- Questions are HTML-encoded (e.g., `&amp;`, `&#039;`) and must be decoded before display.
- Response codes: 0 = success, 1 = no results, 2 = invalid parameter, 3 = token not found, 4 = token empty (all questions exhausted).
- Rate limit: No hard published limit; a session token request per game session is sufficient.

**Response mapping to internal `Question` type**:
- `type: "multiple"` → `QuestionType.MultipleChoice`
- `type: "boolean"` → `QuestionType.TrueFalse`
- `correct_answer` + `incorrect_answers[]` → shuffled `options[]` with `correctAnswer` stored separately

**Rationale**: Free, no API key required for basic use, well-documented, supports all required parameters (count, category, difficulty, type), and session tokens natively support FR-020.

---

## 7. Testing

**Decision**: Jest + React Native Testing Library (RNTL) for unit and integration tests; no E2E testing in initial scope.

**Rationale**: Jest ships with Expo; RNTL is the standard testing library for React Native and aligns with the Testing Standards principle (P1 journeys must have happy-path test coverage). E2E testing (Detox/Maestro) is deferred — it requires device/emulator setup and is outside the scope of an initial personal project.

---

## 8. Navigation / Screen Structure

**Decision**: Expo Router with a `(game)` group route for all in-game screens.

**Screen map**:
```
app/
  index.tsx              → Home (New Game / Resume Game)
  setup.tsx              → Game setup
  (game)/
    handoff.tsx          → Handoff screen (multiplayer only)
    question.tsx         → Question screen
    reveal.tsx           → Answer reveal
    standings.tsx        → Final standings (end of round)
    error.tsx            → API error screen
```

**Rationale**: File-based routing makes the screen structure self-documenting. The `(game)` group keeps in-game screens together and allows shared layout (e.g., active player banner).

---

## 9. Environment Strategy (Development / Staging / Production)

**Decision**: Three EAS build profiles (`development`, `preview`, `production`) with per-environment configuration via `app.config.js` (dynamic config) reading from EAS environment variable groups.

**Why `app.config.js` instead of `app.json`**: Static `app.json` cannot read environment variables at build time. `app.config.js` (a JS file that exports a config object) runs at build time and can read `process.env.*` values injected by EAS, enabling per-environment values for app name, bundle ID suffix, API URLs, and feature flags.

**EAS profile → environment mapping**:

| Profile | Purpose | App name suffix | Bundle ID suffix | OTDB endpoint |
|---------|---------|----------------|-----------------|---------------|
| `development` | Local dev + dev client builds | ` (Dev)` | `.dev` | live OTDB |
| `preview` | Staging; prod-like internal testing | ` (Staging)` | `.staging` | live OTDB |
| `production` | App Store / Play Store release | (none) | (none) | live OTDB |

**`apps/cirquiz/eas.json` structure**:
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "APP_ENV": "staging" }
    },
    "production": {
      "env": { "APP_ENV": "production" }
    }
  }
}
```

**`apps/cirquiz/app.config.js` pattern**:
```javascript
const env = process.env.APP_ENV ?? 'development';
const suffixes = {
  development: { name: ' (Dev)', bundleId: '.dev' },
  staging:     { name: ' (Staging)', bundleId: '.staging' },
  production:  { name: '', bundleId: '' },
};
const s = suffixes[env] ?? suffixes.development;

module.exports = {
  name: `Cirquiz${s.name}`,
  ios: { bundleIdentifier: `com.cirquiz.app${s.bundleId}` },
  android: { package: `com.cirquiz.app${s.bundleId}` },
  extra: { appEnv: env },
};
```

**Accessing config at runtime** (via `expo-constants`):
```typescript
import Constants from 'expo-constants';
const appEnv = Constants.expoConfig?.extra?.appEnv ?? 'development';
```

**Local development**: Create `apps/cirquiz/.env.local` (gitignored) for any local overrides. `APP_ENV` defaults to `development` when running `npx expo start`.

**Note**: Since OTDB is a free public API with no auth, there is no separate staging API endpoint. The `preview` build tests production-equivalent behavior (real API, prod-like bundle) on internal devices before App Store submission.

**Alternatives considered**:
- `react-native-config`: Pre-Expo approach; redundant when `app.config.js` + EAS env vars handle the same need cleanly.
- Separate Expo projects per environment: More isolation but unnecessary overhead for a personal project.

---

## 10. Secrets Management

**Current state**: The initial OTDB integration requires no API key — OTDB is a free public API. However, the architecture must be set up correctly from day one so that secrets (if added later, e.g., a custom backend API key) are never committed to the repository.

**Rules**:
1. **Never commit secrets to git.** No `.env` files containing real secrets, no hardcoded credentials in source.
2. **Local development secrets**: Stored in `apps/cirquiz/.env.local` (gitignored). This file is never committed. A `.env.local.example` with placeholder values IS committed as a template.
3. **CI/EAS secrets**: Stored as EAS environment variables (set via `eas secret:create` or the Expo dashboard). These are injected at build time and never written to the repository.
4. **Runtime secrets** (if a future backend requires auth tokens): Retrieved from EAS environment variables at build time via `app.config.js` and accessed at runtime via `expo-constants`. They are baked into the binary — acceptable for a personal project, but note this means they are extractable from the binary. Do not use this pattern for user-facing auth tokens or PII.

**Gitignore entries required**:
```
apps/cirquiz/.env.local
apps/cirquiz/.env.*.local
```

**`.env.local.example`** (committed to repo as documentation):
```
# Copy this file to .env.local and fill in values for local development.
# Never commit .env.local.

# Example: custom backend URL (not needed for OTDB)
# CUSTOM_API_URL=https://your-api.example.com
```

**EAS secret management**:
```bash
# Set a secret for a specific environment
eas secret:create --scope project --name CUSTOM_API_KEY --value "your-value" --environment production
eas secret:create --scope project --name CUSTOM_API_KEY --value "your-staging-value" --environment preview

# List secrets (values are masked)
eas secret:list
```

Secrets set via EAS are available as `process.env.CUSTOM_API_KEY` in `app.config.js` at build time.

---

## 11. Areas Requiring Live Research Before Implementation

The React Native/Expo ecosystem changes rapidly. The following decisions should be verified against current documentation at implementation time — the choices below reflect best knowledge as of early 2026 but may have better alternatives by the time you build:

### 9a. Expo Router version and stability
Expo Router v3+ (shipped with Expo SDK 51+) introduced breaking changes to layouts and deep linking. Verify the latest SDK release notes before scaffolding. Specifically confirm: the `(group)/_layout.tsx` pattern still works as expected, and whether `expo-router` has stabilized its `<Stack>` and `<Tabs>` APIs.

### 9b. Zustand persist + AsyncStorage in new Expo SDKs
The `createJSONStorage(() => AsyncStorage)` pattern is current as of Zustand v4. If the project uses Zustand v5 (in beta at time of writing), the persist middleware API may differ. Verify before implementing the state layer.

### 9c. `@react-native-async-storage/async-storage` in Expo managed workflow
As of Expo SDK 50+, `expo-sqlite` has a much improved API and is now a viable alternative to AsyncStorage for simple key-value storage of JSON blobs. Worth re-evaluating at implementation time — `expo-sqlite` is now part of the Expo managed workflow and may offer better reliability guarantees than AsyncStorage.

### 9d. npm workspaces + Expo monorepo support
Expo's official monorepo guide has been updated multiple times. Verify the current recommended `metro.config.js` pattern in Expo's documentation at https://docs.expo.dev before scaffolding — the `watchFolders` + `nodeModulesPaths` approach described in research section 2 was current as of SDK 51 but Expo may have introduced a simpler first-class monorepo API since.

### 9e. New Architecture (Fabric/JSI) compatibility
Expo SDK 52+ enables the New Architecture by default. Verify that `@react-native-async-storage/async-storage` and `react-i18next` have stable New Architecture support before installing. Most major packages have caught up, but check before wiring persistence and i18n.

### 9f. EAS Build free tier limits
EAS Build's free tier has changed multiple times. Verify current build minute quotas on https://expo.dev/pricing before relying on free-tier CI builds for both iOS and Android.
