import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getAvatar } from '../avatars';
import { getProvider } from '../providers/providerFactory';
import { TriviaProviderError, TriviaProviderErrorCode } from '../providers/types';
import { useSettingsStore } from './settingsStore';
import { Game, GameConfig, Player, Round, Turn } from './types';

const STORAGE_KEY = '@cirquiz/active_game';
const CURRENT_SCHEMA_VERSION = 2;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface GameStoreState {
  game: Game | null;
  isHydrated: boolean;
  isLoading: boolean;
  pendingConfig: GameConfig | null;
  version: number;
  savedAt: string | null;
}

interface GameStoreActions {
  startGame: (config: GameConfig) => Promise<void>;
  retryFetch: () => Promise<void>;
  submitAnswer: (selectedAnswer: string) => void;
  advanceAfterReveal: () => void;
  startNextRound: () => Promise<void>;
  cancelFetch: () => void;
  quitGame: () => void;
  updateRoundConfig: (config: {
    category?: GameConfig['category'] | null;
    difficulty?: GameConfig['difficulty'] | null;
    mode?: GameConfig['mode'];
  }) => void;
}

type GameStore = GameStoreState & GameStoreActions;

function getCurrentRound(game: Game): Round {
  return game.rounds[game.currentRoundIndex];
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      isHydrated: false,
      isLoading: false,
      pendingConfig: null,
      version: CURRENT_SCHEMA_VERSION,
      savedAt: null,

      startGame: async (config: GameConfig) => {
        set({ isLoading: true, pendingConfig: config });
        const provider = getProvider(useSettingsStore.getState().questionSource);
        provider.resetSession();
        try {
          const questions = await provider.fetchQuestions({
            count: config.questionCount,
            category: config.category,
            difficulty: config.difficulty,
            topicPrompt: config.aiTopicPrompt,
          });

          const players: Player[] = config.players.map((p) => ({
            id: generateId(),
            name: p.name,
            avatar: p.avatar,
            color: getAvatar(p.avatar).color,
            roundScore: 0,
            cumulativeScore: 0,
          }));

          const round: Round = {
            id: generateId(),
            questions,
            turns: [],
            currentQuestionIndex: 0,
            currentPlayerIndex: 0,
            state: 'in-progress',
          };

          const game: Game = {
            id: generateId(),
            players,
            questionCount: config.questionCount,
            category: config.category ?? null,
            difficulty: config.difficulty ?? null,
            mode: config.mode,
            state: 'in-progress',
            rounds: [round],
            currentRoundIndex: 0,
            aiTopicPrompt: config.aiTopicPrompt ?? null,
          };

          set({ game, isLoading: false, pendingConfig: null, savedAt: new Date().toISOString() });

          const navigate = () => {
            if (players.length > 1) {
              router.replace('/(game)/handoff');
            } else {
              router.replace('/(game)/question');
            }
          };

          if (questions.length < config.questionCount) {
            Alert.alert(
              'Fewer Questions Available',
              `Only ${questions.length} question${questions.length === 1 ? '' : 's'} available (instead of ${config.questionCount}). The game will use ${questions.length} question${questions.length === 1 ? '' : 's'}.`,
              [{ text: 'OK', onPress: navigate }]
            );
          } else {
            navigate();
          }
        } catch (e) {
          set({ isLoading: false });
          if (
            e instanceof TriviaProviderError &&
            e.code === TriviaProviderErrorCode.UserCancelled
          ) {
            // User cancelled AI generation — stay on setup, no error screen
            return;
          }
          router.replace('/(game)/error');
        }
      },

      retryFetch: async () => {
        const { game, pendingConfig } = get();
        if (!game && pendingConfig) {
          return get().startGame(pendingConfig);
        } else if (game) {
          return get().startNextRound();
        }
      },

      submitAnswer: (selectedAnswer: string) => {
        const { game } = get();
        if (!game) return;

        const round = getCurrentRound(game);
        const currentQuestion = round.questions[round.currentQuestionIndex];
        const currentPlayer = game.players[round.currentPlayerIndex];
        const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

        const turn: Turn = {
          playerId: currentPlayer.id,
          questionId: currentQuestion.id,
          selectedAnswer,
          isCorrect,
        };

        const updatedPlayers = game.players.map((p) => {
          if (p.id === currentPlayer.id && isCorrect) {
            return {
              ...p,
              roundScore: p.roundScore + 1,
              cumulativeScore: p.cumulativeScore + 1,
            };
          }
          return p;
        });

        const updatedRound: Round = {
          ...round,
          turns: [...round.turns, turn],
        };

        const updatedRounds = game.rounds.map((r, i) =>
          i === game.currentRoundIndex ? updatedRound : r
        );

        const updatedGame: Game = {
          ...game,
          players: updatedPlayers,
          rounds: updatedRounds,
        };

        set({ game: updatedGame, savedAt: new Date().toISOString() });

        // Navigate to reveal after last player answers
        const isLastPlayer = round.currentPlayerIndex === game.players.length - 1;
        if (isLastPlayer) {
          router.replace('/(game)/reveal');
        } else {
          // Next player's handoff
          const nextRound: Round = {
            ...updatedRound,
            currentPlayerIndex: round.currentPlayerIndex + 1,
          };
          const nextRounds = updatedGame.rounds.map((r, i) =>
            i === updatedGame.currentRoundIndex ? nextRound : r
          );
          set({ game: { ...updatedGame, rounds: nextRounds }, savedAt: new Date().toISOString() });

          if (game.players.length > 1) {
            router.replace('/(game)/handoff');
          } else {
            router.replace('/(game)/question');
          }
        }
      },

      advanceAfterReveal: () => {
        const { game } = get();
        if (!game) return;

        const round = getCurrentRound(game);
        const isLastQuestion = round.currentQuestionIndex === round.questions.length - 1;

        if (isLastQuestion) {
          const completedRound: Round = { ...round, state: 'completed' };
          const updatedRounds = game.rounds.map((r, i) =>
            i === game.currentRoundIndex ? completedRound : r
          );
          const updatedGame: Game = {
            ...game,
            state: 'completed',
            rounds: updatedRounds,
          };
          set({ game: updatedGame, savedAt: new Date().toISOString() });
          router.replace('/(game)/standings');
        } else {
          const nextRound: Round = {
            ...round,
            currentQuestionIndex: round.currentQuestionIndex + 1,
            currentPlayerIndex: 0,
          };
          const updatedRounds = game.rounds.map((r, i) =>
            i === game.currentRoundIndex ? nextRound : r
          );
          set({ game: { ...game, rounds: updatedRounds }, savedAt: new Date().toISOString() });

          if (game.players.length > 1) {
            router.replace('/(game)/handoff');
          } else {
            router.replace('/(game)/question');
          }
        }
      },

      startNextRound: async () => {
        const { game } = get();
        if (!game) return;

        set({ isLoading: true });
        try {
          const previousQuestionIds = game.rounds.flatMap((r) => r.questions.map((q) => q.id));

          const questions = await getProvider(
            useSettingsStore.getState().questionSource
          ).fetchQuestions({
            count: game.questionCount,
            category: game.category ?? undefined,
            difficulty: game.difficulty ?? undefined,
            excludeIds: previousQuestionIds,
            topicPrompt: game.aiTopicPrompt ?? undefined,
          });

          const resetPlayers = game.players.map((p) => ({
            ...p,
            roundScore: 0,
          }));

          const newRound: Round = {
            id: generateId(),
            questions,
            turns: [],
            currentQuestionIndex: 0,
            currentPlayerIndex: 0,
            state: 'in-progress',
          };

          const updatedGame: Game = {
            ...game,
            players: resetPlayers,
            state: 'in-progress',
            rounds: [...game.rounds, newRound],
            currentRoundIndex: game.currentRoundIndex + 1,
          };

          set({ game: updatedGame, isLoading: false, savedAt: new Date().toISOString() });

          if (game.players.length > 1) {
            router.replace('/(game)/handoff');
          } else {
            router.replace('/(game)/question');
          }
        } catch (e) {
          set({ isLoading: false });
          if (
            e instanceof TriviaProviderError &&
            e.code === TriviaProviderErrorCode.UserCancelled
          ) {
            // User cancelled AI generation — return to standings, no error screen
            return;
          }
          router.replace('/(game)/error');
        }
      },

      cancelFetch: () => {
        const { questionSource } = useSettingsStore.getState();
        getProvider(questionSource).cancelFetch();
      },

      quitGame: () => {
        set({ game: null, savedAt: new Date().toISOString() });
      },

      updateRoundConfig: ({ category, difficulty, mode }) => {
        const { game } = get();
        if (!game) return;
        set({
          game: {
            ...game,
            ...(category !== undefined && { category }),
            ...(difficulty !== undefined && { difficulty }),
            ...(mode !== undefined && { mode }),
          },
          savedAt: new Date().toISOString(),
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ isLoading, isHydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (!state.version || state.version < CURRENT_SCHEMA_VERSION) {
            state.game = null;
          }
          state.version = CURRENT_SCHEMA_VERSION;
          state.isHydrated = true;
          state.isLoading = false;
        }
      },
    }
  )
);
