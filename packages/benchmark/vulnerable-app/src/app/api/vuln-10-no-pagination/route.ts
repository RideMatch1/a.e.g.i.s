/**
 * Activity Log — GET /api/vuln-10-no-pagination
 *
 * Returns the server activity log ordered by timestamp.
 * Used by the admin audit panel to review system events.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface LogEntry {
  id: string;
  level: string;
  message: string;
  created_at: string;
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // VULNERABLE: unbounded query — no row cap applied
    const { data, error } = await supabase
      .from('logs')
      .select('id, level, message, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data as LogEntry[],
      count: data?.length ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Failed to fetch logs' } },
      { status: 500 },
    );
  }
}
