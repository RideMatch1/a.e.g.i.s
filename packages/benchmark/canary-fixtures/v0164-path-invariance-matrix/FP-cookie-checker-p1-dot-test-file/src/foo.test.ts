// Canonical test-file — `.test.ts` extension (P1-class). Cookie-header
// mutation below is intentional test-harness code. isTestFile() must skip.
import { describe, it, expect } from 'vitest';

describe('cookie-handler harness', () => {
  it('writes a Set-Cookie header (test-fixture)', () => {
    const response = new Response('ok');
    response.headers.set('Set-Cookie', 'session=abc123');
    expect(response.headers.get('Set-Cookie')).toContain('session=');
  });
});
