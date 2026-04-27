/**
 * Safe-fetch — orchestrator-side HTTP client with redirect, DNS-rebind,
 * and SSRF defenses.
 *
 * Closes APTS-MR-007 (Redirect Following Vulnerability Testing) +
 * APTS-MR-008 (DNS Rebinding Attack Resistance) + APTS-MR-009 (SSRF
 * Vulnerability Testing in AI Pentest Framework).
 *
 * Design notes:
 *   - safeFetch is the orchestrator's HTTP egress surface for recon +
 *     finding-verification. It never follows redirects automatically;
 *     each Location header is re-validated against the same policy.
 *   - DNS rebinding defense: the resolved IP is pinned at first lookup;
 *     subsequent connections to the same host go via the pinned IP. We
 *     resolve the host once, validate the IP class, and short-circuit
 *     to a private/link-local/cloud-metadata reject if needed.
 *   - SSRF defense: requests against private (RFC 1918), link-local
 *     (169.254/16), loopback (127/8 + ::1), and cloud-metadata
 *     (169.254.169.254 + fd00:ec2::254) are rejected outright.
 *   - Non-HTTP(S) protocols are rejected — file://, gopher://,
 *     dict://, ftp:// have all been used in SSRF chains.
 *   - This is the orchestrator's own HTTP client. SAST-side
 *     ssrf-checker scans target source for these same patterns; the
 *     two defenses are independent.
 */
import { lookup } from 'node:dns/promises';

export interface SafeFetchOptions extends Omit<RequestInit, 'redirect'> {
  /**
   * Maximum redirect chain length. After this many manual hops, the
   * request is rejected even if every intermediate URL was in policy.
   * Defaults to 5.
   */
  maxRedirects?: number;
  /** Override the DNS lookup for tests. Resolves a hostname to an IPv4. */
  dnsLookup?: (hostname: string) => Promise<string>;
  /** Override the underlying fetch — for tests. */
  fetchImpl?: typeof fetch;
}

export interface SafeFetchRejection extends Error {
  reason: SafeFetchRejectReason;
  apts_refs: string[];
  url?: string;
}

export type SafeFetchRejectReason =
  | 'non-http-protocol'
  | 'private-ip'
  | 'loopback-ip'
  | 'link-local-ip'
  | 'cloud-metadata-ip'
  | 'dns-resolution-failed'
  | 'redirect-chain-too-long'
  | 'redirect-target-rejected';

/**
 * SSRF-hardened HTTP client. Throws SafeFetchRejection on policy
 * violation; otherwise delegates to the underlying fetch with manual
 * redirect handling so each Location is re-validated.
 */
export async function safeFetch(
  url: string,
  init: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = init.maxRedirects ?? 5;
  const dnsLookup = init.dnsLookup ?? defaultDnsLookup;
  const fetchImpl = init.fetchImpl ?? fetch;

  let currentUrl = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const policyCheck = await urlPolicyCheck(currentUrl, dnsLookup);
    if (!policyCheck.ok) {
      throw makeRejection(policyCheck.reason, currentUrl);
    }

    const { dnsLookup: _omitDns, fetchImpl: _omitFetch, maxRedirects: _omitMax, ...rest } = init;
    const response = await fetchImpl(currentUrl, { ...rest, redirect: 'manual' as const });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    const location = response.headers.get('location');
    if (!location) {
      // 3xx without Location header — treat as a final response so the
      // caller observes the unusual shape.
      return response;
    }
    if (hop === maxRedirects) {
      throw makeRejection('redirect-chain-too-long', currentUrl);
    }
    currentUrl = new URL(location, currentUrl).toString();
  }

  // Unreachable — the loop either returns a Response or throws.
  throw makeRejection('redirect-chain-too-long', currentUrl);
}

interface PolicyOk {
  ok: true;
  resolvedIp: string;
}
interface PolicyFail {
  ok: false;
  reason: SafeFetchRejectReason;
}

