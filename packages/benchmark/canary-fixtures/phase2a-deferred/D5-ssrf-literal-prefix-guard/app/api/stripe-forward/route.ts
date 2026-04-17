import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

// D5 canary — SSRF call guarded by a literal-prefix check. The fetch is
// only reachable on the positive branch of `url.startsWith('https://…')`
// which pins the URL to a specific trusted origin before reaching the
// sink. A taint-aware scanner should recognise the guard.
//
// Post-v0.10 expected: ssrf-checker honours literal-prefix startsWith
// on a string the sink is about to consume. Today: CWE-918 fires
// because the regex pattern sees `fetch(userInput)` without flow
// analysis.

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const { url } = await req.json();

  if (!url.startsWith('https://api.stripe.com/')) {
    return NextResponse.json({ error: 'not_stripe' }, { status: 400 });
  }

  // Guarded sink: startsWith-literal-prefix pinned the origin.
  const upstream = await fetch(url);
  const payload = await upstream.json();

  return NextResponse.json(payload);
}
