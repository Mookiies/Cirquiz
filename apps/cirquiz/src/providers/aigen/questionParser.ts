import { shuffle } from '../../utils/shuffle';
import { Difficulty, Question, TriviaProviderError, TriviaProviderErrorCode } from '../types';

interface GeneratedQuestionRaw {
  question: string;
  type: 'multiple-choice' | 'true-false';
  correct_answer: string;
  incorrect_answers: string[];
  difficulty: Difficulty;
}

function generateId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function inferType(item: Record<string, unknown>): 'multiple-choice' | 'true-false' | undefined {
  if (item.type === 'multiple-choice' || item.type === 'true-false') return item.type;
  if (Array.isArray(item.incorrect_answers)) {
    if (item.incorrect_answers.length === 1) return 'true-false';
    if (item.incorrect_answers.length === 3) return 'multiple-choice';
  }
  return undefined;
}

function isValidRaw(item: unknown): item is GeneratedQuestionRaw {
  if (!item || typeof item !== 'object') return false;
  const q = item as Record<string, unknown>;

  if (typeof q.question !== 'string' || !q.question.trim() || q.question.length > 300) return false;
  const type = inferType(q);
  if (!type) return false;
  if (typeof q.correct_answer !== 'string' || !q.correct_answer.trim()) return false;
  if (!Array.isArray(q.incorrect_answers)) return false;
  if (q.difficulty !== 'easy' && q.difficulty !== 'medium' && q.difficulty !== 'hard') return false;

  const incorrect = q.incorrect_answers as unknown[];
  if (incorrect.some((a) => typeof a !== 'string' || !(a as string).trim())) return false;

  if (type === 'multiple-choice' && incorrect.length !== 3) return false;
  if (type === 'true-false' && incorrect.length !== 1) return false;

  // No duplicate answers
  const allAnswers = [q.correct_answer as string, ...(incorrect as string[])];
  const lower = allAnswers.map((a) => a.toLowerCase());
  if (new Set(lower).size !== lower.length) return false;

  return true;
}

function validationFailureReason(item: unknown): string {
  if (!item || typeof item !== 'object') return 'not an object';
  const q = item as Record<string, unknown>;
  if (typeof q.question !== 'string' || !q.question.trim()) return 'question missing or empty';
  if (q.question.length > 300) return `question too long (${q.question.length} chars)`;
  if (!inferType(q))
    return `invalid type: ${q.type} (incorrect_answers length: ${Array.isArray(q.incorrect_answers) ? q.incorrect_answers.length : 'n/a'})`;
  if (typeof q.correct_answer !== 'string' || !q.correct_answer.trim())
    return 'correct_answer missing or empty';
  if (!Array.isArray(q.incorrect_answers)) return 'incorrect_answers not an array';
  const incorrect = q.incorrect_answers as unknown[];
  if (incorrect.some((a) => typeof a !== 'string' || !(a as string).trim()))
    return 'incorrect_answers contains non-string or empty item';
  if (q.type === 'multiple-choice' && incorrect.length !== 3)
    return `multiple-choice needs 3 incorrect answers, got ${incorrect.length}`;
  if (q.type === 'true-false' && incorrect.length !== 1)
    return `true-false needs 1 incorrect answer, got ${incorrect.length}`;
  const allAnswers = [q.correct_answer as string, ...(incorrect as string[])];
  const lower = allAnswers.map((a) => a.toLowerCase());
  if (new Set(lower).size !== lower.length) return 'duplicate answers detected';
  if (q.difficulty !== 'easy' && q.difficulty !== 'medium' && q.difficulty !== 'hard')
    return `invalid difficulty: ${q.difficulty}`;
  return 'unknown';
}

export function parse(rawJson: string, requestedCount: number): Question[] {
  console.log('[QuestionParser] raw output length:', rawJson?.length, 'text:', rawJson);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    console.error('[QuestionParser] JSON.parse failed:', e, 'raw:', rawJson);
    throw new TriviaProviderError(
      'AI output could not be parsed as JSON',
      TriviaProviderErrorCode.NoResults
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error('[QuestionParser] output is not an object, got:', typeof parsed, parsed);
    throw new TriviaProviderError(
      'AI output is not a JSON object',
      TriviaProviderErrorCode.NoResults
    );
  }

  const questions = (parsed as Record<string, unknown>).questions;
  if (!Array.isArray(questions)) {
    console.error('[QuestionParser] missing questions array, got:', questions);
    throw new TriviaProviderError(
      'AI output missing questions array',
      TriviaProviderErrorCode.NoResults
    );
  }

  console.log('[QuestionParser] parsed', questions.length, 'item(s)');
  const valid = (questions as unknown[]).filter((item, i) => {
    const ok = isValidRaw(item);
    if (!ok) {
      console.warn(`[QuestionParser] item[${i}] invalid:`, validationFailureReason(item), item);
    }
    return ok;
  }) as GeneratedQuestionRaw[];
  console.log('[QuestionParser]', valid.length, '/', questions.length, 'items passed validation');

  if (valid.length === 0) {
    throw new TriviaProviderError(
      'AI generated no valid questions',
      TriviaProviderErrorCode.NoResults
    );
  }

  if (valid.length < requestedCount) {
    console.warn(`[QuestionParser] returning ${valid.length} of ${requestedCount} requested`);
  }

  return valid.slice(0, requestedCount).map((raw): Question => {
    const type = inferType(raw as unknown as Record<string, unknown>)!;
    const allOptions = shuffle([raw.correct_answer, ...raw.incorrect_answers]);
    return {
      id: generateId(),
      type,
      text: raw.question,
      options: allOptions,
      correctAnswer: raw.correct_answer,
      category: 'AI Generated',
      difficulty: raw.difficulty,
    };
  });
}
