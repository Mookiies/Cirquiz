import { Difficulty } from '../types';

export const JSON_SCHEMA = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'type', 'correct_answer', 'incorrect_answers', 'difficulty'],
        properties: {
          question: { type: 'string' },
          type: { type: 'string', enum: ['multiple-choice', 'true-false'] },
          correct_answer: { type: 'string' },
          incorrect_answers: { type: 'array', items: { type: 'string' } },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  'You are a trivia question generator. Generate accurate, factual trivia questions.\n' +
  'All facts must be verifiable and correct. Never invent facts.\n' +
  'Respond with a JSON object containing a "questions" array. No explanations.';

export function buildPrompt(
  topic: string,
  count: number,
  difficulty?: Difficulty
): { system: string; user: string } {
  const difficultyInstruction =
    difficulty != null
      ? `All questions must have difficulty "${difficulty}".`
      : 'Mix difficulties across questions, setting each question\'s difficulty to "easy", "medium", or "hard".';
  const user =
    `Generate ${count} trivia question(s) about "${topic.trim()}".\n` +
    `${difficultyInstruction}\n` +
    'For multiple-choice questions: correct_answer is the full answer text; incorrect_answers has exactly 3 wrong answer strings.\n' +
    'For true-false questions: correct_answer is "True" or "False"; incorrect_answers has exactly 1 element (the opposite).';
  return { system: SYSTEM_PROMPT, user };
}
