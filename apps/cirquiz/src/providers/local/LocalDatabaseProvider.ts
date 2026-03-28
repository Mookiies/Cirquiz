import * as SQLite from 'expo-sqlite';
import i18n from '../../i18n';

import { TriviaQuestionProvider } from '../interface';
import { Category, Difficulty, Question, QuestionFetchParams } from '../types';
import { shuffle } from '../../utils/shuffle';

export class LocalDatabaseProvider implements TriviaQuestionProvider {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async fetchQuestions(params: QuestionFetchParams): Promise<Question[]> {
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (params.category) {
      conditions.push('category = ?');
      args.push(params.category);
    }

    if (params.difficulty) {
      conditions.push('difficulty = ?');
      args.push(params.difficulty);
    }

    if (params.excludeIds && params.excludeIds.length > 0) {
      const placeholders = params.excludeIds.map(() => '?').join(', ');
      conditions.push(`id NOT IN (${placeholders})`);
      args.push(...params.excludeIds);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    args.push(params.count);

    const rows = await this.db.getAllAsync<{
      id: string;
      text: string;
      correct_answer: string;
      distractor_1: string;
      distractor_2: string;
      distractor_3: string;
      category: string;
      difficulty: string;
    }>(`SELECT * FROM questions ${where} ORDER BY RANDOM() LIMIT ?`, args);

    return rows.map((row) => {
      const options = shuffle([
        row.correct_answer,
        row.distractor_1,
        row.distractor_2,
        row.distractor_3,
      ]);
      return {
        id: row.id,
        type: 'multiple-choice',
        text: row.text,
        options,
        correctAnswer: row.correct_answer,
        category: i18n.t(`categories.${row.category}`, { defaultValue: row.category }),
        difficulty: row.difficulty as Difficulty,
      };
    });
  }

  async fetchCategories(): Promise<Category[]> {
    const rows = await this.db.getAllAsync<Category>(
      'SELECT id, name FROM categories ORDER BY name ASC'
    );
    return rows.map((row) => ({
      id: row.id,
      name: i18n.t(`categories.${row.id}`, { defaultValue: row.name }),
    }));
  }

  supportsCategories(): boolean {
    return true;
  }

  supportsDifficulty(): boolean {
    return true;
  }

  resetSession(): void {
    // Session dedup is handled by gameStore via excludeIds — nothing to reset here.
  }
}
