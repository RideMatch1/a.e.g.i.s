// Reference-implementation extract — generic Next.js+Supabase primitive.

// NOTE: This middleware runs on the Node.js runtime (not Edge) by default.
// Rationale: the built-in rate-limit (lib/security/rate-limit.ts) uses an
// in-memory Map that cannot be shared across Edge instances. Node runtime
// gives single-instance Behavior (dev-accurate rate-limiting) at the cost
// of Edge's cold-start latency. For production horizontal-scaling, swap
// the in-memory limiter for Redis-backed (@upstash/ratelimit) and switch
// back to Edge if you need the latency. See templates/... README.
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { checkIPRateLimit, getTrustedClientIp } from './lib/security/rate-limit';

const STATIC_PATH_RE = /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|css|js|map)$/i;

// Defensive in-function check — the matcher config below already excludes
// most static paths, but if the matcher is loosened this guards us.
function isStaticPath(pathname: string): boolean {
  if (pathname === '/favicon.ico' || pathname === '/robots.txt') return true;
  if (pathname.startsWith('/_next/')) return true;
  return STATIC_PATH_RE.test(pathname);
}

function applySecurityHeaders(res: Response): void {
  // Scaffold defaults — tighten per your asset/CDN needs.
  res.headers.set('Content-Security-Policy', "default-src 'self'");
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// CSRF: minimal same-origin check. For JSON APIs consumed by non-browser
// clients (mobile apps, server-to-server) you will want to disable this
// on specific routes, or switch to a token-based scheme (double-submit
// cookie, SameSite=Strict + custom header, etc.).
function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  // 1. Static-asset skip (defensive — matcher excludes most already).
  // Security headers still applied so a loosened matcher can't silently
  // drop CSP / X-Content-Type-Options / etc. on static responses.
  if (isStaticPath(pathname)) {
    const res = NextResponse.next();
    applySecurityHeaders(res);
    return res;
  }

  // 2. Trusted client IP — key for rate-limiting.
  const ip = getTrustedClientIp(request, { trustProxyCount: 1 });

  // 3. Rate-limit BEFORE any auth/CSRF work. Configurable via env-var.
  // If IP cannot be identified (no XFF), allow through with a warning
  // header — scaffold-user's job to check their proxy setup.
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE ?? '60');
  const windowMs = 60_000;

  if (ip === null) {
    // No rate-limit possible (can't key unidentified IP), but CSRF
    // STILL applies. Without this check, a POST with no XFF header
    // would bypass origin-validation entirely — a silent CSRF hole
    // whenever a proxy chain drops or omits the X-Forwarded-For
    // header. Rate-limit-dominates-CSRF ordering is preserved on
    // the IP-identified path below; on this path CSRF is the only
    // perimeter defense we have left.
    if (MUTATION_METHODS.has(request.method) && isCrossOrigin(request)) {
      const res = new NextResponse('Forbidden', { status: 403 });
      applySecurityHeaders(res);
      return res;
    }
    const res = NextResponse.next();
    applySecurityHeaders(res);
    res.headers.set('X-RateLimit-Status', 'ip-not-identified');
    return res;
  }

  const rl = checkIPRateLimit(ip, { limit, windowMs });
  if (!rl.allowed) {
    const res = NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 },
    );
    applySecurityHeaders(res);
    res.headers.set('X-RateLimit-Remaining', '0');
    res.headers.set('X-RateLimit-Reset', String(rl.resetAt));
    res.headers.set('Retry-After', String(Math.ceil(windowMs / 1000)));
    return res;
  }

  // 4. CSRF: reject cross-origin mutations.
  if (MUTATION_METHODS.has(request.method) && isCrossOrigin(request)) {
    const res = new NextResponse('Forbidden', { status: 403 });
    applySecurityHeaders(res);
    return res;
  }

  // 5. Continue to route handler.
  const res = NextResponse.next();

  // 6. Security headers on success path (uniform with rejections above).
  applySecurityHeaders(res);

  // 7. Rate-limit info headers on successful responses.
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  res.headers.set('X-RateLimit-Reset', String(rl.resetAt));

  return res;
}

export const config = {
  matcher: [
    // Apply to everything EXCEPT static assets & Next internals.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|css|js|map)$).*)',
  ],
};
