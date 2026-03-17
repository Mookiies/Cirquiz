export type QuestionType = 'multiple-choice' | 'true-false';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'quick' | 'configured';
export type GameState = 'setup' | 'in-progress' | 'completed';
export type RoundState = 'in-progress' | 'completed';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string;
  category: string;
  difficulty: Difficulty;
}

export interface Category {
  id: string;
  name: string;
}

export interface QuestionFetchParams {
  count: number;
  category?: string;
  difficulty?: Difficulty;
  excludeIds?: string[];
  topicPrompt?: string;
}

export enum TriviaProviderErrorCode {
  NetworkError = 'NETWORK_ERROR',
  NoResults = 'NO_RESULTS',
  InvalidParams = 'INVALID_PARAMS',
  ProviderError = 'PROVIDER_ERROR',
  UserCancelled = 'USER_CANCELLED',
}

export class TriviaProviderError extends Error {
  constructor(
    message: string,
    public readonly code: TriviaProviderErrorCode
  ) {
    super(message);
    this.name = 'TriviaProviderError';
  }
}
