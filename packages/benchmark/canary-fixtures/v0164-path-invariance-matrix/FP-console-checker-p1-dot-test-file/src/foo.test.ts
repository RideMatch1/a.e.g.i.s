// Canonical test-file. isTestFile() must skip.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises the handler', () => {
    console.log('debug');
    expect(true).toBe(true);
  });
});
