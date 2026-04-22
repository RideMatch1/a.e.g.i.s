// Canonical test-file — `.test.ts` extension (P1-class). Prompt-
// interpolation is intentional test-fixture data. isTestFile() must skip.
import { describe, it, expect } from 'vitest';

describe('prompt harness', () => {
  it('builds a prompt with user input', () => {
    const userMessage = 'hello';
    const prompt = { role: 'user', content: `${userMessage}` };
    expect(prompt.content).toBe('hello');
  });
});
