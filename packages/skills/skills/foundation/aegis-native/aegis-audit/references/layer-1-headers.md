# Layer 1 Reference — HTTP-Headers

Layer 1 probes HTTP response-headers for security + privacy + caching headers. Findings here often feed Layer 5 (Cookie) + Layer 7 (Code-Cross-Check). **Time:** ~2-5 min per target.

---

## Probe Pattern

```bash
# Capture headers (HEAD + GET; some servers strip security headers on HEAD)
curl -sI "$TARGET" > /tmp/audit-headers-head.txt
curl -s -I -X GET "$TARGET" > /tmp/audit-headers-get.txt

# Compare (some sites send different headers per method)
diff /tmp/audit-headers-head.txt /tmp/audit-headers-get.txt
```

Then check each canonical header per the table below.

---

## Canonical Header Checklist

| Header | Expected | Severity if missing/weak |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | HOCH (missing) / MITTEL (max-age < 31536000) |
| `Content-Security-Policy` | strict (no `unsafe-inline` on `script-src`, no `*` on `frame-ancestors`) | KRITISCH (missing) / HOCH (`unsafe-inline`) |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` (or via CSP `frame-ancestors`) | HOCH (missing — clickjacking) |
| `X-Content-Type-Options` | `nosniff` | MITTEL (missing — MIME-sniffing) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` or stricter | MITTEL (missing) / LOW (`unsafe-url`) |
| `Permissions-Policy` | scoped (no `*` defaults) | MITTEL (missing) |
| `Cross-Origin-Opener-Policy` | `same-origin` | LOW (missing) |
| `Cross-Origin-Embedder-Policy` | `require-corp` (when applicable) | LOW (missing — only for sensitive sites) |
| `Cross-Origin-Resource-Policy` | `same-origin` or `same-site` | LOW (missing) |
| `Cache-Control` (HTML) | `no-store, no-cache, must-revalidate` for auth-pages; `public, max-age=...` for static | MITTEL (auth-page cached) |
| `Set-Cookie` (auth) | `Secure; HttpOnly; SameSite=Lax` (or `Strict`) | KRITISCH (auth-cookie without HttpOnly) |
| `Server` | absent or generic (no version-disclosure) | LOW (verbose server-header) |
| `X-Powered-By` | absent | LOW (verbose framework-disclosure) |

---

## CSP Strictness Check

```bash
csp=$(grep -i "content-security-policy" /tmp/audit-headers-get.txt | cut -d: -f2-)
echo "$csp"

# Check for KRITISCH/HOCH patterns
grep -q "unsafe-inline" <<<"$csp" && echo "L1-CSP-UNSAFE-INLINE: HOCH"
grep -q "unsafe-eval" <<<"$csp" && echo "L1-CSP-UNSAFE-EVAL: HOCH"
grep -q "frame-ancestors[^;]*\*" <<<"$csp" && echo "L1-CSP-FRAME-ANCESTORS-WILDCARD: KRITISCH"
grep -q "default-src[^;]*\*" <<<"$csp" && echo "L1-CSP-DEFAULT-SRC-WILDCARD: KRITISCH"
```

Strictest CSP pattern (next.js with strict-dynamic + nonce):

```
default-src 'self'; 
script-src 'self' 'nonce-<hash>' 'strict-dynamic' https:; 
style-src 'self' 'unsafe-inline'; 
img-src 'self' data: https:; 
connect-src 'self'; 
frame-ancestors 'none';
```

`style-src 'unsafe-inline'` is acceptable (CSS injection has lower exploitation impact than JS injection); `script-src 'unsafe-inline'` is not.

---

## HSTS Preload Check

```bash
# If max-age < 31536000 OR missing includeSubDomains OR missing preload — not preload-eligible
hsts=$(grep -i "strict-transport-security" /tmp/audit-headers-get.txt | cut -d: -f2-)
max_age=$(grep -oE "max-age=[0-9]+" <<<"$hsts" | cut -d= -f2)
[ -z "$max_age" ] && echo "L1-HSTS-MISSING: HOCH"
[ -n "$max_age" ] && [ "$max_age" -lt 31536000 ] && echo "L1-HSTS-TOO-SHORT: MITTEL"
grep -qi "includesubdomains" <<<"$hsts" || echo "L1-HSTS-NO-SUBDOMAINS: MITTEL"
grep -qi "preload" <<<"$hsts" || echo "L1-HSTS-NO-PRELOAD: LOW"
```

For preload-list eligibility, also verify:

```bash
# At https://hstspreload.org/ — site must:
# - Serve HSTS header on root domain + all subdomains
# - max-age >= 31536000 (1 year)
# - includeSubDomains
# - preload
# - Redirect HTTP to HTTPS on root + subdomains
```

---

## Cookie Header Cross-Check (feeds Layer 5)

```bash
# Capture all Set-Cookie lines
grep -i "^set-cookie:" /tmp/audit-headers-get.txt
```

For each cookie, check:

- `Secure` flag set (only sent over HTTPS)
- `HttpOnly` flag set (no JS-access; KRITISCH if missing on auth-cookie)
- `SameSite` set (`Lax` or `Strict`; `None` requires `Secure`)
- `Path=/` reasonable scope
- `Max-Age` or `Expires` set (no session-cookies for tracking that should be persistent)

Layer 5 (Cookie + Consent) cross-references each cookie against the consent-status: any tracking-cookie set BEFORE consent is a TTDSG/TDDDG §25 violation.

---

## Findings Format

Each Layer 1 finding writes to the structured findings-list:

```yaml
- id: L1-CSP-UNSAFE-INLINE
  layer: 1
  severity: HOCH
  evidence:
    url: <target>
    header_name: Content-Security-Policy
    header_value: "default-src 'self'; script-src 'self' 'unsafe-inline' ..."
  recommendation: "Replace 'unsafe-inline' with nonce-based CSP per OWASP CSP-3 cheatsheet"
  citation: "OWASP CSP-3, BSI TR-03116-4 §4.2"
```

---

## Anti-Patterns specific to Layer 1

- ❌ Reporting "HSTS missing" when site is HTTP-only — first fix HTTP-to-HTTPS redirect; HSTS is moot otherwise.
- ❌ Reporting "CSP unsafe-inline" without checking if the inline is `style-src` — script-src is the dangerous one; style-src is acceptable.
- ❌ Skipping cookie-headers — they feed Layer 5; Layer 5 then fails to detect pre-consent trackers.
- ❌ HEAD-only probe — some sites strip security-headers on HEAD; always run GET too.
- ❌ Reporting "X-XSS-Protection missing" — that header is deprecated (no longer recommended; modern CSP supersedes).
