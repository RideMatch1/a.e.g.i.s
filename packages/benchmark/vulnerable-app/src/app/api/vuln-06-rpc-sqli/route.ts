/**
 * Dynamic Table Search — POST /api/vuln-06-rpc-sqli
 *
 * Calls a Supabase RPC function to perform full-text search across a specified
 * table. The table name is passed by the client to select the stored procedure.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SearchRequest {
  tableName: string;
  filter: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();

    if (!body.tableName || !body.filter) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'tableName and filter are required' } },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // VULNERABLE: tableName interpolated directly into the RPC function name
    const { data, error } = await supabase.rpc(`search_${body.tableName}`, {
      filter_value: body.filter,
    });

    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ success: true, data, count: data?.length ?? 0 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Search failed' } }, { status: 500 });
  }
}
