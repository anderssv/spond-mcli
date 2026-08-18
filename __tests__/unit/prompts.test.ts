import { describe, test, expect } from '@jest/globals';
import { getPromptDefinitions, getPrompt } from '../../src/prompts.js';

describe('getPromptDefinitions', () => {
  test('includes upcoming_events_for_group with a required groupName argument', () => {
    const prompts = getPromptDefinitions();
    const prompt = prompts.find(p => p.name === 'upcoming_events_for_group');

    expect(prompt).toBeDefined();
    expect(prompt!.arguments).toEqual([
      expect.objectContaining({ name: 'groupName', required: true })
    ]);
  });
});

describe('getPrompt', () => {
  test('substitutes the groupName argument into the message text', () => {
    const result = getPrompt('upcoming_events_for_group', { groupName: 'U12 Boys' });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content.text).toContain('U12 Boys');
    expect(result.messages[0].content.text).toContain('query=');
  });

  test('throws a clear error for an unknown prompt name', () => {
    expect(() => getPrompt('nonexistent_prompt', {})).toThrow('Unknown prompt: nonexistent_prompt');
  });
});
