import { buildPrompt, JSON_SCHEMA } from '../aiPrompts';

describe('aiPrompts', () => {
  describe('JSON_SCHEMA', () => {
    it('is an object', () => {
      expect(typeof JSON_SCHEMA).toBe('object');
      expect(JSON_SCHEMA).not.toBeNull();
    });

    it('contains required fields inside a questions wrapper', () => {
      const str = JSON.stringify(JSON_SCHEMA);
      expect(str).toContain('questions');
      expect(str).toContain('question');
      expect(str).toContain('correct_answer');
      expect(str).toContain('incorrect_answers');
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

    it('mixes difficulties when difficulty is omitted', () => {
      const { user } = buildPrompt('Geography', 5);
      expect(user).toContain('Mix difficulties');
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
