<!-- aegis-local: AEGIS-native skill, MIT-licensed; mirrors @aegis-wizard/cli ssrf-defense pattern + addresses AEGIS scanner finding: ssrf-checker (CWE-918). -->

---
name: defensive-ssrf
description: "Server-Side Request Forgery (SSRF) defense methodology. Covers RFC 1918 / link-local block-rules, allowlist-vs-denylist trade-offs, DNS rebinding defense, IPv6 considerations, cloud metadata-endpoint protection (AWS / GCP / Azure), proxy/redirect handling, AEGIS ssrf-checker remediation, and the SSRF-safe-fetch primitive. Use when designing fetch-from-user-input flows, fixing AEGIS ssrf-checker findings, or hardening SSRF-prone endpoints (image proxies, webhook receivers, OAuth callbacks)."
---

# SSRF Defense — Server-Side Request Forgery Methodology

## When to use this skill

- Building any feature where the server fetches a URL based on user input (image proxy, link preview, webhook delivery, OAuth callback, profile-picture import, document-rendering service).
- Fixing AEGIS `ssrf-checker` (CWE-918) findings.
- Hardening before a security audit, especially in cloud-deployed apps where metadata endpoints (`169.254.169.254`) are reachable.

## The core invariant

**Server-initiated HTTP requests where the URL is user-controlled MUST validate that the resolved IP is in an allowed set BEFORE issuing the request, AND the validation must survive DNS rebinding.**

The "MUST survive DNS rebinding" is what kills naive defenses. An attacker controls a DNS server that returns a public IP on first lookup and a private IP on second lookup; if your code resolves the URL once for validation and again for the fetch, you lose.

## The secure primitive

```typescript
// lib/security/safeFetch.ts (AEGIS scaffold ships this)

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF-safe fetch — validates the resolved IP before issuing the request,
 * and pins the resolution to defeat DNS rebinding.
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const parsed = new URL(url);

  // Reject non-HTTP(S) schemes — file://, gopher://, dict://, etc.
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`SSRF: protocol ${parsed.protocol} not allowed`);
  }

  // Reject if hostname is already an IP literal in a forbidden range
  if (isIP(parsed.hostname)) {
    if (isForbiddenIP(parsed.hostname)) {
      throw new Error(`SSRF: IP ${parsed.hostname} not allowed`);
    }
  } else {
    // Resolve to an IP and verify
    const { address } = await lookup(parsed.hostname);
    if (isForbiddenIP(address)) {
      throw new Error(`SSRF: ${parsed.hostname} → ${address} not allowed`);
    }
    // Defeat DNS rebinding — pin the resolved IP and use it for the fetch
    const pinnedURL = parsed.protocol + '//' + address + parsed.pathname + parsed.search;
    return fetch(pinnedURL, {
      ...init,
      headers: {
        ...init?.headers,
        Host: parsed.hostname,  // preserve original hostname for SNI / Host-header routing
      },
    });
  }

  return fetch(url, init);
}

function isForbiddenIP(ip: string): boolean {
  // Loopback
  if (ip.startsWith('127.') || ip === '::1') return true;
  // Private RFC 1918
  if (ip.startsWith('10.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('192.168.')) return true;
  // Link-local
  if (ip.startsWith('169.254.')) return true;
  if (ip.toLowerCase().startsWith('fe80:')) return true;
  // Unique local IPv6 (fc00::/7)
  if (/^f[cd]/i.test(ip)) return true;
  // Cloud metadata
  if (ip === '169.254.169.254') return true;  // AWS / GCP / Azure / DO
  if (ip === '169.254.170.2') return true;  // ECS task metadata
  // Carrier-grade NAT (RFC 6598)
  if (/^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(ip)) return true;
  return false;
}
```

## Why "just block 169.254.0.0/16" is not enough

Old advice: block 127.0.0.0/8 and 169.254.0.0/16. Modern requirement: also block:

- All RFC 1918 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) — internal services.
- IPv6 loopback (`::1`) and link-local (`fe80::/10`) and unique-local (`fc00::/7`).
- Carrier-grade NAT (100.64.0.0/10, RFC 6598) — your cloud may NAT here.
- The cloud-specific metadata IPs your provider exposes.
- Any "alias to localhost" hostnames your provider provides (e.g., `localhost`, `0.0.0.0`).

