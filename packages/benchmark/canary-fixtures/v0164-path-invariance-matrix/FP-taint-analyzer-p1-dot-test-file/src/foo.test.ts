// Canonical test-file — `.test.ts` extension (P1-class). The tainted
// flow below is intentional test-code (simulates a vulnerable route for
// assertion). Scanner must skip this file via isTestFile() extension-match.
import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';

describe('command-injection regression harness', () => {
  it('exercises the exec-from-body path', () => {
    const body = { id: 'touch /tmp/foo' };
    const id = body.id;
    exec(id);
    expect(true).toBe(true);
  });
});
