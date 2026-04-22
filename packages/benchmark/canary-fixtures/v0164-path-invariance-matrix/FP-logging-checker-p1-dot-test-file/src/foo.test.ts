// Canonical test-file. Scanner must not emit.
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('exercises the mutation-handler shape', async () => {
    async function POST(request: Request) {
      const body = await request.json();
      return { ok: true, id: body.id };
    }
    expect(typeof POST).toBe('function');
  });
});
