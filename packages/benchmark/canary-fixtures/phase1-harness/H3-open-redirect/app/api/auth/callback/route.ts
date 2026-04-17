import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get('returnTo');
  if (!returnTo) {
    return NextResponse.json({ error: 'missing returnTo' }, { status: 400 });
  }
  return NextResponse.redirect(new URL(returnTo, req.url));
}
