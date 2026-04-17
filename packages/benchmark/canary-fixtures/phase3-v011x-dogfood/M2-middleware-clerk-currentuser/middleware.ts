import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function middleware(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/sign-in', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
