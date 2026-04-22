---
name: middleware-hardened
category: foundation
title: Hardened Next.js Middleware (CSP + HSTS + Rate-Limit + Auth-Gates)
description: >
  Next.js middleware layer enforcing Content-Security-Policy, HSTS, XFO, rate-limits,
  and authenticated-route protection. First-class line-of-defense before any route
  handler runs.
version: 1
dependencies:
  npm: []
placeholders:
  - name: PROJECT_NAME
    description: The project identifier (kebab-case, from wizard). Used in file-headers and path hints.
    required: true
brief_section: Foundation
estimated_files: 2
tags: [middleware, csp, hsts, rate-limit, security-headers]
related:
  - foundation/multi-tenant-supabase
  - foundation/auth-supabase-full
---

# Hardened Next.js Middleware

Every request hits `middleware.ts` before reaching a route handler. This is the ideal place to enforce:
- Content-Security-Policy (XSS-prevention)
- HTTP-Strict-Transport-Security (TLS-enforcement)
- X-Frame-Options (clickjacking-prevention)
- Rate-limiting (abuse-prevention)
- Route-protection (authentication-gate before server-code runs)

**Multi-layer-defense:** even if an API route forgets `secureApiRouteWithTenant()`, the middleware blocks unauthorized access to `/admin/*` and `/api/admin/*`.

---

## Commands to run

No new dependencies. Uses Next.js built-in middleware + existing `lib/api/rate-limit.ts`.

---

## Files to create

### `middleware.ts` (project root)

```typescript
/**
 * Next.js Middleware — {{PROJECT_NAME}}
 *
 * Runs before every route-handler. Enforces:
 *   - Security headers (CSP, HSTS, XFO, CORP, Referrer, Permissions)
 *   - Rate-limiting on sensitive routes
 *   - Authentication-gate for /admin/* and /api/admin/*
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ============================================================================
// Config
// ============================================================================

const CSP_REPORT_ONLY = process.env.CSP_REPORT_ONLY === 'true';
const ADDITIONAL_CONNECT_SRC: string[] =
  process.env.CSP_ADDITIONAL_CONNECT_SRC
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

// Routes that REQUIRE authentication (301 → /login if unauthenticated)
const PROTECTED_PREFIXES = ['/admin'];

// API routes that require authentication (401 JSON if unauthenticated)
const PROTECTED_API_PREFIXES = ['/api/admin'];

// Routes that skip middleware entirely (public static assets, etc.)
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/public'];

// ============================================================================
// Security headers
// ============================================================================

function buildCsp(nonce: string): string {
  const connectSrc = [
    "'self'",
    process.env.NEXT_PUBLIC_SUPABASE_URL,  // Supabase API
    'https://*.supabase.co',                // Supabase websockets
    ...ADDITIONAL_CONNECT_SRC,
  ].filter(Boolean).join(' ');

  // Strict CSP: nonce-based scripts, no inline, no eval.
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,  // Tailwind requires unsafe-inline
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, nonce: string): void {
  const cspHeader = CSP_REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  response.headers.set(cspHeader, buildCsp(nonce));
  response.headers.set('x-nonce', nonce);  // accessible in Server-Components via headers() → apply to inline <script nonce="…">

  // HSTS: force HTTPS for 2 years, include subdomains, preload-list-ready
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Clickjacking-prevention (belt-and-suspenders with CSP frame-ancestors)
  response.headers.set('X-Frame-Options', 'DENY');

  // MIME-sniffing-prevention
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer-policy: send origin on cross-origin, full on same-origin
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy: disable dangerous features by default
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()',
  );

  // Cross-Origin-Opener-Policy: isolate browsing-context from cross-origin popups
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Cross-Origin-Resource-Policy: prevent cross-origin embedding of this response
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
}

// ============================================================================
// Nonce generation (cryptographically random)
// ============================================================================

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// ============================================================================
// Trusted IP resolution (for rate-limiting)
// ============================================================================

function getTrustedProxyCount(): number {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  if (!raw) return 1;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 10) return 1;
  return n;
}

function getTrustedClientIp(request: NextRequest): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf?.trim()) return cf.trim();

  const xr = request.headers.get('x-real-ip');
  if (xr?.trim()) return xr.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      const trusted = getTrustedProxyCount();
      const idx = Math.max(0, parts.length - trusted);
      return parts[idx] ?? 'unknown';
    }
  }
  return 'unknown';
}

// ============================================================================
// Simple in-memory rate-limit store (middleware-scoped)
// For production-grade distributed rate-limit, swap to Upstash Ratelimit.
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
  };
}

// Aggressive rate-limit for login/signup/password-reset (5/min/IP)
const AUTH_ROUTES = ['/api/auth', '/login', '/signup', '/auth/forgot-password'];
const AUTH_RATE_LIMIT = 5;
const AUTH_RATE_WINDOW_MS = 60 * 1000;

// ============================================================================
// Main middleware entry
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public assets
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Build response + nonce + attach security-headers early (applies to all paths)
  const nonce = generateNonce();
  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });
  response.headers.set('x-nonce', nonce);
  applySecurityHeaders(response, nonce);

  // ============================================================================
  // Rate-limiting on auth-routes
  // ============================================================================

  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    const ip = getTrustedClientIp(request);
    const { allowed, remaining } = checkRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS);

    response.headers.set('X-RateLimit-Limit', String(AUTH_RATE_LIMIT));
    response.headers.set('X-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(AUTH_RATE_LIMIT),
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
        },
      });
    }
  }

  // ============================================================================
  // Authentication gate — protected routes
  // ============================================================================

  const isProtectedPage = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtectedPage || isProtectedApi) {
    // Supabase session-check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      if (isProtectedApi) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Protected page → redirect to login with `next`-param
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Match everything except Next internals + public static
  matcher: [
    // Match all paths except _next/static, _next/image, favicon.ico, public/
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

### `middleware.test.ts` (test-harness)

```typescript
/**
 * Middleware tests — {{PROJECT_NAME}}
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function makeRequest(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`), {
    headers: new Headers(headers),
  });
}

describe('middleware security-headers', () => {
  it('applies CSP on all responses', async () => {
    const res = await middleware(makeRequest('/'));
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('sets HSTS with 2-year max-age + preload', async () => {
    const res = await middleware(makeRequest('/'));
    expect(res.headers.get('Strict-Transport-Security')).toMatch(/max-age=63072000.*preload/);
  });

  it('sets X-Frame-Options: DENY', async () => {
    const res = await middleware(makeRequest('/'));
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('generates unique nonce per request', async () => {
    const a = (await middleware(makeRequest('/'))).headers.get('x-nonce');
    const b = (await middleware(makeRequest('/'))).headers.get('x-nonce');
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe('middleware rate-limiting', () => {
  it('returns 429 after 5 auth-requests in 1 minute from same IP', async () => {
    const ip = '1.2.3.4';
    for (let i = 0; i < 5; i++) {
      await middleware(makeRequest('/api/auth/login', { 'x-real-ip': ip }));
    }
    const res = await middleware(makeRequest('/api/auth/login', { 'x-real-ip': ip }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('different IPs do not share rate-limit', async () => {
    const res1 = await middleware(makeRequest('/api/auth/login', { 'x-real-ip': '10.0.0.1' }));
    const res2 = await middleware(makeRequest('/api/auth/login', { 'x-real-ip': '10.0.0.2' }));
    expect(res1.status).not.toBe(429);
    expect(res2.status).not.toBe(429);
  });
});

describe('middleware authentication-gate', () => {
  it('redirects unauthenticated /admin/* to /login with next-param', async () => {
    // Mock unauthenticated session
    const res = await middleware(makeRequest('/admin/dashboard'));
    expect(res.status).toBe(307);  // Next.js redirect
    const loc = res.headers.get('location');
    expect(loc).toContain('/login');
    expect(loc).toContain('next=%2Fadmin%2Fdashboard');
  });

  it('returns 401 JSON for unauthenticated /api/admin/*', async () => {
    const res = await middleware(makeRequest('/api/admin/users'));
    expect(res.status).toBe(401);
  });
});
```

---

## Using the nonce in Server Components

To allow inline `<script>` tags (e.g. for JSON-LD), read the nonce from headers and pass to the script:

```typescript
// In a Server Component (e.g. src/app/layout.tsx)
import { headers } from 'next/headers';

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get('x-nonce');
  return (
    <html>
      <head>
        <script nonce={nonce || undefined} type="application/ld+json">
          {JSON.stringify({/* structured data */})}
        </script>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## Production upgrade: distributed rate-limit

