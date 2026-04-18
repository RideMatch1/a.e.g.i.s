// templates/nextjs-supabase/files/lib/security/rate-limit.ts

/**
 * Extract the trusted client IP from a Next.js/Fetch Request.
 *
 * Most serverless platforms prepend their own entries to X-Forwarded-For
 * BEFORE proxying to your handler. `trustProxyCount` is the number of
 * trailing entries you trust (your CDN + platform hops). The client IP
 * is the next entry to the left.
 *
 * Returns null when there is no XFF header (no reliable way to identify
 * the caller — rate-limit or reject based on your policy).
 */
export function getTrustedClientIp(
  req: Request,
  opts: { trustProxyCount?: number } = {},
): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (!xff) return null;
  const entries = xff.split(',').map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return null;
  const trust = opts.trustProxyCount ?? 0;
  const idxFromRight = Math.min(trust, entries.length - 1);
  return entries[entries.length - 1 - idxFromRight] ?? null;
}

interface LimiterBucket { count: number; resetAt: number; }
const _buckets = new Map<string, LimiterBucket>();

export function _resetLimiterForTests(): void { _buckets.clear(); }

export interface RateLimitResult { allowed: boolean; remaining: number; resetAt: number; }

/**
 * Fixed-window in-memory rate limiter. Fine for single-process
 * deployments and for per-instance rate-limits. For distributed limits
 * (multi-instance serverless) you want Redis-backed — swap this for
 * @upstash/ratelimit or equivalent. Keep the signature compatible.
 */
export function checkIPRateLimit(
  ip: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = _buckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    const fresh: LimiterBucket = { count: 1, resetAt: now + opts.windowMs };
    _buckets.set(ip, fresh);
    return { allowed: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }
  if (existing.count >= opts.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { allowed: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt };
}
