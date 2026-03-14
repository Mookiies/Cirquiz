export interface TriviaApiQuestion {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  correctAnswer: string;
  incorrectAnswers: string[];
  question: { text: string };
  type: string;
  tags: string[];
  regions: string[];
  isNiche: boolean;
}

export type TriviaApiResponse = TriviaApiQuestion[];
