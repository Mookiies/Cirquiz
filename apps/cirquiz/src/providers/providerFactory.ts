import type { QuestionSource } from '../state/settingsStore';
import { AIQuestionProvider } from './aigen/AIQuestionProvider';
import { TriviaQuestionProvider } from './interface';
import { OpenTriviaDbProvider } from './opentdb/OpenTriviaDbProvider';
import { TheTriviaApiProvider } from './thetriviaapi/TheTriviaApiProvider';

const instances = new Map<QuestionSource, TriviaQuestionProvider>();
const overrides = new Map<QuestionSource, TriviaQuestionProvider>();

export function getProvider(source: QuestionSource): TriviaQuestionProvider {
  const override = overrides.get(source);
  if (override) return override;

  const existing = instances.get(source);
  if (existing) return existing;

  let provider: TriviaQuestionProvider;
  switch (source) {
    case 'otdb':
      provider = new OpenTriviaDbProvider();
      break;
    case 'the-trivia-api':
      provider = new TheTriviaApiProvider();
      break;
    case 'ai-generated':
      provider = new AIQuestionProvider();
      break;
  }
  instances.set(source, provider);
  return provider;
}

export function setProviderForTesting(
  source: QuestionSource,
  provider: TriviaQuestionProvider
): void {
  overrides.set(source, provider);
}
