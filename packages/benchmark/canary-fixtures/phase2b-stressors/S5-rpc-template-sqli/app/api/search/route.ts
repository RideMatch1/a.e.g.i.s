import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// S5 canary — Supabase .rpc() with user input in the function name
// via template literal. Classic Supabase SQLi — the RPC name is
// an identifier, not a parameter; template-literal interpolation
// lets an attacker invoke arbitrary functions.

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const tableSlug = req.nextUrl.searchParams.get('table') ?? '';
  const term = req.nextUrl.searchParams.get('q') ?? '';

  const { data, error } = await supabase.rpc(`search_${tableSlug}`, {
    term,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
