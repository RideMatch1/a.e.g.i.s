// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises the record-spread shape', async () => {
    const supabase = { from: () => ({ select: async () => ({ data: [] }) }) } as any;
    const { data } = await supabase.from('users').select('*');
    expect(Array.isArray(data)).toBe(true);
  });
});
