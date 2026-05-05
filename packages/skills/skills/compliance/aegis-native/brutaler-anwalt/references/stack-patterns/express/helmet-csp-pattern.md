---
license: MIT (snippet)
provider: Express + helmet (Open-Source)
last-checked: 2026-05-05
purpose: Helmet-Integration fuer CSP + Cookie-Settings + DSGVO-konforme Security-Headers.
---

# Express — Helmet-CSP Pattern (DSGVO-konform)

## Trigger / Detection

Repo enthaelt:
- `helmet` in `package.json`
- `app.use(helmet(...))` in `app.ts` / `server.ts`
- Optional: `nonce`-Generierung via `crypto.randomBytes`
- Optional: `report-uri` / `report-to` fuer CSP-Violations

## Default-Verhalten (was passiert ohne Konfiguration)

- `helmet()` ohne Options aktiviert konservative Defaults, ABER:
  - CSP-Default ist `default-src 'self'` → blockiert alle Tracker/CDN-Resources OHNE Whitelisting
  - `Cross-Origin-Embedder-Policy: require-corp` blockiert externes Embedding
  - `Strict-Transport-Security` wird mit konservativem Max-Age gesetzt
- Ohne `helmet`: keine Security-Headers, alle XSS/Clickjacking-Vektoren offen
- CSP-Violations gehen in Console, kein Server-Side-Reporting

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| CSP fehlt → XSS-Vektor | Art. 32 DSGVO | KRITISCH | `contentSecurityPolicy` mit explizitem Allowlist |
| Inline-Scripts ohne nonce | Art. 32 DSGVO | HOCH | Nonce-Pattern oder hash-based |
| Tracker-Hosts in CSP allowlisted ohne Consent | § 25 TDDDG | MITTEL | CSP nur fuer Hosts die NACH Consent geladen werden |
| HSTS mit kurzem max-age | Art. 32 DSGVO | MITTEL | `maxAge: 31536000` + `includeSubDomains` |
| `Permissions-Policy` fehlt | DSGVO Art. 25 | NIEDRIG | Geo/Cam/Mic auf `()` setzen |

## Code-Pattern (sanitized)

```typescript
// File: src/middleware/security.ts
import helmet from 'helmet';
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Nonce pro Request fuer CSP
export function nonceMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

export function buildHelmet() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Nonce muss vom Server pro Request gerendered werden
          (_req: Request, res: Response) => `'nonce-${(res as any).locals.cspNonce}'`,
          'https://<placeholder-eu-analytics-host>',
        ],
        connectSrc: [
          "'self'",
          'https://<placeholder-eu-analytics-host>',
          'https://<placeholder-eu-error-tracking-host>',
        ],
        imgSrc: ["'self'", 'data:', 'https://<placeholder-eu-image-cdn>'],
        styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind etc.
        fontSrc: ["'self'", 'https://<placeholder-eu-font-cdn>'],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
        reportUri: ['/api/csp-report'],
      },
    },
    crossOriginEmbedderPolicy: false,  // bei externer Image-Einbettung
    strictTransportSecurity: {
      maxAge: 31536000,  // 1 Jahr
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}
```

```typescript
// File: src/routes/csp-report.ts
import { Router } from 'express';
import express from 'express';

const router = Router();

// CSP-Reports kommen mit application/csp-report content-type
router.post('/api/csp-report', express.json({ type: 'application/csp-report' }), async (req, res) => {
  const report = req.body['csp-report'] ?? req.body;

  // Logge nur sanitized Daten — kein User-PII
  console.warn('[CSP-VIOLATION]', {
    documentUri: report['document-uri'],
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    sourceFile: report['source-file'],
    timestamp: new Date().toISOString(),
  });

  // Optional: Persist in DB fuer Auswertung
  // await req.app.locals.db.cspReport.create({ data: { ...report } });

  res.status(204).end();
});

export default router;
```

```typescript
// File: src/views/layout.ejs (oder Pug/Handlebars-Equivalent)
// <html>
//   <head>
//     <script nonce="<%= cspNonce %>">
//       window.__CSP_NONCE__ = '<%= cspNonce %>';
//     </script>
//   </head>
// </html>
```

```typescript
// File: src/app.ts
import express from 'express';
import { nonceMiddleware, buildHelmet } from './middleware/security';
import cspReportRoutes from './routes/csp-report';

const app = express();

// Order matters: nonce VOR helmet
app.use(nonceMiddleware);
app.use(buildHelmet());

// Body-Parser fuer normale Routes
app.use(express.json({ limit: '100kb' }));

// CSP-Report-Endpoint
app.use(cspReportRoutes);

// ... weitere Routes
export default app;
```

## AVV / DPA

- Hosting-Provider — Art. 28 DSGVO
- CSP-Report-Logging-Provider (z.B. Sentry CSP) — AVV
- ALLE Hosts in CSP-Allowlist sind potentielle Auftragsverarbeiter und MUESSEN
  in DSE-Section "Auftragsverarbeiter" gelistet sein

## DSE-Wording-Vorlage

```markdown
### Sicherheits-Massnahmen (technisch)

Wir setzen folgende technische Schutzmassnahmen ein:

- **Content-Security-Policy (CSP):** Strikte Allowlist erlaubter Quellen
  fuer Skripte, Bilder, Fonts. Verhindert XSS-Angriffe.
- **HTTP Strict Transport Security (HSTS):** Erzwingt HTTPS-Verbindungen.
  Max-Age: 1 Jahr.
- **CSP-Violation-Reports:** Verstoesse werden anonymisiert (ohne IP/User-PII)
  protokolliert zur Sicherheits-Auswertung.

**Rechtsgrundlage:** Art. 32 DSGVO (Sicherheit der Verarbeitung) i.V.m.
Art. 6 Abs. 1 lit. f DSGVO.
**Speicherdauer CSP-Reports:** 30 Tage, ausschliesslich technische
Auswertung, kein Bezug zu Einzelpersonen.
```

## Verify-Commands (Live-Probe)

```bash
# 1. CSP-Header gesetzt
curl -sI https://<placeholder-domain>/ | grep -i "content-security-policy"
# Erwartung: lange Policy-String mit default-src, script-src etc.

# 2. HSTS mit korrektem Max-Age
curl -sI https://<placeholder-domain>/ | grep -i "strict-transport-security"
# Erwartung: max-age=31536000; includeSubDomains; preload

# 3. CSP-Report-Endpoint funktioniert
curl -X POST https://<placeholder-domain>/api/csp-report \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"document-uri":"https://<placeholder-domain>/","violated-directive":"script-src"}}' -i
# Erwartung: 204

# 4. observatory.mozilla.org-Score
# Browse zu https://observatory.mozilla.org/analyze/<placeholder-domain>
# Erwartung: Score >= A
```

## Cross-References

- AEGIS-Scanner: `csp-config-checker.ts`, `hsts-checker.ts`, `helmet-config-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 32 (Sicherheit), Art. 25 (Privacy-by-Design)
- BSI-Grundschutz: SYS.1.1 Allgemeiner Server
- Audit-Pattern: `references/audit-patterns.md` Phase 7 (Security-Header-Audit)
