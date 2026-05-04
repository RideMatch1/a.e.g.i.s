import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Regular route using anon-keyed client + RLS for authz. No service-role
// import anywhere in this file. supabase-service-role-flow-checker MUST
// NOT fire (out-of-scope by import filter).
export async function GET() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookies() },
  );
  const { data, error } = await supabase.from('profiles').select('id, display_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
