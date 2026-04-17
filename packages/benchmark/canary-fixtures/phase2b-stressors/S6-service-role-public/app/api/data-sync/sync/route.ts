import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// S6 canary — admin Supabase client instantiated in a public route.
// Uses the UPPERCASE canonical env var name only (no lowercase
// references). Real-world shape: admin-priv key in env var that
// bypasses row-level controls.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { tableName, id } = await req.json();
  const { data } = await supabaseAdmin.from(tableName).select('*').eq('id', id);
  return NextResponse.json(data);
}
