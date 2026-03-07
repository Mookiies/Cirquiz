# Quickstart: Pass-and-Play Trivia Game

## Prerequisites

- Node.js >= 18
- Yarn >= 1.22: `npm install -g yarn`
- EAS CLI: `yarn global add eas-cli`
- For iOS simulator: Xcode (macOS only)
- For Android emulator: Android Studio with an AVD configured

---

## 1. Clone and Install

```bash
git clone <repo-url> cirquiz
cd cirquiz
yarn install          # installs all workspace packages (apps/mobile)
```

Root `package.json` structure:
```json
{
  "name": "cirquiz",
  "private": true,
  "workspaces": ["apps/*"]
}
```

---

## 2. Run the App Locally

```bash
cd apps/mobile
yarn expo start
```

- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with the Expo Go app on a physical device

---

## 3. Run Tests

```bash
cd apps/mobile
yarn test
```

---

## 4. Local Environment Setup

```bash
cd apps/mobile
cp .env.local.example .env.local
# Edit .env.local if you have any local overrides (none required for OTDB)
```

`.env.local` is gitignored and must never be committed. `APP_ENV` defaults to `development` when running `yarn expo start`.

---

## 5. Build with EAS

Always run EAS commands from `apps/mobile/` — EAS looks for `app.config.js` in the current directory.

```bash
cd apps/mobile
eas login   # authenticate (first time only)

# Development build — dev client, internal distribution
eas build --profile development --platform all

# Staging build — prod-like binary, internal distribution (TestFlight / internal track)
eas build --profile preview --platform all

# Production build — App Store / Play Store
eas build --profile production --platform all
```

**Managing secrets in EAS** (run when adding a new secret):
```bash
# Set a secret per environment (values are masked in logs)
eas secret:create --scope project --name MY_SECRET --value "value" --environment production
eas secret:create --scope project --name MY_SECRET --value "value" --environment preview
eas secret:create --scope project --name MY_SECRET --value "value" --environment development

eas secret:list   # verify secrets are registered (values masked)
```

Secrets are injected as `process.env.MY_SECRET` into `app.config.js` at build time.

---

## 6. Validate the TriviaQuestionProvider

To verify the OTDB provider is working against the live API:

```bash
cd apps/mobile
yarn validate   # runs a live smoke-test against opentdb.com
```

Expected output: 10 questions returned, categories list non-empty.

---

## 7. Validate a Full Game Flow (Manual)

1. Launch the app.
2. Tap **New Game**.
3. Add 2 players with distinct names and colors.
4. Set question count to 5, tap **Quick Play**.
5. Confirm the first handoff screen appears for Player 1.
6. Tap "I'm Ready" — confirm the question screen shows Player 1's name and color.
7. Select any answer — confirm the answer is recorded and Player 2's handoff screen appears.
8. Repeat until all players have answered Question 1.
9. Confirm the Answer Reveal screen shows the correct answer, each player's chosen answer, and updated scores.
10. Complete all 5 questions and confirm the Final Standings screen appears.
11. Tap **Play Another Round** — confirm the same players and cumulative scores are present.
12. Background the app mid-game and reopen — confirm the game resumes at the correct screen.

---

## 8. Project Structure Reference

```
cirquiz/
├── apps/
│   └── mobile/               # Expo React Native app
│       ├── app/              # Expo Router screens
│       │   ├── index.tsx     # Home screen
│       │   ├── setup.tsx     # Game setup
│       │   └── (game)/       # In-game screens (handoff, question, reveal, standings)
│       ├── src/
│       │   ├── providers/    # TriviaQuestionProvider interface + OTDB implementation
│       │   ├── components/   # Custom RN components
│       │   ├── state/        # Zustand game state store
│       │   ├── i18n/         # Localization strings (en.json)
│       │   ├── hooks/        # Custom React hooks
│       │   └── utils/        # Helpers (HTML decode, shuffle, etc.)
│       ├── __tests__/
│       ├── app.config.js
│       └── eas.json
├── package.json              # Workspace root (workspaces: ["apps/*"])
└── specs/                    # Feature specifications and plans
```
