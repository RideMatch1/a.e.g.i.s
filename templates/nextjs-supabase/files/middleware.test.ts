// Reference-implementation extract — generic Next.js+Supabase primitive.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Mock next/server — vitest can't resolve the real package at aegis root.
// Keep the shim minimal: Response-based NextResponse with static next()/json(),
// and a NextRequest that just extends Request (pathname via new URL(req.url)).
vi.mock('next/server', () => {
  class NextResponse extends Response {
    static next(_init?: { request?: { headers?: Headers } }): NextResponse {
      return new NextResponse(null, { status: 200 });
    }
    static json(body: unknown, init?: ResponseInit): NextResponse {
      return new NextResponse(JSON.stringify(body), {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      });
    }
  }
  class NextRequest extends Request {}
  return { NextResponse, NextRequest };
});

import { _resetLimiterForTests } from './lib/security/rate-limit';
import { middleware } from './middleware';

function makeRequest(opts: {
  method?: string;
  url?: string;
  origin?: string;
  host?: string;
  xff?: string | null;
}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers.origin = opts.origin;
  if (opts.host !== undefined) headers.host = opts.host;
  if (opts.xff !== undefined && opts.xff !== null) headers['x-forwarded-for'] = opts.xff;
  return new Request(opts.url ?? 'http://localhost/api/foo', {
    method: opts.method ?? 'GET',
    headers,
  }) as unknown as NextRequest;
}

const SECURITY_HEADER_NAMES = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
];

describe('middleware', () => {
  beforeEach(() => {
    _resetLimiterForTests();
    delete process.env.RATE_LIMIT_PER_MINUTE;
  });

  it('returns next() for static-asset paths without touching the limiter', async () => {
    // matcher normally excludes statics; defensive in-function check must also skip.
    const res = await middleware(makeRequest({ url: 'http://localhost/favicon.ico', xff: '1.1.1.1' }));
    expect(res.status).toBe(200);
  });

  it('allows GET under limit and emits security + rate-limit headers', async () => {
    const res = await middleware(
      makeRequest({ method: 'GET', url: 'http://localhost/api/foo', xff: '2.2.2.2' }),
    );
    expect(res.status).toBe(200);
    for (const name of SECURITY_HEADER_NAMES) {
      expect(res.headers.get(name)).toBeTruthy();
    }
    expect(res.headers.get('x-ratelimit-remaining')).toBeTruthy();
    expect(res.headers.get('x-ratelimit-reset')).toBeTruthy();
  });

  it('null client IP (no XFF) passes through with ip-not-identified marker', async () => {
    const res = await middleware(
      makeRequest({ method: 'GET', url: 'http://localhost/api/foo' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-status')).toBe('ip-not-identified');
  });

  it('returns 429 when GET exceeds the limit, with X-RateLimit-Reset set', async () => {
    process.env.RATE_LIMIT_PER_MINUTE = '3';
    const ip = '3.3.3.3';
    for (let i = 0; i < 3; i++) {
      const ok = await middleware(makeRequest({ method: 'GET', xff: ip }));
      expect(ok.status).toBe(200);
    }
    const blocked = await middleware(makeRequest({ method: 'GET', xff: ip }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('x-ratelimit-reset')).toBeTruthy();
  });

  it('rate-limit fires BEFORE CSRF check (POST over-limit with bad origin returns 429, not 403)', async () => {
    // This is the ordering oracle. If CSRF ran first, a mismatched-origin POST
    // over limit would return 403. We require 429 — limiter must run first.
    process.env.RATE_LIMIT_PER_MINUTE = '2';
    const ip = '4.4.4.4';
    // Pre-fill the bucket with safe same-origin POSTs.
    for (let i = 0; i < 2; i++) {
      const ok = await middleware(
        makeRequest({
          method: 'POST',
          url: 'http://localhost/api/foo',
          origin: 'http://localhost',
          host: 'localhost',
          xff: ip,
        }),
      );
      expect(ok.status).toBe(200);
    }
    // Now bad-origin POST — limiter should deny before CSRF runs.
    const res = await middleware(
      makeRequest({
        method: 'POST',
        url: 'http://localhost/api/foo',
        origin: 'https://evil.example',
        host: 'localhost',
        xff: ip,
      }),
    );
    expect(res.status).toBe(429);
    // Security headers apply uniformly, even on rate-limit rejection.
    for (const name of SECURITY_HEADER_NAMES) {
      expect(res.headers.get(name)).toBeTruthy();
    }
  });

  it('rejects POST with mismatched Origin as 403 (below the limit)', async () => {
    const res = await middleware(
      makeRequest({
        method: 'POST',
        url: 'http://localhost/api/foo',
        origin: 'https://evil.example',
        host: 'localhost',
        xff: '5.5.5.5',
      }),
    );
    expect(res.status).toBe(403);
    // Security headers apply uniformly, including on rejections.
    for (const name of SECURITY_HEADER_NAMES) {
      expect(res.headers.get(name)).toBeTruthy();
    }
  });

  it('rejects POST with missing Origin header as 403', async () => {
    const res = await middleware(
      makeRequest({
        method: 'POST',
        url: 'http://localhost/api/foo',
        host: 'localhost',
        xff: '6.6.6.6',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('rejects POST with mismatched Origin even when IP cannot be identified (null-IP CSRF enforcement)', async () => {
    // Without XFF the rate-limiter cannot key the caller, but CSRF origin-check
    // still applies — otherwise a misconfigured proxy chain silently drops CSRF
    // and an attacker forging a cross-origin POST succeeds. Pins the null-IP
    // code-path as a regression-guard.
    const res = await middleware(
      makeRequest({
        method: 'POST',
        url: 'http://localhost/api/foo',
        origin: 'https://evil.example',
        host: 'localhost',
      }),
    );
    expect(res.status).toBe(403);
    for (const name of SECURITY_HEADER_NAMES) {
      expect(res.headers.get(name)).toBeTruthy();
    }
  });
});
