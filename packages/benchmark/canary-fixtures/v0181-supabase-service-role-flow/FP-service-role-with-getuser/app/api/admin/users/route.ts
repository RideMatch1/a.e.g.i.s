import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// SAFE: verifies caller identity + admin role via getUser() BEFORE
// instantiating the service-role client.
export async function POST(req: NextRequest) {
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookies() },
  );
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const body = await req.json();
  await admin.from('users').delete().eq('id', body.userId);
  return NextResponse.json({ ok: true });
}
