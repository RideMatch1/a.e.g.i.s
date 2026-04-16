/**
 * User Management — GET /api/vuln-07-no-auth, DELETE /api/vuln-07-no-auth
 *
 * Lists all users and supports deleting a user by ID.
 * Intended for use by the admin dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// VULNERABLE: no session check or role guard before accessing user data
export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data, error } = await supabase.from('users').select('id, name, role, created_at').order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
    return NextResponse.json({ success: true, data, count: data?.length ?? 0 });
  } catch {
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Failed to fetch users' } }, { status: 500 });
  }
}

// VULNERABLE: no session check or role guard before deleting user
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { id } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'id is required' } }, { status: 400 });
    }
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
    return NextResponse.json({ success: true, deleted: true });
  } catch {
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Delete failed' } }, { status: 500 });
  }
}
