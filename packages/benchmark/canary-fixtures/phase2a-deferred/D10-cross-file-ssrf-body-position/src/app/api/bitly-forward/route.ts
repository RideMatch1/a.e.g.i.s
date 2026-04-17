import { NextRequest, NextResponse } from 'next/server';
import { rateLimitCall } from '../../../lib/api';

// D10 canary — cross-file URL-position filter regression pin.
// v0.9.1 fix: CWE-918 requires the tainted value to reach the URL
// position (arg 0 of fetch), not the options object (body, headers).
// Consumer passes a string literal URL and user-controlled body;
// the taint lands in opts.body → no SSRF finding.
//
// Today: no emission (v0.9.1 holds).
// Post-v0.10 expected: unchanged — pins v0.9.1 URL-position filter
// against regressions.

export async function POST(req: NextRequest) {
  const body = await req.json();

  // URL is a hardcoded literal; only body carries user input.
  const res = await rateLimitCall('https://api.bitly.com/rate-limit', {
    body,
  });

  const payload = await res.json();
  return NextResponse.json(payload);
}
