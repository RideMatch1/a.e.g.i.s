// Canonical test-file — `.test.ts` extension (P1-class). The JWT below
// is intentional test-fixture data (e.g. a valid token-shape for
// verification-logic assertions). isTestFile() extension-match must skip.
import { describe, it, expect } from 'vitest';

const TEST_FIXTURE_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc123def456";

describe('foo', () => {
  it('splits a well-formed JWT into three parts', () => {
    expect(TEST_FIXTURE_JWT.split('.').length).toBe(3);
  });
});
