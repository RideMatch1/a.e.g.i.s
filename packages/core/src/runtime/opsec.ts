import { getGlobalDispatcher, setGlobalDispatcher, ProxyAgent, type Dispatcher } from 'undici';

/**
 * Phase-17 OPSEC (Operational Security) options for outbound traffic during
 * active-mode engagements. Controls request pacing, UA fingerprint, and
 * upstream proxy routing — supports non-paranoid environments (dev-server
 * testing, CI ephemerals) and reduces detection surface against rate-limited
 * targets.
 *
 * Proxy semantics: when `proxy` is set, `applyOpsecDispatcher` calls
 * `undici.setGlobalDispatcher(new ProxyAgent(proxy))`, which routes ALL
 * `fetch()` calls in the Node process through that upstream proxy — including
 * native fetch in attack-probes AND LLM-API calls in `aegis fix`. DAST tool
 * wrappers (zap, nuclei, strix, ptai, pentestswarm) shell out to external
 * binaries via `child_process.exec` and do NOT honor the dispatcher; they
 * use their own per-tool proxy configuration.
 */
export interface OpsecOptions {
  /** Random delay 0..jitterMs added between requests on top of rateMs */
  jitterMs?: number;
  /** Minimum delay (ms) between successive requests across all scanners */
  rateMs?: number;
  /** User-Agent header override (default: scanner-specific UA when unset) */
  userAgent?: string;
  /**
   * Upstream HTTP(S) proxy URL (e.g. `http://127.0.0.1:8080` for mitmproxy).
   * Routes all native-fetch traffic through the proxy via undici.ProxyAgent.
   * Shell-out DAST tools bypass this — see module-level docstring.
   */
  proxy?: string;
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

/**
 * Validate a proxy URL eagerly — fail-fast at CLI flag-parse time rather
 * than mid-engagement on the first outbound request. Throws on invalid URL,
 * non-http(s) protocol, or ProxyAgent constructor failure.
 *
 * Exposed so CLI handlers can validate `--proxy` before any orchestrator
 * setup (per advisor 2026-05-02 — operator gets a clear error up-front).
 */
export function validateProxyUrl(proxy: string): void {
  let parsed: URL;
  try {
    parsed = new URL(proxy);
  } catch {
    throw new Error(`Invalid --proxy URL: ${proxy} (must be http(s)://host:port)`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid --proxy protocol: ${parsed.protocol} (only http: and https: supported)`);
  }
  // ProxyAgent construction performs additional validation (parsing port,
  // host); surface those errors to the operator pre-engagement too.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _probe = new ProxyAgent(proxy);
}

/**
 * Apply the opsec proxy by saving the current global undici dispatcher and
 * installing a `ProxyAgent`. Returns a restore-fn that puts the prior
 * dispatcher back — callers MUST invoke it on engagement teardown (and tests
 * MUST invoke it in afterEach to avoid cross-test state leakage).
 *
 * No-op (returns identity restore-fn) when opsec is undefined or proxy is
 * unset. Validates the proxy URL via `validateProxyUrl` before mutating
 * global state — callers that already validated may still call this safely.
 */
export function applyOpsecDispatcher(opsec?: OpsecOptions): () => void {
  if (!opsec?.proxy) return () => {};
  validateProxyUrl(opsec.proxy);
  const prior: Dispatcher = getGlobalDispatcher();
  const agent = new ProxyAgent(opsec.proxy);
  setGlobalDispatcher(agent);
  return () => {
    setGlobalDispatcher(prior);
    // Best-effort agent close — never throw from a teardown fn.
    void agent.close().catch(() => {});
  };
}
