import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { setProviderForTesting } from '../../providers/providerFactory';
import { useGameStore } from '../gameStore';
import { Question, TriviaProviderError, TriviaProviderErrorCode } from '../../providers/types';
import { Game, Player, Round } from '../types';
import { useSettingsStore } from '../settingsStore';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockRouterReplace = router.replace as jest.Mock;

const mockFetchQuestions = jest.fn<Promise<Question[]>, [any]>();
const mockProvider = {
  fetchQuestions: mockFetchQuestions,
  fetchCategories: jest.fn().mockResolvedValue([]),
  supportsCategories: () => true,
  supportsDifficulty: () => true,
  resetSession: jest.fn(),
  cancelFetch: jest.fn(),
};

beforeAll(() => setProviderForTesting('the-trivia-api', mockProvider));

const makeQuestion = (id: string, correctAnswer = 'A'): Question => ({
  id,
  type: 'multiple-choice',
  text: `Question ${id}`,
  options: ['A', 'B', 'C', 'D'],
  correctAnswer,
  category: 'General',
  difficulty: 'easy',
});

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  name: 'Alice',
  avatar: 'chili',
  color: '#E74C3C',
  roundScore: 0,
  cumulativeScore: 0,
  ...overrides,
});

const makeRound = (overrides: Partial<Round> = {}): Round => ({
  id: 'r1',
  questions: [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3')],
  turns: [],
  currentQuestionIndex: 0,
  currentPlayerIndex: 0,
  state: 'in-progress',
  ...overrides,
});

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 'g1',
  players: [makePlayer()],
  questionCount: 3,
  category: null,
  difficulty: null,
  mode: 'quick',
  state: 'in-progress',
  rounds: [makeRound()],
  currentRoundIndex: 0,
  aiTopicPrompt: null,
  ...overrides,
});

beforeEach(() => {
  useGameStore.setState({
    game: null,
    isHydrated: false,
    isLoading: false,
    version: 1,
    savedAt: null,
  });
  mockRouterReplace.mockClear();
  mockFetchQuestions.mockClear();
});

// ─── submitAnswer ────────────────────────────────────────────────────────────

