// Canonical test-file — `.test.ts` extension. JWT in a test fixture is
// intentional (e.g. a test-vector for jwt verification logic). Scanner
// must skip this file via isTestFile() extension-match.
import { describe, it, expect } from 'vitest';

const TEST_FIXTURE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe('foo', () => {
  it('accepts a well-formed JWT', () => {
    expect(TEST_FIXTURE_JWT.split('.').length).toBe(3);
  });
});