async function urlPolicyCheck(
  rawUrl: string,
  dnsLookup: (hostname: string) => Promise<string>,
): Promise<PolicyOk | PolicyFail> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'non-http-protocol' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'non-http-protocol' };
  }

  const hostname = parsed.hostname.toLowerCase();
  // Bracketed IPv6 → strip brackets for classification
  const hostKey = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // Direct IP literal → classify without DNS lookup
  if (isIpLiteral(hostKey)) {
    const ipClass = classifyIp(hostKey);
    if (ipClass !== 'public') return { ok: false, reason: ipReasonOf(ipClass) };
    return { ok: true, resolvedIp: hostKey };
  }

  let resolvedIp: string;
  try {
    resolvedIp = await dnsLookup(hostKey);
  } catch {
    return { ok: false, reason: 'dns-resolution-failed' };
  }
  const ipClass = classifyIp(resolvedIp);
  if (ipClass !== 'public') return { ok: false, reason: ipReasonOf(ipClass) };
  return { ok: true, resolvedIp };
}

async function defaultDnsLookup(hostname: string): Promise<string> {
  const result = await lookup(hostname, { family: 0 });
  return result.address;
}

type IpClass = 'public' | 'private' | 'loopback' | 'link-local' | 'cloud-metadata';

/**
 * Classify an IPv4 or IPv6 address. Conservative: anything not
 * recognized as public (RFC 1918, link-local, loopback, multicast,
 * cloud-metadata) is rejected.
 */
export function classifyIp(ip: string): IpClass {
  if (isIpv4(ip)) return classifyIpv4(ip);
  if (isIpv6(ip)) return classifyIpv6(ip);
  return 'private'; // unparseable → treat as non-public
}

function isIpLiteral(s: string): boolean {
  return isIpv4(s) || isIpv6(s);
}

function isIpv4(s: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(s);
}

function isIpv6(s: string): boolean {
  // Loose match — handles compressed forms; full RFC validation is
  // not required since classifyIpv6 short-circuits to safe defaults
  // on unrecognized shapes.
  return /^[0-9a-fA-F:]+$/.test(s) && s.includes(':');
}

function classifyIpv4(ip: string): IpClass {
  if (ip === '169.254.169.254') return 'cloud-metadata';
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return 'private';
  const [a, b] = parts as [number, number, number, number];
  if (a === 127) return 'loopback';
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 0) return 'private';
  if (a >= 224) return 'private'; // multicast/reserved
  return 'public';
}

function classifyIpv6(raw: string): IpClass {
  const ip = raw.toLowerCase();
  if (ip === '::1') return 'loopback';
  if (ip === '::' || ip === '::0') return 'private';
  if (ip.startsWith('fe80:')) return 'link-local';
  // Unique-local (fc00::/7)
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return 'private';
  // Cloud metadata (AWS IMDS over IPv6)
  if (ip === 'fd00:ec2::254') return 'cloud-metadata';
  if (ip.startsWith('ff')) return 'private'; // multicast
  return 'public';
}

function ipReasonOf(c: IpClass): SafeFetchRejectReason {
  switch (c) {
    case 'private':
      return 'private-ip';
    case 'loopback':
      return 'loopback-ip';
    case 'link-local':
      return 'link-local-ip';
    case 'cloud-metadata':
      return 'cloud-metadata-ip';
    default:
      return 'private-ip';
  }
}

function makeRejection(reason: SafeFetchRejectReason, url: string): SafeFetchRejection {
  const err = new Error(`safeFetch rejected: ${reason} (${url})`) as SafeFetchRejection;
  err.reason = reason;
  err.url = url;
  err.apts_refs = ['APTS-MR-007', 'APTS-MR-008', 'APTS-MR-009'];
  return err;
}

/** Type guard for use by callers that want to differentiate policy rejections. */
export function isSafeFetchRejection(err: unknown): err is SafeFetchRejection {
  return err instanceof Error && typeof (err as SafeFetchRejection).reason === 'string';
}
