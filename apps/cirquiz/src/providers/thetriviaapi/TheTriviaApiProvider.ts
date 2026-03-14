import { shuffle } from '../../utils/shuffle';
import { TriviaQuestionProvider } from '../interface';
import {
  Category,
  Difficulty,
  Question,
  QuestionFetchParams,
  TriviaProviderError,
  TriviaProviderErrorCode,
} from '../types';
import { TriviaApiQuestion, TriviaApiResponse } from './triviaApiTypes';

const BASE_URL = 'https://the-trivia-api.com/v2';

export class TheTriviaApiProvider implements TriviaQuestionProvider {
  async fetchQuestions(params: QuestionFetchParams): Promise<Question[]> {
    const url = new URL(`${BASE_URL}/questions`);
    url.searchParams.set('limit', String(params.count));
    if (params.category) url.searchParams.set('categories', params.category);
    if (params.difficulty) url.searchParams.set('difficulties', params.difficulty);

    let data: TriviaApiResponse;
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new TriviaProviderError('Network error', TriviaProviderErrorCode.NetworkError);
      }
      data = await res.json();
    } catch (e) {
      if (e instanceof TriviaProviderError) throw e;
      throw new TriviaProviderError('Network error', TriviaProviderErrorCode.NetworkError);
    }

    if (!data || data.length === 0) {
      throw new TriviaProviderError('No results available', TriviaProviderErrorCode.NoResults);
    }

    return data.map(
      (q: TriviaApiQuestion): Question => ({
        id: q.id,
        type: 'multiple-choice',
        text: q.question.text,
        correctAnswer: q.correctAnswer,
        options: shuffle([q.correctAnswer, ...q.incorrectAnswers]),
        category: q.category,
        difficulty: q.difficulty as Difficulty,
      })
    );
  }

  fetchCategories(): Promise<Category[]> {
    return Promise.resolve([
      { id: 'arts_and_literature', name: 'Arts & Literature' },
      { id: 'film_and_tv', name: 'Film & TV' },
      { id: 'food_and_drink', name: 'Food & Drink' },
      { id: 'general_knowledge', name: 'General Knowledge' },
      { id: 'geography', name: 'Geography' },
      { id: 'history', name: 'History' },
      { id: 'music', name: 'Music' },
      { id: 'science', name: 'Science' },
      { id: 'society_and_culture', name: 'Society & Culture' },
      { id: 'sport_and_leisure', name: 'Sport & Leisure' },
    ]);
  }

  supportsCategories(): boolean {
    return true;
  }

  supportsDifficulty(): boolean {
    return true;
  }

  resetSession(): void {
    // no-op — stateless API on the free tier
  }
}
