// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises template-interpolated query shape', () => {
    const id = 'u1';
    const sql = `SELECT * FROM users WHERE id = '${id}'`;
    expect(sql).toContain(id);
  });
});