describe('submitAnswer', () => {
  it('correct answer increments roundScore and cumulativeScore by 1', () => {
    useGameStore.setState({ game: makeGame() });
    useGameStore.getState().submitAnswer('A');
    const { game } = useGameStore.getState();
    expect(game!.players[0].roundScore).toBe(1);
    expect(game!.players[0].cumulativeScore).toBe(1);
  });

  it('wrong answer leaves scores unchanged', () => {
    useGameStore.setState({ game: makeGame() });
    useGameStore.getState().submitAnswer('B');
    const { game } = useGameStore.getState();
    expect(game!.players[0].roundScore).toBe(0);
    expect(game!.players[0].cumulativeScore).toBe(0);
  });

  it('records turn with correct isCorrect flag', () => {
    useGameStore.setState({ game: makeGame() });
    useGameStore.getState().submitAnswer('A');
    const { game } = useGameStore.getState();
    const turn = game!.rounds[0].turns[0];
    expect(turn.isCorrect).toBe(true);
    expect(turn.selectedAnswer).toBe('A');
  });

  it('single player navigates to /(game)/reveal', () => {
    useGameStore.setState({ game: makeGame() });
    useGameStore.getState().submitAnswer('A');
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/reveal');
  });

  it('multi-player non-last player increments currentPlayerIndex and navigates to /(game)/handoff', () => {
    const game = makeGame({
      players: [makePlayer({ id: 'p1', name: 'Alice' }), makePlayer({ id: 'p2', name: 'Bob' })],
    });
    useGameStore.setState({ game });
    useGameStore.getState().submitAnswer('A');
    const { game: updated } = useGameStore.getState();
    expect(updated!.rounds[0].currentPlayerIndex).toBe(1);
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/handoff');
  });

  it('multi-player last player navigates to /(game)/reveal', () => {
    const game = makeGame({
      players: [makePlayer({ id: 'p1', name: 'Alice' }), makePlayer({ id: 'p2', name: 'Bob' })],
      rounds: [makeRound({ currentPlayerIndex: 1 })],
    });
    useGameStore.setState({ game });
    useGameStore.getState().submitAnswer('A');
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/reveal');
  });

  it('only increments score for the current player', () => {
    const game = makeGame({
      players: [makePlayer({ id: 'p1', name: 'Alice' }), makePlayer({ id: 'p2', name: 'Bob' })],
    });
    useGameStore.setState({ game });
    useGameStore.getState().submitAnswer('A');
    const { game: updated } = useGameStore.getState();
    expect(updated!.players[0].roundScore).toBe(1);
    expect(updated!.players[1].roundScore).toBe(0);
  });

  it('no-op when game is null', () => {
    useGameStore.setState({ game: null });
    useGameStore.getState().submitAnswer('A');
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

// ─── advanceAfterReveal ──────────────────────────────────────────────────────

describe('advanceAfterReveal', () => {
  it('last question: sets round.state=completed, game.state=completed, navigates to standings', () => {
    const game = makeGame({
      rounds: [makeRound({ currentQuestionIndex: 2 })],
    });
    useGameStore.setState({ game });
    useGameStore.getState().advanceAfterReveal();
    const { game: updated } = useGameStore.getState();
    expect(updated!.state).toBe('completed');
    expect(updated!.rounds[0].state).toBe('completed');
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/standings');
  });

  it('non-last question: increments currentQuestionIndex, resets currentPlayerIndex to 0', () => {
    const game = makeGame({
      rounds: [makeRound({ currentQuestionIndex: 0, currentPlayerIndex: 1 })],
    });
    useGameStore.setState({ game });
    useGameStore.getState().advanceAfterReveal();
    const { game: updated } = useGameStore.getState();
    expect(updated!.rounds[0].currentQuestionIndex).toBe(1);
    expect(updated!.rounds[0].currentPlayerIndex).toBe(0);
  });

  it('single player, non-last: navigates to /(game)/question', () => {
    useGameStore.setState({ game: makeGame() });
    useGameStore.getState().advanceAfterReveal();
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/question');
  });

  it('multi-player, non-last: navigates to /(game)/handoff', () => {
    const game = makeGame({
      players: [makePlayer({ id: 'p1', name: 'Alice' }), makePlayer({ id: 'p2', name: 'Bob' })],
    });
    useGameStore.setState({ game });
    useGameStore.getState().advanceAfterReveal();
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/handoff');
  });

  it('no-op when game is null', () => {
    useGameStore.setState({ game: null });
    useGameStore.getState().advanceAfterReveal();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

// ─── startNextRound ──────────────────────────────────────────────────────────

describe('startNextRound', () => {
  const newQuestions = [makeQuestion('q4'), makeQuestion('q5'), makeQuestion('q6')];

  beforeEach(() => {
    mockFetchQuestions.mockResolvedValue(newQuestions);
  });

  it('resets all players roundScore to 0', async () => {
    const game = makeGame({
      players: [
        makePlayer({ id: 'p1', name: 'Alice', roundScore: 3, cumulativeScore: 3 }),
        makePlayer({ id: 'p2', name: 'Bob', roundScore: 1, cumulativeScore: 1 }),
      ],
    });
    useGameStore.setState({ game });
    await useGameStore.getState().startNextRound();
    const { game: updated } = useGameStore.getState();
    expect(updated!.players[0].roundScore).toBe(0);
    expect(updated!.players[1].roundScore).toBe(0);
  });

  it('preserves cumulativeScore on all players', async () => {
    const game = makeGame({
      players: [
        makePlayer({ id: 'p1', name: 'Alice', roundScore: 3, cumulativeScore: 3 }),
        makePlayer({ id: 'p2', name: 'Bob', roundScore: 1, cumulativeScore: 1 }),
      ],
    });
    useGameStore.setState({ game });
    await useGameStore.getState().startNextRound();
    const { game: updated } = useGameStore.getState();
    expect(updated!.players[0].cumulativeScore).toBe(3);
    expect(updated!.players[1].cumulativeScore).toBe(1);
  });

  it('appends a new round', async () => {
    useGameStore.setState({ game: makeGame() });
    await useGameStore.getState().startNextRound();
    const { game: updated } = useGameStore.getState();
    expect(updated!.rounds).toHaveLength(2);
  });

  it('increments currentRoundIndex by 1', async () => {
    useGameStore.setState({ game: makeGame() });
    await useGameStore.getState().startNextRound();
    const { game: updated } = useGameStore.getState();
    expect(updated!.currentRoundIndex).toBe(1);
  });

  it('sets game.state back to in-progress', async () => {
    useGameStore.setState({ game: makeGame({ state: 'completed' }) });
    await useGameStore.getState().startNextRound();
    const { game: updated } = useGameStore.getState();
    expect(updated!.state).toBe('in-progress');
  });

  it('calls fetchQuestions with excludeIds from previous rounds', async () => {
    useGameStore.setState({ game: makeGame() });
    await useGameStore.getState().startNextRound();
    expect(mockFetchQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ excludeIds: ['q1', 'q2', 'q3'] })
    );
  });

  it('single player navigates to /(game)/question', async () => {
    useGameStore.setState({ game: makeGame() });
    await useGameStore.getState().startNextRound();
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/question');
  });

  it('multi-player navigates to /(game)/handoff', async () => {
    const game = makeGame({
      players: [makePlayer({ id: 'p1', name: 'Alice' }), makePlayer({ id: 'p2', name: 'Bob' })],
    });
    useGameStore.setState({ game });
    await useGameStore.getState().startNextRound();
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/handoff');
  });

  it('on TriviaProviderError: sets isLoading false, navigates to /(game)/error', async () => {
    mockFetchQuestions.mockRejectedValue(
      new TriviaProviderError('No results', TriviaProviderErrorCode.NoResults)
    );
    useGameStore.setState({ game: makeGame() });
    await useGameStore.getState().startNextRound();
    expect(useGameStore.getState().isLoading).toBe(false);
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/error');
  });

  it('on unknown error: sets isLoading false, navigates to /(game)/error', async () => {
    mockFetchQuestions.mockRejectedValue(new Error('Unexpected'));
    useGameStore.setState({ game: makeGame() });
    await useGameStore.getState().startNextRound();
    expect(useGameStore.getState().isLoading).toBe(false);
    expect(mockRouterReplace).toHaveBeenCalledWith('/(game)/error');
  });

  it('no-op when game is null', async () => {
    useGameStore.setState({ game: null });
    await useGameStore.getState().startNextRound();
    expect(mockFetchQuestions).not.toHaveBeenCalled();
  });
});

// ─── quitGame ────────────────────────────────────────────────────────────────

describe('quitGame', () => {
  it('sets game to null', () => {
    useGameStore.setState({ game: makeGame() });
    useGameStore.getState().quitGame();
    expect(useGameStore.getState().game).toBeNull();
  });
});

// ─── updateRoundConfig ───────────────────────────────────────────────────────

describe('updateRoundConfig', () => {
  it('updates category, difficulty, and mode when provided', () => {
    useGameStore.setState({ game: makeGame() });
    useGameStore.getState().updateRoundConfig({
      category: 'Science',
      difficulty: 'hard',
      mode: 'configured',
    });
    const { game } = useGameStore.getState();
    expect(game!.category).toBe('Science');
    expect(game!.difficulty).toBe('hard');
    expect(game!.mode).toBe('configured');
  });

  it('passing null explicitly updates the field', () => {
    useGameStore.setState({ game: makeGame({ category: 'History', difficulty: 'easy' }) });
    useGameStore.getState().updateRoundConfig({ category: null, difficulty: null });
    const { game } = useGameStore.getState();
    expect(game!.category).toBeNull();
    expect(game!.difficulty).toBeNull();
  });

  it('passing undefined does NOT overwrite the field', () => {
    useGameStore.setState({ game: makeGame({ category: 'History', difficulty: 'easy' }) });
    useGameStore.getState().updateRoundConfig({ category: undefined, difficulty: undefined });
    const { game } = useGameStore.getState();
    expect(game!.category).toBe('History');
    expect(game!.difficulty).toBe('easy');
  });

  it('no-op when game is null', () => {
    useGameStore.setState({ game: null });
    useGameStore.getState().updateRoundConfig({ category: 'Science' });
    expect(useGameStore.getState().game).toBeNull();
  });
});

// ─── Happy path: full 2-player, 2-question game ──────────────────────────────

describe('happy path: 2-player 2-question game', () => {
  it('walks through every action from first question to standings', () => {
    const q1 = makeQuestion('q1', 'Paris');
    const q2 = makeQuestion('q2', 'Jupiter');
    const alice = makePlayer({ id: 'alice', name: 'Alice' });
    const bob = makePlayer({ id: 'bob', name: 'Bob' });

    useGameStore.setState({
      game: makeGame({
        players: [alice, bob],
        rounds: [makeRound({ questions: [q1, q2] })],
      }),
    });

    const store = () => useGameStore.getState();

    // ── Q1: Alice answers correctly ──
    store().submitAnswer('Paris');
    expect(store().game!.players[0].roundScore).toBe(1);
    expect(store().game!.rounds[0].currentPlayerIndex).toBe(1);
    expect(mockRouterReplace).toHaveBeenLastCalledWith('/(game)/handoff');

    // ── Q1: Bob answers incorrectly ──
    store().submitAnswer('London');
    expect(store().game!.players[1].roundScore).toBe(0);
    expect(mockRouterReplace).toHaveBeenLastCalledWith('/(game)/reveal');

    // ── Advance to Q2: reset player index to 0 ──
    store().advanceAfterReveal();
    expect(store().game!.rounds[0].currentQuestionIndex).toBe(1);
    expect(store().game!.rounds[0].currentPlayerIndex).toBe(0);
    expect(mockRouterReplace).toHaveBeenLastCalledWith('/(game)/handoff');

    // ── Q2: Alice answers incorrectly ──
    store().submitAnswer('Mars');
    expect(store().game!.players[0].roundScore).toBe(1); // unchanged
    expect(store().game!.rounds[0].currentPlayerIndex).toBe(1);
    expect(mockRouterReplace).toHaveBeenLastCalledWith('/(game)/handoff');

    // ── Q2: Bob answers correctly ──
    store().submitAnswer('Jupiter');
    expect(store().game!.players[1].roundScore).toBe(1);
    expect(mockRouterReplace).toHaveBeenLastCalledWith('/(game)/reveal');

    // ── Last question: advance to standings ──
    store().advanceAfterReveal();
    expect(store().game!.state).toBe('completed');
    expect(store().game!.rounds[0].state).toBe('completed');
    expect(mockRouterReplace).toHaveBeenLastCalledWith('/(game)/standings');

    // ── Final scores: Alice 1, Bob 1 ──
    expect(store().game!.players[0].roundScore).toBe(1);
    expect(store().game!.players[0].cumulativeScore).toBe(1);
    expect(store().game!.players[1].roundScore).toBe(1);
    expect(store().game!.players[1].cumulativeScore).toBe(1);

    // ── Turns recorded correctly ──
    const turns = store().game!.rounds[0].turns;
    expect(turns).toHaveLength(4);
    expect(turns[0]).toMatchObject({ playerId: 'alice', questionId: 'q1', isCorrect: true });
    expect(turns[1]).toMatchObject({ playerId: 'bob', questionId: 'q1', isCorrect: false });
    expect(turns[2]).toMatchObject({ playerId: 'alice', questionId: 'q2', isCorrect: false });
    expect(turns[3]).toMatchObject({ playerId: 'bob', questionId: 'q2', isCorrect: true });
  });
});

// ─── Hydrate ─────────────────────────────────────────────────────────────────

describe('Hydrate', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('current schema version: restores game and sets isHydrated', async () => {
    const game = makeGame();
    await AsyncStorage.setItem(
      '@cirquiz/active_game',
      JSON.stringify({
        state: { game, version: 2, pendingConfig: null, savedAt: null },
        version: 0,
      })
    );
    await useGameStore.persist.rehydrate();
    const state = useGameStore.getState();
    expect(state.isHydrated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.game).not.toBeNull();
    expect(state.game!.id).toBe(game.id);
  });

  it('outdated schema version: wipes game', async () => {
    await AsyncStorage.setItem(
      '@cirquiz/active_game',
      JSON.stringify({
        state: { game: makeGame(), version: 1, pendingConfig: null, savedAt: null },
        version: 0,
      })
    );
    await useGameStore.persist.rehydrate();
    const state = useGameStore.getState();
    expect(state.isHydrated).toBe(true);
    expect(state.game).toBeNull();
  });

  it('missing version field: wipes game', async () => {
    await AsyncStorage.setItem(
      '@cirquiz/active_game',
      JSON.stringify({
        state: { game: makeGame(), pendingConfig: null, savedAt: null },
        version: 0,
      })
    );
    await useGameStore.persist.rehydrate();
    const state = useGameStore.getState();
    expect(state.isHydrated).toBe(true);
    expect(state.game).toBeNull();
  });

  it('no stored state (fresh install): preserves null game', async () => {
    await useGameStore.persist.rehydrate();
    const state = useGameStore.getState();
    expect(state.isHydrated).toBe(true);
    expect(state.game).toBeNull();
  });
});

// ─── Provider source switching ────────────────────────────────────────────────

describe('startGame uses provider matching active questionSource', () => {
  const questions = [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3')];

  it('uses TheTriviaApiProvider when questionSource is the-trivia-api', async () => {
    const ttaMockFetch = jest.fn<Promise<Question[]>, [any]>().mockResolvedValue(questions);
    const ttaMockProvider = {
      fetchQuestions: ttaMockFetch,
      fetchCategories: jest.fn().mockResolvedValue([]),
      supportsCategories: () => true,
      supportsDifficulty: () => true,
      resetSession: jest.fn(),
      cancelFetch: jest.fn(),
    };
    setProviderForTesting('the-trivia-api', ttaMockProvider);
    useSettingsStore.setState({ questionSource: 'the-trivia-api' });

    await useGameStore.getState().startGame({
      players: [{ name: 'Alice', avatar: 'chili' }],
      questionCount: 3,
      mode: 'quick',
    });

    expect(ttaMockFetch).toHaveBeenCalled();
    expect(mockFetchQuestions).not.toHaveBeenCalled();

    // Restore
    useSettingsStore.setState({ questionSource: 'otdb' });
  });
});