The in-memory rate-limit above works per-instance. For multi-instance deployments:

```bash
npm install @upstash/ratelimit @upstash/redis
```

Replace the `rateLimitStore` Map with Upstash:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
});

const { success, remaining } = await ratelimit.limit(`auth:${ip}`);
```

---

## Required environment variables

```env
# Already set by multi-tenant-supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Optional: only if you set TRUSTED_PROXY_COUNT per placeholder
TRUSTED_PROXY_COUNT=1   # 1 for Vercel/Dokploy, 2 for Cloudflare-in-front

# Optional: if Upstash production rate-limit upgrade
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Common pitfalls

1. **Using `unsafe-eval` or `unsafe-inline` in `script-src`.** Defeats the whole point of CSP. Use nonce-based scripts + `strict-dynamic`.
2. **Forgetting to add Supabase-URL to `connect-src`.** All Supabase calls will be blocked by CSP. Include it in `ADDITIONAL_CONNECT_SRC` placeholder.
3. **Trusting the first `X-Forwarded-For` element.** It's client-controllable. Use `TRUSTED_PROXY_COUNT` from the right.
4. **In-memory rate-limit on multi-instance deploy.** Each instance has its own counter → effective limit is N×. Upgrade to Upstash.
5. **Not testing CSP in report-only mode first.** Deploying enforce-mode breaks UI silently. Set `CSP_REPORT_ONLY=true` for staging, watch reports, then flip to enforce.
6. **Forgetting to set `preload` + submit the domain to `hstspreload.org`.** HSTS without preload doesn't protect first-visit. Use the preload-list for full protection.
7. **Mocking middleware in tests insufficient.** Supabase-auth-check requires a real-or-mock session. Don't skip auth-tests because "middleware is hard to test".

---

## Related patterns

- `foundation/multi-tenant-supabase` — the Supabase-client used for session-check
- `foundation/auth-supabase-full` — the auth-routes this middleware rate-limits
- `foundation/rbac-requireRole` — called by route-handlers; middleware checks only auth, not role

---

## Quality-gate

```bash
# Build succeeds
npm run build

# Middleware-specific tests pass
npm run test -- middleware

# Verify security-headers with a request (dev server running)
curl -I http://localhost:3000
# expect: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, etc.

# AEGIS scan verifies headers in code
npx aegis scan . --focus security-headers
```

---

**Pattern version: 1 · Last-updated: 2026-04-22 · AEGIS-foundation**
