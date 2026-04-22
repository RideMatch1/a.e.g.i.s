// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises token-comparison shape', () => {
    const token = 'abc';
    const secret = 'abc';
    expect(token === secret).toBe(true);
  });
});
