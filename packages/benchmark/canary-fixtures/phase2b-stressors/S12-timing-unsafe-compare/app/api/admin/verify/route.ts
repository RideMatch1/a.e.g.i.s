import { NextRequest, NextResponse } from 'next/server';

// S12 canary — API key comparison with the `===` string operator.
// Non-constant-time comparison leaks the key byte-by-byte via
// response-time side channel. Should use crypto.timingSafeEqual.

const ADMIN_API_KEY = process.env.ADMIN_API_KEY!;

export async function POST(req: NextRequest) {
  const presented = req.headers.get('x-admin-key') ?? '';

  if (presented === ADMIN_API_KEY) {
    return NextResponse.json({ ok: true, role: 'admin' });
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
