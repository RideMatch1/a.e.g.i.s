// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

describe('harness', () => {
  it('exercises token-signing', () => {
    const token = jwt.sign({ sub: 'u1' }, 'secret');
    expect(typeof token).toBe('string');
  });
});
