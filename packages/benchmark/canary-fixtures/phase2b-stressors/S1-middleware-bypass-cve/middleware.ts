import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// S1 canary — CVE-2025-29927 Next.js middleware auth bypass.
// Middleware trusts the request to run; does NOT explicitly verify
// `x-middleware-subrequest` is absent. Attacker setting that header
// causes Next.js to skip middleware execution entirely, bypassing
// auth. Real CVE, patched in Next.js 15.2.3 / 14.2.25 / 13.5.9 /
// 12.3.5 by adding internal header stripping.
//
// Post-v0.10 expected: a stack-specific check flags middleware that
// performs auth without the CVE mitigation pattern (no explicit
// subrequest-header guard AND not a patched Next.js version).
// Today: no scanner has this rule.

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
