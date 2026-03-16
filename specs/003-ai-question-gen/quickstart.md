# Quickstart: AI-Generated Trivia Questions

**Feature**: 003-ai-question-gen

---

## Prerequisites

```bash
# From monorepo root
yarn workspace cirquiz typecheck   # must pass before starting
```

## New Dependencies to Install

Run from `apps/cirquiz/` (not monorepo root — native modules):

```bash
cd apps/cirquiz

# On-device LLM inference (llama.cpp bindings for React Native)
npx expo install llama.rn

# Large file download (streams to disk; no background download — app must stay open)
npx expo install @dr.pogodin/react-native-fs
```

After install, rebuild native:

```bash
# iOS
cd ios && pod install && cd ..
yarn workspace cirquiz ios

# Android
yarn workspace cirquiz android
```

## Key Files to Create

```
apps/cirquiz/src/
  providers/aigen/
    AIQuestionProvider.ts     ← main provider class
    aiPrompts.ts              ← GBNF grammar + prompt builder
    questionParser.ts         ← validates raw LLM output
  state/
    modelStore.ts             ← model download state (Zustand)
  services/
    modelDownloadService.ts   ← wraps @dr.pogodin/react-native-fs (RNFS.downloadFile)
```

## Key Files to Modify

```
apps/cirquiz/src/providers/types.ts        ← add topicPrompt to QuestionFetchParams
apps/cirquiz/src/providers/providerFactory.ts ← add ai-generated case
apps/cirquiz/src/state/settingsStore.ts    ← add ai-generated to QuestionSource
apps/cirquiz/src/state/types.ts           ← add aiTopicPrompt to GameConfig + Game
apps/cirquiz/src/state/gameStore.ts       ← thread aiTopicPrompt through startGame/startNextRound
apps/cirquiz/app/settings.tsx             ← add AI source row + model status
apps/cirquiz/app/setup.tsx                ← add topic prompt input for AI source
apps/cirquiz/src/i18n/en.json             ← new keys
```

## Running Quality Gates

```bash
yarn workspace cirquiz lint
yarn workspace cirquiz format
yarn workspace cirquiz typecheck
```

## Model File

The Phi-3.5-mini-instruct GGUF model is **not bundled in the app**. It is downloaded at runtime via the in-app download flow. For local development and testing, you can manually place the model file:

```bash
# iOS Simulator: place file anywhere accessible, use absolute path in modelStore
# Physical device: model is saved to the app's documents directory by the download service
```

Model source: `bartowski/Phi-3.5-mini-instruct-GGUF` on Hugging Face
File: `Phi-3.5-mini-instruct-Q4_K_M.gguf` (~2.39 GB)

## Architecture Overview

```
Settings screen
  └─ SelectableRow "AI Generated"
       └─ model status badge (not_downloaded / downloading / available / error)
       └─ Download button / progress bar (when not_downloaded or error)
            └─ modelDownloadService.ts
                 └─ @dr.pogodin/react-native-fs (RNFS.downloadFile)
                 └─ integrity check on complete
            └─ modelStore.ts (Zustand)

Setup screen (when AI source active)
  └─ Topic prompt TextInput (replaces CategorySelector)
       └─ Validation: min 3 chars before game start

gameStore.startGame / startNextRound
  └─ getProvider('ai-generated') → AIQuestionProvider
       └─ fetchQuestions({ count, difficulty, topicPrompt, excludeIds })
            └─ aiPrompts.ts → builds system prompt + user prompt + GBNF grammar
            └─ llama.rn → constrained inference → raw JSON string
            └─ questionParser.ts → validates each item → Question[]
            └─ throws TriviaProviderError on insufficient valid questions
```
