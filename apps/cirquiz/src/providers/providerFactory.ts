import * as SQLite from 'expo-sqlite';

import type { QuestionSource } from '../state/settingsStore';
import { TriviaQuestionProvider } from './interface';
import { LocalDatabaseProvider } from './local/LocalDatabaseProvider';
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
    case 'local':
      throw new Error(
        'Local database not ready — SQLiteProvider must be initialized before fetching questions'
      );
  }
  instances.set(source, provider);
  return provider;
}

/**
 * Called by LocalDbBridge (inside SQLiteProvider) once the database is open.
 * Registers the LocalDatabaseProvider singleton with the injected db instance.
 */
export function setLocalDb(db: SQLite.SQLiteDatabase): void {
  instances.set('local', new LocalDatabaseProvider(db));
}

export function setProviderForTesting(
  source: QuestionSource,
  provider: TriviaQuestionProvider
): void {
  overrides.set(source, provider);
}
