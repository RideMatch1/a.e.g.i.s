// Canonical test-file — `.test.ts` extension INSIDE scanner's target-dir
// (api/). fetch() without AbortController is intentional test-fixture.
// isTestFile() extension-match must skip — strong path-invariance proof.
import { describe, it, expect } from 'vitest';

describe('http-timeout-harness', () => {
  it('exercises fetch without signal', async () => {
    const res = await fetch('https://api.example.com/data');
    expect(res).toBeDefined();
  });
});
