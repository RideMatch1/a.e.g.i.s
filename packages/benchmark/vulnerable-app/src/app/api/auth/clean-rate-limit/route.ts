/**
 * CLEAN-04: Auth route WITH rate limiting — should NOT be flagged by rate-limit-checker
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const rateLimit = await checkIPRateLimit(request, 5, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const { email, password } = await request.json();
  const result = await doLogin(email, password);
  return NextResponse.json(result);
}
