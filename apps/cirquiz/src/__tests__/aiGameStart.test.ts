/**
 * T029 — Happy-path: with modelStore.status === 'available' and a valid topic
 * prompt and mocked provider, startGame transitions the store to loading state.
 */

import { setProviderForTesting } from '../providers/providerFactory';
import { TriviaQuestionProvider } from '../providers/interface';
import { Question } from '../providers/types';
import { useSettingsStore } from '../state/settingsStore';
import { useGameStore } from '../state/gameStore';

// ─── Mock expo-router ─────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

// ─── Mock modelStore ──────────────────────────────────────────────────────────

jest.mock('../state/modelStore', () => ({
  useModelStore: {
    getState: () => ({ status: 'available', getContext: () => null }),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(n: number): Question {
  return {
    id: `q-${n}`,
    type: 'multiple-choice',
    text: `Question ${n}?`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    category: 'AI Generated',
    difficulty: 'medium',
  };
}

class MockAIProvider implements TriviaQuestionProvider {
  fetchQuestions = jest.fn().mockResolvedValue([makeQuestion(1), makeQuestion(2)]);
  fetchCategories = jest.fn().mockResolvedValue([]);
  supportsCategories = () => false;
  supportsDifficulty = () => true;
  resetSession = jest.fn();
  cancelFetch = jest.fn();
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('aiGameStart', () => {
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
    setProviderForTesting('ai-generated', mockProvider);
    useSettingsStore.setState({ questionSource: 'ai-generated' });
    useGameStore.setState({ game: null, isLoading: false, pendingConfig: null });
  });

  it('sets isLoading=true while startGame is running', async () => {
    let resolveQuestions!: (v: Question[]) => void;
    mockProvider.fetchQuestions.mockReturnValue(
      new Promise<Question[]>((resolve) => {
        resolveQuestions = resolve;
      })
    );

    const startPromise = useGameStore.getState().startGame({
      players: [{ name: 'Alice', avatar: 'chili' }],
      questionCount: 2,
      mode: 'quick',
      aiTopicPrompt: 'Ancient Rome',
    });

    // Should be loading
    expect(useGameStore.getState().isLoading).toBe(true);

    // Resolve and finish
    resolveQuestions([makeQuestion(1), makeQuestion(2)]);
    await startPromise;
  });

  it('calls fetchQuestions with the topicPrompt', async () => {
    await useGameStore.getState().startGame({
      players: [{ name: 'Alice', avatar: 'chili' }],
      questionCount: 2,
      mode: 'quick',
      aiTopicPrompt: 'Ancient Rome',
    });

    expect(mockProvider.fetchQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ topicPrompt: 'Ancient Rome' })
    );
  });
});
