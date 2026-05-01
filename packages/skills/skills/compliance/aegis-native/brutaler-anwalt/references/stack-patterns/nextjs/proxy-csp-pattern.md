---
license: MIT (snippet)
purpose: Next.js (App Router 14+) Strict-Dynamic-CSP via middleware/proxy.ts
references: audit-patterns.md HIGH-RISK-CSP-Migration, references/templates/proxy-strict-dynamic.ts.example
last-checked: 2026-05-01
---

# Next.js — Strict-Dynamic-CSP via middleware/proxy

## Anlass

`script-src 'unsafe-inline'` ist die häufigste CSP-Schwäche in Next.js-Sites. Strict-Dynamic + nonce ersetzt das ohne legitime inline-Scripts zu brechen.

## Pflicht-Migration-Strategy (HIGH-RISK)

Diese Migration darf NIE direct-push sein:
1. Feature-Branch erstellen
2. middleware.ts mit nonce-Generation + CSP-Header
3. layout.tsx liest `headers().get('x-nonce')` und gibt es an inline-Scripts
4. Stripe-Elements + Supabase-OAuth + Google-Maps + GA-Snippets jeweils mit `nonce={nonce}`-Prop
5. Intensive Tests aller Interaktiv-Features
6. Stakeholder-Review
7. Merge nur nach Approval

## Code-Pattern

Siehe vollständiges Snippet: `references/templates/proxy-strict-dynamic.ts.example`

Kern-Idee:
```ts
// middleware.ts (Next.js 14+)
const nonce = btoa(crypto.getRandomValues(new Uint8Array(16)).join(''));
response.headers.set('Content-Security-Policy',
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:`);
response.headers.set('x-nonce', nonce);
```

```tsx
// layout.tsx
import { headers } from 'next/headers';
const nonce = headers().get('x-nonce') ?? '';
return <Script id="bootstrap" nonce={nonce}>...</Script>;
```

## CSP-Direktiven-Checkliste

| Direktive | Empfehlung | Warum |
|-----------|------------|-------|
| `default-src 'self'` | Pflicht | Restriktiver Default |
| `script-src 'self' 'nonce-XXX' 'strict-dynamic' https:` | Pflicht | XSS-Schutz |
| `style-src 'self' 'nonce-XXX'` | Empfohlen | inline-Style nur mit Nonce |
| `img-src 'self' data: https://<your-cdn>` | Pflicht | Bild-Quellen begrenzt |
| `connect-src 'self' https://<api> https://<analytics>` | Pflicht | API-Whitelist |
| `frame-src 'self' https://<embed>` | Pflicht | iFrame-Whitelist |
| `frame-ancestors 'none'` | Pflicht | Clickjacking-Schutz |
| `object-src 'none'` | Pflicht | Flash-Disable |
| `base-uri 'self'` | Pflicht | Base-Tag-Hijack-Schutz |
| `form-action 'self'` | Pflicht | Form-Action-Beschränkung |
| `upgrade-insecure-requests` | Empfohlen | HTTPS-Auto-Upgrade |

## Defense-in-Depth Headers (zusätzlich zur CSP)

```ts
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
response.headers.set('Strict-Transport-Security',
  'max-age=63072000; includeSubDomains; preload');
response.headers.set('Permissions-Policy',
  'camera=(), microphone=(), geolocation=(self), interest-cohort=()');
```

## Verify-Commands

```bash
# CSP-Header prüfen
curl -sIS https://<your-domain> | grep -i 'content-security-policy'
# erwarte: 'nonce-...' + 'strict-dynamic'; KEIN 'unsafe-inline'

# Mozilla Observatory-Score
curl -s "https://http-observatory.security.mozilla.org/api/v1/analyze?host=<your-domain>" \
  -X POST | jq .grade
# erwarte: A oder A+

# CSP-Reporting (optional, für Drift-Detection)
# response.headers.set('Content-Security-Policy-Report-Only', '...; report-uri /api/csp-report');
```

## Az.-Anker (CSP allgemein)

- DSGVO Art. 32 — TOMs (CSP ist anerkannte TOM)
- ENISA + BSI-Empfehlungen für moderne Web-Sicherheit
- OWASP Top 10 2023 — A03:2021 Injection
