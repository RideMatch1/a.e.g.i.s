import { NextRequest, NextResponse } from 'next/server';
import { validateAndFetch } from '../../../lib/validators';

// D9 canary — v0.9.1 regex-guard cross-file regression pin. The
// consumer passes tainted body.url through validateAndFetch which
// owns both the regex guard AND the fetch sink. paramReachesSink
// must recognise the guard-then-sink shape and strip CWE-918 from
// the function summary — the route sees a clean summary and emits
// nothing.
//
// Today: no taint-analyzer emission (v0.9.1 holds).
// Post-v0.10 expected: unchanged. Pins v0.9.1 against regressions.

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await validateAndFetch(body.url);
  const payload = await res.json();
  return NextResponse.json(payload);
}
