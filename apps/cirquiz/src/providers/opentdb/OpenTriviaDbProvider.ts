import { htmlDecode } from '../../utils/htmlDecode';
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
import { OtdbResponse, OtdbTokenResponse } from './otdbTypes';

const BASE_URL = 'https://opentdb.com';

export class OpenTriviaDbProvider implements TriviaQuestionProvider {
  private token: string | null = null;

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    const res = await fetch(`${BASE_URL}/api_token.php?command=request`);
    if (!res.ok)
      throw new TriviaProviderError(
        'Network error requesting token',
        TriviaProviderErrorCode.NetworkError
      );
    const data: OtdbTokenResponse = await res.json();
    this.token = data.token;
    return this.token;
  }

  private async resetToken(): Promise<void> {
    if (!this.token) return;
    await fetch(`${BASE_URL}/api_token.php?command=reset&token=${this.token}`);
  }

  async fetchQuestions(params: QuestionFetchParams): Promise<Question[]> {
    const token = await this.getToken();
    const url = this.buildUrl(params, token);

    let data: OtdbResponse;
    try {
      const res = await fetch(url);
      if (!res.ok)
        throw new TriviaProviderError('Network error', TriviaProviderErrorCode.NetworkError);
      data = await res.json();
    } catch (e) {
      if (e instanceof TriviaProviderError) throw e;
      throw new TriviaProviderError('Network error', TriviaProviderErrorCode.NetworkError);
    }

    if (data.response_code === 4) {
      await this.resetToken();
      const retryRes = await fetch(this.buildUrl(params, this.token!));
      if (!retryRes.ok)
        throw new TriviaProviderError(
          'Network error on retry',
          TriviaProviderErrorCode.NetworkError
        );
      data = await retryRes.json();
    }

    if (data.response_code === 1) {
      throw new TriviaProviderError('No results available', TriviaProviderErrorCode.NoResults);
    }
    if (data.response_code === 2) {
      throw new TriviaProviderError('Invalid parameters', TriviaProviderErrorCode.InvalidParams);
    }
    if (data.response_code !== 0) {
      throw new TriviaProviderError('Provider error', TriviaProviderErrorCode.ProviderError);
    }
    if (!data.results || data.results.length === 0) {
      throw new TriviaProviderError('No results available', TriviaProviderErrorCode.NoResults);
    }

    return data.results.map((q): Question => {
      const text = htmlDecode(q.question);
      const correctAnswer = htmlDecode(q.correct_answer);
      let options: string[];

      if (q.type === 'boolean') {
        options = ['True', 'False'];
      } else {
        options = shuffle([correctAnswer, ...q.incorrect_answers.map(htmlDecode)]);
      }

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: q.type === 'multiple' ? 'multiple-choice' : 'true-false',
        text,
        options,
        correctAnswer,
        category: htmlDecode(q.category),
        difficulty: q.difficulty as Difficulty,
      };
    });
  }

  fetchCategories(): Promise<Category[]> {
    return Promise.resolve([
      { id: '9', name: 'General Knowledge' },
      { id: '10', name: 'Entertainment: Books' },
      { id: '11', name: 'Entertainment: Film' },
      { id: '12', name: 'Entertainment: Music' },
      { id: '13', name: 'Entertainment: Musicals & Theatres' },
      { id: '14', name: 'Entertainment: Television' },
      { id: '15', name: 'Entertainment: Video Games' },
      { id: '16', name: 'Entertainment: Board Games' },
      { id: '17', name: 'Science & Nature' },
      { id: '18', name: 'Science: Computers' },
      { id: '19', name: 'Science: Mathematics' },
      { id: '20', name: 'Mythology' },
      { id: '21', name: 'Sports' },
      { id: '22', name: 'Geography' },
      { id: '23', name: 'History' },
      { id: '24', name: 'Politics' },
      { id: '25', name: 'Art' },
      { id: '26', name: 'Celebrities' },
      { id: '27', name: 'Animals' },
      { id: '28', name: 'Vehicles' },
      { id: '29', name: 'Entertainment: Comics' },
      { id: '30', name: 'Science: Gadgets' },
      { id: '31', name: 'Entertainment: Japanese Anime & Manga' },
      { id: '32', name: 'Entertainment: Cartoon & Animations' },
    ]);
  }

  supportsCategories(): boolean {
    return true;
  }

  supportsDifficulty(): boolean {
    return true;
  }

  resetSession(): void {
    this.token = null;
  }

  private buildUrl(params: QuestionFetchParams, token: string): string {
    const url = new URL(`${BASE_URL}/api.php`);
    url.searchParams.set('amount', String(params.count));
    if (params.category) url.searchParams.set('category', params.category);
    if (params.difficulty) url.searchParams.set('difficulty', params.difficulty);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
