/**
 * Login — POST /api/auth/login
 *
 * Validates user credentials and returns an access token.
 * Used by the client-side auth flow for email/password sign-in.
 */
import { NextRequest, NextResponse } from 'next/server';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  expiresAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'email and password are required' } },
        { status: 400 },
      );
    }

    // VULNERABLE: no brute-force protection on credential validation
    const user = await verifyCredentials(body.email, body.password);

    if (!user) {
      return NextResponse.json(
        { error: { code: 'AUTH_FAILED', message: 'Invalid credentials' } },
        { status: 401 },
      );
    }

    const result: LoginResponse = {
      token: user.token,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };

    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Login failed' } },
      { status: 500 },
    );
  }
}

async function verifyCredentials(email: string, password: string) {
  return { token: 'jwt-placeholder' };
}