AEGIS's `ssrf-checker` and the scaffold's `safeFetch` cover all of these.

## Anti-patterns

### Anti-pattern 1 — naive allowlist on hostname before resolution

```typescript
// BROKEN — bypassed by attacker-controlled DNS
const ALLOWED = ['api.partner.com'];
if (!ALLOWED.some(h => url.includes(h))) throw new Error('not allowed');
await fetch(url);  // attacker registers `api.partner.com.attacker.com` — passes the .includes() check
```

### Anti-pattern 2 — validate-then-fetch (TOCTOU)

```typescript
// BROKEN — DNS rebinding gap between validate and fetch
const { address } = await lookup(new URL(url).hostname);
if (isForbiddenIP(address)) throw new Error('blocked');
await fetch(url);  // second resolution may now return a private IP
```

Always **pin the resolved IP** for the actual fetch (see `safeFetch` above).

### Anti-pattern 3 — trusting `fetch` to follow redirects safely

`fetch` follows up to 20 redirects by default. An attacker-controlled allowed URL can redirect to a private IP. Mitigate:

```typescript
await safeFetch(url, { redirect: 'manual' });
```

Then if the response is 3xx, re-validate the `Location` header through `safeFetch` before following.

### Anti-pattern 4 — `encodeURIComponent` as SSRF defense

`encodeURIComponent` blocks XSS and SSRF-via-path-traversal (`../`), but it does NOT block SSRF-via-host. A URL like `http://169.254.169.254/latest/meta-data/` survives `encodeURIComponent` of the path component because the host part isn't encoded. The `ssrf-checker` per-CWE sanitizer-awareness logic catches this — `encodeURIComponent` is recognized as an XSS sanitizer but NOT as an SSRF sanitizer.

## Cloud-metadata-endpoint protection

AWS, GCP, Azure, and DigitalOcean all expose internal metadata at `http://169.254.169.254/`. SSRF-to-metadata is the most common cloud breach pattern of the last decade.

AWS specifically provides IMDSv2 which adds a token-handshake — enable IMDSv2 on every instance:

```bash
# AWS — enforce IMDSv2 (token-required) at instance level
aws ec2 modify-instance-metadata-options \
  --instance-id <id> \
  --http-tokens required \
  --http-put-response-hop-limit 1
```

But IMDSv2 is defense-in-depth; the primary defense is still application-level SSRF protection.

## Webhook receivers — special case

Webhooks are RECEIVED rather than initiated, so SSRF doesn't directly apply. But the pattern of "process this URL someone gave us" often does — for example, a webhook may include a callback URL that your server then fetches. Apply the same `safeFetch` discipline.

For OAuth callbacks: the callback URL is operator-configured, not request-controlled, so SSRF doesn't apply. But verify the redirect_uri matches the registered URL exactly (not `startsWith`-style).

## How AEGIS scanners help

| Scanner | What it catches |
|---|---|
| `ssrf-checker` (CWE-918) | `fetch(userInput)` patterns; recognizes `safeFetch`, `parseInt`, RFC 1918 / link-local literals, regex-guarded URL filters as sanitizers per per-CWE awareness rules |
| `taint-analyzer` (CWE-918) | Cross-file taint from request input → `fetch` sink |
| `open-redirect-checker` (CWE-601) | Sibling pattern — `redirect(userInput)` |
| `header-checker` (CWE-693) | CSP includes `connect-src` allowlist that limits client-side fetch destinations |

## Incident response — SSRF exploited

1. **Disclose internally** — immediately if the attacker reached the cloud metadata endpoint (potential credential theft).
2. **Rotate cloud credentials** — assume any IAM credentials reachable via metadata are compromised.
3. **Audit logs** — pull all outbound fetches from the affected service in the relevant window.
4. **Patch and re-deploy** — replace the unsafe `fetch` with `safeFetch`.
5. **Audit similar code paths** — SSRF tends to come in clusters; one finding usually has siblings.

## See also

- AEGIS patterns library — `docs/patterns/index.md` § "Hardened middleware".
- `aegis-wizard/cli` scaffold — ships `safeFetch` as one of the 11 clean-room security primitives.
- OWASP SSRF prevention cheat sheet — https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
