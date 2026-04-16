/**
 * Settings Update — POST /api/vuln-14-no-zod
 *
 * Updates application settings for the current workspace.
 * Accepts a partial settings object and persists the changes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // VULNERABLE: no z.object() schema — body structure and types are not validated
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'id is required' } },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('settings')
      .update(body)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Settings update failed' } }, { status: 500 });
  }
}
