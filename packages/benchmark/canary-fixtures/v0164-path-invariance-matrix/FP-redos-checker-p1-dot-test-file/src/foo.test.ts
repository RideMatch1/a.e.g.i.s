// Canonical test-file — `.test.ts` extension (P1-class). The regex
// below is intentional regression-harness code for ReDoS detection.
// isTestFile() extension-match must skip this file.
import { describe, it, expect } from 'vitest';

describe('catastrophic-backtrack regression harness', () => {
  it('exercises the /(a+)+$/ shape', () => {
    const pattern = /^(a+)+$/;
    expect(pattern.test('aaa')).toBe(true);
  });
});
