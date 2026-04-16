/**
 * Post-Login Redirect — GET /api/vuln-13-open-redirect
 *
 * Redirects the user to a return URL after completing authentication.
 * The destination is supplied via the returnUrl query parameter and is
 * typically set by the login page before forwarding the user here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

const DEFAULT_REDIRECT = '/dashboard';

function isBlank(value: string | null): value is null {
  return !value || value.trim() === '';
}

export async function GET(request: NextRequest) {
  const returnUrl = request.nextUrl.searchParams.get('returnUrl');

  if (isBlank(returnUrl)) {
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT, request.url));
  }

  try {
    // VULNERABLE: user-supplied returnUrl flows directly into redirect() without origin validation
    redirect(returnUrl as string);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT, request.url));
  }
}
