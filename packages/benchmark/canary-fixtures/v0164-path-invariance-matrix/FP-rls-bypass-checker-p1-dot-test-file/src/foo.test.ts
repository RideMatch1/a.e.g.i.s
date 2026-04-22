// Canonical test-file — `.test.ts` extension (P1-class). supabase.rpc()
// below is intentional test-fixture (simulates a data-fetch for
// assertion). isTestFile() extension-match must skip.
import { describe, it, expect } from 'vitest';

async function fetchStats(supabase: any): Promise<unknown> {
  const { data } = await supabase.rpc('get_dashboard_stats');
  return data;
}

describe('rls-harness', () => {
  it('exercises rpc-shape', async () => {
    const fake = { rpc: async () => ({ data: [] }) };
    const result = await fetchStats(fake);
    expect(result).toEqual([]);
  });
});
