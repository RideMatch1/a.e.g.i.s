import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

// D4 canary — SSRF call guarded by an explicit allowlist function. The
// fetch is dominated by isSafeUrl(url); a taint-aware scanner should
// recognise the guard dominates the sink and NOT emit CWE-918.
//
// Post-v0.10 expected: ssrf-checker honours named allowlist guards
// (or the taint-analyzer's paramReachesSink treats the guarded branch
// as suppressed). Today: ssrf-checker emits CWE-918 because the guard
// is behaviour-opaque to regex analysis.

const TRUSTED_HOSTS = new Set([
  'api.trusted-vendor.com',
  'hooks.example.org',
]);

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return TRUSTED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  const { url } = await req.json();

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }

  // Guarded sink: isSafeUrl narrowed the URL to a trusted host before this line.
  const upstream = await fetch(url);
  const payload = await upstream.json();

  return NextResponse.json(payload);
}
