// Sanitized from real 2026-04-29 dogfood-scan TP (serviconnect signup-page).
// Supabase auth.signUp accepts options.data which becomes user_metadata —
// RLS policies often read user_metadata.role for tenant scoping. Attacker
// POSTs {role: 'admin'} → admin user_metadata → RLS bypass.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { email, password, role, fullName } = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name: fullName,
      },
    },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user });
}
