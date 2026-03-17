/**
 * T027 — Happy-path: a full multi-round AI-source game with a mocked llama.rn
 * context and no network calls completes all rounds with correct scoring.
 */

import { setProviderForTesting } from '../providers/providerFactory';
import { TriviaQuestionProvider } from '../providers/interface';
import { Question } from '../providers/types';
import { useSettingsStore } from '../state/settingsStore';
import { useGameStore } from '../state/gameStore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

jest.mock('../state/modelStore', () => ({
  useModelStore: {
    getState: () => ({ status: 'available', getContext: () => ({}) }),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(id: string): Question {
  return {
    id,
    type: 'multiple-choice',
    text: `What is ${id}?`,
    options: ['correct', 'wrong1', 'wrong2', 'wrong3'],
    correctAnswer: 'correct',
    category: 'AI Generated',
    difficulty: 'medium',
  };
}

class OfflineMockProvider implements TriviaQuestionProvider {
  private callCount = 0;

  fetchQuestions = jest.fn().mockImplementation(() => {
    this.callCount++;
    return Promise.resolve([
      makeQuestion(`q${this.callCount}a`),
      makeQuestion(`q${this.callCount}b`),
    ]);
  });

  fetchCategories = jest.fn().mockResolvedValue([]);
  supportsCategories = () => false;
  supportsDifficulty = () => true;
  resetSession = jest.fn();
  cancelFetch = jest.fn();
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('offline AI game — happy path', () => {
  let mockProvider: OfflineMockProvider;

  beforeEach(() => {
    mockProvider = new OfflineMockProvider();
    setProviderForTesting('ai-generated', mockProvider);
    useSettingsStore.setState({ questionSource: 'ai-generated' });
    useGameStore.setState({
      game: null,
      isLoading: false,
      pendingConfig: null,
    });
  });

  it('completes a full game with correct scoring and no errors', async () => {
    // Start game (round 1)
    await useGameStore.getState().startGame({
      players: [{ name: 'Alice', avatar: 'chili' }],
      questionCount: 2,
      mode: 'quick',
      aiTopicPrompt: 'Space',
    });

    const gameAfterStart = useGameStore.getState().game;
    expect(gameAfterStart).not.toBeNull();
    expect(gameAfterStart!.rounds).toHaveLength(1);
    expect(gameAfterStart!.rounds[0].questions).toHaveLength(2);

    // Answer both questions correctly
    useGameStore.getState().submitAnswer('correct'); // q1
    useGameStore.getState().advanceAfterReveal();
    useGameStore.getState().submitAnswer('correct'); // q2
    useGameStore.getState().advanceAfterReveal();

    // Game should be completed after last question
    const completedGame = useGameStore.getState().game;
    expect(completedGame!.state).toBe('completed');
    expect(completedGame!.players[0].cumulativeScore).toBe(2);

    // No network calls were made
    expect(global.fetch).not.toBeDefined();
  });

  it('uses aiTopicPrompt in subsequent rounds', async () => {
    await useGameStore.getState().startGame({
      players: [{ name: 'Alice', avatar: 'chili' }],
      questionCount: 2,
      mode: 'quick',
      aiTopicPrompt: 'Oceans',
    });

    // Answer both questions to complete round 1
    useGameStore.getState().submitAnswer('correct');
    useGameStore.getState().advanceAfterReveal();
    useGameStore.getState().submitAnswer('correct');
    useGameStore.getState().advanceAfterReveal();

    // Start round 2 (game is now completed, change state back)
    useGameStore.setState((s) => ({
      game: s.game ? { ...s.game, state: 'in-progress' } : null,
    }));

    await useGameStore.getState().startNextRound();

    expect(mockProvider.fetchQuestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ topicPrompt: 'Oceans' })
    );
  });
});
