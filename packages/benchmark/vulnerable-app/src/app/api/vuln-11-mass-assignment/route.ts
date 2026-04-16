/**
 * User Registration — POST /api/vuln-11-mass-assignment
 *
 * Creates a new user record from the submitted profile data.
 * Called during onboarding after the auth account has been created.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const body = await request.json();

    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'name and email are required' } },
        { status: 400 },
      );
    }

    // VULNERABLE: raw request body passed directly to .insert() — no field allowlist
    const { data, error } = await supabase.from('users').insert(body).select().single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Registration failed' } },
      { status: 500 },
    );
  }
}
