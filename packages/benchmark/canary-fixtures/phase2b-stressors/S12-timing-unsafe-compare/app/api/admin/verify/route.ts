import { NextRequest, NextResponse } from 'next/server';

// S12 canary — API key comparison with the `===` string operator.
// Non-constant-time comparison leaks the key byte-by-byte via the
// response-time side channel. Fix = constant-time equal helper
// (name intentionally elided here because the scanner's SAFE-
// comparison detection regex would substring-match the helper name
// in this prose and suppress the finding — same class of canary-
// self-suppression as Z2 in tenant-isolation-checker).

const ADMIN_API_KEY = process.env.ADMIN_API_KEY!;

export async function POST(req: NextRequest) {
  const presented = req.headers.get('x-admin-key') ?? '';

  if (presented === ADMIN_API_KEY) {
    return NextResponse.json({ ok: true, role: 'admin' });
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
