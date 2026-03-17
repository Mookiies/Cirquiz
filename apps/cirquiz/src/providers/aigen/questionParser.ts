import { shuffle } from '../../utils/shuffle';
import { Difficulty, Question, TriviaProviderError, TriviaProviderErrorCode } from '../types';

interface GeneratedQuestionRaw {
  question: string;
  type: 'multiple-choice' | 'true-false';
  correct_answer: string;
  incorrect_answers: string[];
}

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isValidRaw(item: unknown): item is GeneratedQuestionRaw {
  if (!item || typeof item !== 'object') return false;
  const q = item as Record<string, unknown>;

  if (typeof q.question !== 'string' || !q.question.trim() || q.question.length > 300) return false;
  if (q.type !== 'multiple-choice' && q.type !== 'true-false') return false;
  if (typeof q.correct_answer !== 'string' || !q.correct_answer.trim()) return false;
  if (!Array.isArray(q.incorrect_answers)) return false;

  const incorrect = q.incorrect_answers as unknown[];
  if (incorrect.some((a) => typeof a !== 'string' || !(a as string).trim())) return false;

  if (q.type === 'multiple-choice' && incorrect.length !== 3) return false;
  if (q.type === 'true-false' && incorrect.length !== 1) return false;

  // No duplicate answers
  const allAnswers = [q.correct_answer as string, ...(incorrect as string[])];
  const lower = allAnswers.map((a) => a.toLowerCase());
  if (new Set(lower).size !== lower.length) return false;

  return true;
}

export function parse(
  rawJson: string,
  requestedCount: number,
  difficulty?: Difficulty
): Question[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new TriviaProviderError(
      'AI output could not be parsed as JSON',
      TriviaProviderErrorCode.NoResults
    );
  }

  if (!Array.isArray(parsed)) {
    throw new TriviaProviderError(
      'AI output is not a JSON array',
      TriviaProviderErrorCode.NoResults
    );
  }

  const valid = (parsed as unknown[]).filter(isValidRaw) as GeneratedQuestionRaw[];

  if (valid.length < requestedCount) {
    throw new TriviaProviderError(
      `AI generated only ${valid.length} valid question(s), needed ${requestedCount}`,
      TriviaProviderErrorCode.NoResults
    );
  }

  return valid.slice(0, requestedCount).map((raw): Question => {
    const allOptions = shuffle([raw.correct_answer, ...raw.incorrect_answers]);
    return {
      id: generateId(),
      type: raw.type,
      text: raw.question,
      options: allOptions,
      correctAnswer: raw.correct_answer,
      category: 'AI Generated',
      difficulty: difficulty ?? 'medium',
    };
  });
}
