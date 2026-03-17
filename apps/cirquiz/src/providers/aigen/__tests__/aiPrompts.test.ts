import { buildPrompt, GBNF_GRAMMAR } from '../aiPrompts';

describe('aiPrompts', () => {
  describe('GBNF_GRAMMAR', () => {
    it('is a non-empty string', () => {
      expect(typeof GBNF_GRAMMAR).toBe('string');
      expect(GBNF_GRAMMAR.length).toBeGreaterThan(0);
    });

    it('contains root rule', () => {
      expect(GBNF_GRAMMAR).toContain('root');
    });

    it('contains question field rule', () => {
      expect(GBNF_GRAMMAR).toContain('question');
    });

    it('contains correct_answer field rule', () => {
      expect(GBNF_GRAMMAR).toContain('correct_answer');
    });

    it('contains incorrect_answers field rule', () => {
      expect(GBNF_GRAMMAR).toContain('incorrect_answers');
    });
  });

  describe('buildPrompt', () => {
    it('includes the topic in the user prompt', () => {
      const { user } = buildPrompt('Ancient Rome', 5);
      expect(user).toContain('Ancient Rome');
    });

    it('includes the count in the user prompt', () => {
      const { user } = buildPrompt('80s pop music', 3);
      expect(user).toContain('3');
    });

    it('includes the difficulty in the user prompt when provided', () => {
      const { user } = buildPrompt('Science', 5, 'hard');
      expect(user).toContain('hard');
    });

    it('uses "mixed" difficulty label when difficulty is omitted', () => {
      const { user } = buildPrompt('Geography', 5);
      expect(user).toContain('mixed');
    });

    it('returns a non-empty system prompt', () => {
      const { system } = buildPrompt('History', 5);
      expect(system.length).toBeGreaterThan(0);
    });

    it('trims whitespace from the topic in the user prompt', () => {
      const { user } = buildPrompt('  Space  ', 5);
      expect(user).toContain('"Space"');
    });
  });
});
