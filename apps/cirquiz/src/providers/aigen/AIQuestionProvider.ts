import { useModelStore } from '../../state/modelStore';
import { TriviaQuestionProvider } from '../interface';
import {
  Category,
  Question,
  QuestionFetchParams,
  TriviaProviderError,
  TriviaProviderErrorCode,
} from '../types';
import { buildPrompt, GBNF_GRAMMAR } from './aiPrompts';
import { parse } from './questionParser';

export class AIQuestionProvider implements TriviaQuestionProvider {
  private seenIds = new Set<string>();

  async fetchQuestions(params: QuestionFetchParams): Promise<Question[]> {
    const { topicPrompt, count, difficulty, excludeIds } = params;

    if (!topicPrompt || topicPrompt.trim().length < 3) {
      throw new TriviaProviderError(
        'Topic prompt is required and must be at least 3 characters',
        TriviaProviderErrorCode.InvalidParams
      );
    }

    const context = useModelStore.getState().getContext();
    if (!context) {
      throw new TriviaProviderError(
        'AI model is not loaded',
        TriviaProviderErrorCode.ProviderError
      );
    }

    const { system, user } = buildPrompt(topicPrompt, count, difficulty);

    const result = await context.completion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      grammar: GBNF_GRAMMAR,
      temperature: 0.2,
      n_predict: 1024,
      stop: ['<|end|>', '</s>'],
    });

    if (result.interrupted) {
      throw new TriviaProviderError(
        'Generation was cancelled by the user',
        TriviaProviderErrorCode.UserCancelled
      );
    }

    const questions = parse(result.text, count, difficulty);

    // Deduplicate against questions from previous rounds
    const excluded = new Set(excludeIds ?? []);
    const fresh = questions.filter((q) => !excluded.has(q.id) && !this.seenIds.has(q.id));
    fresh.forEach((q) => this.seenIds.add(q.id));

    if (fresh.length < count) {
      throw new TriviaProviderError(
        'Not enough unique questions after deduplication',
        TriviaProviderErrorCode.NoResults
      );
    }

    return fresh.slice(0, count);
  }

  fetchCategories(): Promise<Category[]> {
    return Promise.resolve([]);
  }

  supportsCategories(): boolean {
    return false;
  }

  supportsDifficulty(): boolean {
    return true;
  }

  resetSession(): void {
    this.seenIds.clear();
  }

  cancelFetch(): void {
    const context = useModelStore.getState().getContext();
    context?.stopCompletion();
  }
}
