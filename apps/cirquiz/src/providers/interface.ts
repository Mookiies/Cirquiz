import { Category, Question, QuestionFetchParams } from './types';

export interface TriviaQuestionProvider {
  fetchQuestions(params: QuestionFetchParams): Promise<Question[]>;
  fetchCategories(): Promise<Category[]>;
  supportsCategories(): boolean;
  supportsDifficulty(): boolean;
  /**
   * Resets the provider session so the next fetchQuestions call starts a fresh
   * question pool. Must be called when a new game starts; must NOT be called
   * between rounds so the session persists across rounds within the same game.
   */
  resetSession(): void;
  /**
   * Cancels an in-progress fetchQuestions call. No-op if no fetch is active.
   * AIQuestionProvider throws TriviaProviderError(UserCancelled) when interrupted.
   */
  cancelFetch(): void;
}
