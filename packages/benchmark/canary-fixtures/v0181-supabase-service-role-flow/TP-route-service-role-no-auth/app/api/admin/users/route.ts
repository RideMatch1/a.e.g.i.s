import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// VULNERABLE: Route-handler instantiates a service-role client and runs queries
// WITHOUT calling auth() / getUser() to verify the caller. The service-role
// key bypasses every RLS policy — anyone hitting /api/admin/users reads/writes
// every row in every table the role can touch.
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await admin.from('users').delete().eq('id', body.userId);
  return NextResponse.json({ deleted: result.count });
}
