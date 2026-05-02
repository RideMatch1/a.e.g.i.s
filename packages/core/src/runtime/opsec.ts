/**
 * Phase-17 OPSEC (Operational Security) options for outbound traffic during
 * active-mode engagements. Controls request pacing + UA fingerprint to support
 * non-paranoid environments (dev-server testing, CI ephemerals) and to reduce
 * detection surface against rate-limited targets.
 *
 * Proxy-chain support is intentionally NOT included in this iteration — it
 * requires `undici.ProxyAgent` + `setGlobalDispatcher`, which would add a
 * runtime dependency. A `--proxy` flag without that wiring would be
 * decorative (the brutal-honest test: point at mitmproxy, verify no requests
 * bypass). Tracked as F-OPSEC-PROXY-1 follow-up.
 */
export interface OpsecOptions {
  /** Random delay 0..jitterMs added between requests on top of rateMs */
  jitterMs?: number;
  /** Minimum delay (ms) between successive requests across all scanners */
  rateMs?: number;
  /** User-Agent header override (default: scanner-specific UA when unset) */
  userAgent?: string;
}

let lastRequestTime = 0;

/** Test-only: reset the global request-time tracker between specs. */
export function _resetOpsecPacingForTesting(): void {
  lastRequestTime = 0;
}

/**
 * Pace the next outbound request: sleeps until rateMs has elapsed since the
 * last call, plus a random 0..jitterMs jitter on top. No-op when opsec is
 * undefined or both fields are zero. Module-global state — pacing applies
 * across all parallel scanner calls, which is the correct behavior for an
 * overall-rate budget.
 */
export async function opsecPace(opsec?: OpsecOptions): Promise<void> {
  if (!opsec) return;
  const rateMs = opsec.rateMs ?? 0;
  const jitterMs = opsec.jitterMs ?? 0;
  if (rateMs === 0 && jitterMs === 0) return;

  const now = Date.now();
  const since = now - lastRequestTime;
  const remaining = Math.max(0, rateMs - since);
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  const wait = remaining + jitter;
  if (wait > 0) {
    await new Promise<void>((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();
}

/**
 * Apply opsec headers (currently just User-Agent) to a fetch RequestInit.
 * Returns a new init object — does not mutate the input. When opsec.userAgent
 * is set, it overrides any pre-existing User-Agent header in the init.
 */
export function applyOpsecHeaders(
  init: RequestInit | undefined,
  opsec?: OpsecOptions,
): RequestInit {
  const result: RequestInit = { ...(init ?? {}) };
  if (opsec?.userAgent) {
    const headers = new Headers(result.headers);
    headers.set('User-Agent', opsec.userAgent);
    result.headers = headers;
  }
  return result;
}
