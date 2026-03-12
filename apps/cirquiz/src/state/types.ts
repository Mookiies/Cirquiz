import { Difficulty, GameMode, GameState, Question, RoundState } from '../providers/types';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  roundScore: number;
  cumulativeScore: number;
}

export interface Turn {
  playerId: string;
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export interface Round {
  id: string;
  questions: Question[];
  turns: Turn[];
  currentQuestionIndex: number;
  currentPlayerIndex: number;
  state: RoundState;
}

export interface Game {
  id: string;
  players: Player[];
  questionCount: number;
  category: string | null;
  difficulty: Difficulty | null;
  mode: GameMode;
  state: GameState;
  rounds: Round[];
  currentRoundIndex: number;
}

export interface GameConfig {
  players: { name: string; avatar: string }[];
  questionCount: number;
  category?: string;
  difficulty?: Difficulty;
  mode: GameMode;
}
