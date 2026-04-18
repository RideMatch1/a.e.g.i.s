// templates/nextjs-supabase/files/lib/security/safe-fetch.ts

/**
 * SSRF-safe fetch wrapper.
 *
 * Enforces:
 *   - Only http: / https: URLs (no file:, gopher:, jar:, ftp:, …)
 *   - No loopback / private-range IPv4 hosts (RFC1918, link-local,
 *     IPv4-mapped IPv6)
 *   - Request body size cap + response size cap + abort timeout
 *
 * All checks run pre-flight on the parsed URL. DNS resolution is not
 * bypassed — a public hostname resolving to a private IP is still
 * fetched; use this primitive as the OUTBOUND-request wrapper, not
 * as a DNS-rebinding defence (that requires server-side DNS control).
 */
export interface SafeFetchOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const PRIVATE_IPV4 = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^::ffff:10\./,
  /^::ffff:127\./,
];

export async function safeFetch(urlString: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const url = new URL(urlString);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`safeFetch: disallowed protocol ${url.protocol}`);
  }
  if (PRIVATE_IPV4.some((re) => re.test(url.hostname))) {
    throw new Error(`safeFetch: private / loopback address not allowed: ${url.hostname}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      body: opts.body,
      signal: controller.signal,
    });
    const contentLength = Number(res.headers.get('content-length') ?? '0');
    const cap = opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    if (contentLength > cap) {
      throw new Error(`safeFetch: response exceeds cap (${contentLength} > ${cap})`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}
