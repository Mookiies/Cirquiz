export interface OtdbQuestion {
  type: 'multiple' | 'boolean';
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

export interface OtdbResponse {
  response_code: number;
  results: OtdbQuestion[];
}

export interface OtdbTokenResponse {
  response_code: number;
  response_message: string;
  token: string;
}
