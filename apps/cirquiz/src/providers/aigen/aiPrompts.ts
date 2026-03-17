import { Difficulty } from '../types';

export const GBNF_GRAMMAR = `\
root     ::= "[" ws item ("," ws item)* "]"
item     ::= "{" ws q-key ws "," ws type-key ws "," ws ca-key ws "," ws ia-key ws "}"
q-key    ::= "\\"question\\":" ws string
type-key ::= "\\"type\\":" ws ("\\"multiple-choice\\"" | "\\"true-false\\"")
ca-key   ::= "\\"correct_answer\\":" ws string
ia-key   ::= "\\"incorrect_answers\\":" ws "[" ws string ("," ws string)* ws "]"
ws       ::= [ \\t\\n]*
string   ::= "\\"" [^"]* "\\""
`;

const SYSTEM_PROMPT =
  'You are a trivia question generator. Generate accurate, factual multiple-choice trivia questions.\n' +
  'All facts must be verifiable and correct. Never invent facts.\n' +
  'Respond only with valid JSON matching the provided schema. Do not include explanations.';

export function buildPrompt(
  topic: string,
  count: number,
  difficulty?: Difficulty
): { system: string; user: string } {
  const difficultyLabel = difficulty ?? 'mixed';
  const user =
    `Generate ${count} trivia question(s) about "${topic.trim()}" at ${difficultyLabel} difficulty.\n` +
    'For multiple-choice questions: provide 1 correct answer and 3 distinct incorrect answers.\n' +
    'For true-false questions: provide the correct boolean answer and its opposite.';
  return { system: SYSTEM_PROMPT, user };
}
