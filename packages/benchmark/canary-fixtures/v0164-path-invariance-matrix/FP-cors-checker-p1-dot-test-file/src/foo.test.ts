// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises a response-header pattern', () => {
    const res = new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
