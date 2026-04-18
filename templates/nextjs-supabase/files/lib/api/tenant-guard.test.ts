// Reference-implementation extract — generic Next.js+Supabase primitive.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Next.js + Supabase SSR deps that are resolved at scaffold-user
// build-time but are not installed in the aegis repo. Mocks must be declared
// before the module-under-test is imported.
vi.mock('next/server', () => ({
  NextRequest: class {},
}));

// The mock for `../supabase/server` provides a stub `createServerSupabaseClient`
// whose return value each test overrides via `mockResolvedValueOnce`.
const createServerSupabaseClient = vi.fn();
vi.mock('../supabase/server', () => ({
  createServerSupabaseClient: (...args: unknown[]) => createServerSupabaseClient(...args),
}));

// Import after mocks so the module-under-test picks up the stubs.
import { secureApiRouteWithTenant } from './tenant-guard';

type FakeRequest = { method: string; headers: Map<string, string> };
const request = { method: 'GET', headers: new Map() } as unknown as FakeRequest;

function makeSupabaseMock(opts: {
  user?: { id: string } | null;
  getUserError?: Error;
  profile?: { tenant_id: string | null; role: string | null } | null;
}) {
  const getUser = opts.getUserError
    ? vi.fn().mockRejectedValue(opts.getUserError)
    : vi.fn().mockResolvedValue({ data: { user: opts.user ?? null }, error: null });

  const single = vi.fn().mockResolvedValue({ data: opts.profile ?? null, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { auth: { getUser }, from };
}

describe('secureApiRouteWithTenant', () => {
  beforeEach(() => {
    createServerSupabaseClient.mockReset();
  });

  it('returns context with userId=null when requireAuth=true and no session', async () => {
    const supabase = makeSupabaseMock({ user: null });
    createServerSupabaseClient.mockResolvedValueOnce(supabase);
    const result = await secureApiRouteWithTenant(request as never, { requireAuth: true });
    expect(result.context.userId).toBeNull();
    expect(result.context.tenantId).toBeNull();
    expect(result.context.role).toBeNull();
  });

  it('returns userId populated but tenantId/role null when profile-row missing', async () => {
    const supabase = makeSupabaseMock({ user: { id: 'u-1' }, profile: null });
    createServerSupabaseClient.mockResolvedValueOnce(supabase);
    const result = await secureApiRouteWithTenant(request as never, { requireAuth: true });
    expect(result.context.userId).toBe('u-1');
    expect(result.context.tenantId).toBeNull();
    expect(result.context.role).toBeNull();
  });

  it('returns all three fields populated when session + profile-row exist', async () => {
    const supabase = makeSupabaseMock({
      user: { id: 'u-2' },
      profile: { tenant_id: 't-1', role: 'admin' },
    });
    createServerSupabaseClient.mockResolvedValueOnce(supabase);
    const result = await secureApiRouteWithTenant(request as never, { requireAuth: true });
    expect(result.context.userId).toBe('u-2');
    expect(result.context.tenantId).toBe('t-1');
    expect(result.context.role).toBe('admin');
  });

  it('returns all-null context when requireAuth=false and no session (guest-mode)', async () => {
    const supabase = makeSupabaseMock({ user: null });
    createServerSupabaseClient.mockResolvedValueOnce(supabase);
    const result = await secureApiRouteWithTenant(request as never, { requireAuth: false });
    expect(result.context.userId).toBeNull();
    expect(result.context.tenantId).toBeNull();
    expect(result.context.role).toBeNull();
  });

  it('returns the same supabase instance for reuse in the handler', async () => {
    const supabase = makeSupabaseMock({ user: null });
    createServerSupabaseClient.mockResolvedValueOnce(supabase);
    const result = await secureApiRouteWithTenant(request as never, { requireAuth: false });
    expect(result.supabase).toBe(supabase);
  });

  it('propagates errors from supabase.auth.getUser() (no silent swallow)', async () => {
    const supabase = makeSupabaseMock({ getUserError: new Error('JWT decode failed') });
    createServerSupabaseClient.mockResolvedValueOnce(supabase);
    await expect(
      secureApiRouteWithTenant(request as never, { requireAuth: true }),
    ).rejects.toThrow('JWT decode failed');
  });
});
