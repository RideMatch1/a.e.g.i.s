// Canonical test-file — `.test.ts` extension INSIDE scanner's
// target-set (/api/ path). path.join with user-input is intentional
// test-harness code. isTestFile() must skip — strong invariance proof.
import { describe, it, expect } from 'vitest';
import path from 'path';

describe('path-traversal harness', () => {
  it('joins user input', () => {
    const filePath = path.join('/uploads', 'anyinput');
    expect(filePath).toContain('/uploads');
  });
});
