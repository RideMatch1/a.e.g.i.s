/**
 * Appointments List — GET /api/vuln-08-no-tenant
 *
 * Returns upcoming appointments with optional date range filtering.
 * Used by the calendar view to populate the schedule grid.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Appointment {
  id: string;
  customer_name: string;
  service: string;
  scheduled_at: string;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    let query = supabase.from('appointments').select('id, customer_name, service, scheduled_at, status').order('scheduled_at', { ascending: true });
    if (from) query = query.gte('scheduled_at', from);
    if (to) query = query.lte('scheduled_at', to);

    // VULNERABLE: no .eq('tenant_id', ...) — returns rows across all tenants
    const { data, error } = await query;

    if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
    return NextResponse.json({ success: true, data: data as Appointment[], count: data?.length ?? 0 });
  } catch {
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Failed to fetch appointments' } }, { status: 500 });
  }
}
