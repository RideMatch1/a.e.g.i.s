// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises dynamic-evaluation shape', () => {
    const result = eval('1+1');
    expect(result).toBe(2);
  });
});
