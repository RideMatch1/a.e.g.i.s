import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// VULNERABLE: supabase.auth.admin.deleteUser() requires service-role context
// and is being called without checking the caller's identity.
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  await admin.auth.admin.deleteUser(userId);
  return NextResponse.json({ ok: true });
}
