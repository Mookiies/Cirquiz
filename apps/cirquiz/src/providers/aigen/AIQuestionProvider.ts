import { useModelStore } from '../../state/modelStore';
import { TriviaQuestionProvider } from '../interface';
import {
  Category,
  Question,
  QuestionFetchParams,
  TriviaProviderError,
  TriviaProviderErrorCode,
} from '../types';
import { buildPrompt, JSON_SCHEMA } from './aiPrompts';
import { parse } from './questionParser';

export class AIQuestionProvider implements TriviaQuestionProvider {
  private seenIds = new Set<string>();

  async fetchQuestions(params: QuestionFetchParams): Promise<Question[]> {
    const { topicPrompt, count, difficulty, excludeIds } = params;

    console.log('[AIProvider] fetchQuestions', { topicPrompt, count, difficulty });

    if (!topicPrompt || topicPrompt.trim().length < 3) {
      throw new TriviaProviderError(
        'Topic prompt is required and must be at least 3 characters',
        TriviaProviderErrorCode.InvalidParams
      );
    }

    const modelState = useModelStore.getState();
    const context = modelState.getContext();
    console.log('[AIProvider] model state', {
      status: modelState.status,
      hasContext: context !== null,
      isInitializing: modelState.isInitializing,
    });
    if (!context) {
      throw new TriviaProviderError(
        'AI model is not loaded',
        TriviaProviderErrorCode.ProviderError
      );
    }

    const { system, user } = buildPrompt(topicPrompt, count, difficulty);
    console.log('[AIProvider] sending prompt', { system, user });

    let result;
    try {
      result = await context.completion({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { strict: true, schema: JSON_SCHEMA },
        },
        temperature: 0.2,
        n_predict: count * 160,
        stop: ['<|end|>', '</s>'],
      });
    } catch (e) {
      console.error('[AIProvider] context.completion threw', e);
      throw e;
    }

    console.log('[AIProvider] completion result', {
      interrupted: result.interrupted,
      textLength: result.text?.length,
      text: result.text,
    });

    if (result.interrupted) {
      throw new TriviaProviderError(
        'Generation was cancelled by the user',
        TriviaProviderErrorCode.UserCancelled
      );
    }

    const questions = parse(result.text, count);

    // Deduplicate against questions from previous rounds
    const excluded = new Set(excludeIds ?? []);
    const fresh = questions.filter((q) => !excluded.has(q.id) && !this.seenIds.has(q.id));
    fresh.forEach((q) => this.seenIds.add(q.id));

    if (fresh.length === 0) {
      throw new TriviaProviderError(
        'No unique questions after deduplication',
        TriviaProviderErrorCode.NoResults
      );
    }

    if (fresh.length < count) {
      console.warn('[AIProvider] returning fewer questions than requested', {
        freshCount: fresh.length,
        needed: count,
      });
    }

    console.log('[AIProvider] returning', fresh.length, 'questions');
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
