// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises the unscoped-query shape', async () => {
    const supabase = { from: (_t: string) => ({ select: async (_s: string) => ({ data: [] }) }) } as any;
    const { data } = await supabase.from('users').select('*');
    expect(Array.isArray(data)).toBe(true);
  });
});
