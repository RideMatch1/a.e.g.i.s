---
license: MIT (snippet)
provider: Express.js (Open-Source)
last-checked: 2026-05-05
purpose: Express Middleware-Stack Pattern fuer Consent-Cookie-Read + Conditional Tracker-Mount.
---

# Express — Cookie-Banner Middleware Pattern

## Trigger / Detection

Repo enthaelt:
- `express` in `package.json`
- `cookie-parser` Middleware
- `app.use(...)` Mount-Pattern in `app.ts` / `server.ts` / `index.js`
- Optional: Server-rendered Views (Pug/EJS/Handlebars) mit Banner-Component

## Default-Verhalten (was passiert ohne Konfiguration)

- `cookie-parser` setzt keine `Secure;HttpOnly;SameSite`-Defaults
- Kein zentrales Consent-Validation-Middleware → Tracker laeuft via Hardcoded-Routes
- `app.use(express.static('public'))` cached HTML mit hardcoded Tracker-Tags
- Headers wie `X-Powered-By: Express` leaken Stack-Info
- Default-Logger (morgan) loggt volle IPs

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker im Static-HTML hardcoded | § 25 TDDDG | KRITISCH | Server-Side-Render mit Consent-Pruefung |
| Consent-Cookie ohne `Secure;SameSite` | Art. 32 DSGVO | HOCH | `cookie.set` mit Flags |
| Klartext-IP in morgan-Log | Art. 5 lit. f | HOCH | Custom IP-Hash-Token |
| Fehlendes `helmet` → keine Security-Headers | Art. 32 DSGVO | KRITISCH | `helmet()` Middleware |
| `X-Powered-By: Express` Header | Art. 25 DSGVO Privacy-by-Design | NIEDRIG | `app.disable('x-powered-by')` |

## Code-Pattern (sanitized)

```typescript
// File: src/middleware/consent.ts
import type { Request, Response, NextFunction } from 'express';

export type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
  version: string;
};

declare global {
  namespace Express {
    interface Request {
      consent: Consent;
    }
  }
}

const defaultConsent: Consent = {
  necessary: true,
  analytics: false,
  marketing: false,
  version: '1.0',
};

export function consentMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = req.cookies?.['cookie-consent'];
  if (!raw) {
    req.consent = { ...defaultConsent };
    return next();
  }
  try {
    const parsed = JSON.parse(raw);
    req.consent = { ...defaultConsent, ...parsed };
  } catch {
    req.consent = { ...defaultConsent };
  }
  next();
}

export function requireAnalyticsConsent(req: Request, res: Response, next: NextFunction) {
  if (!req.consent.analytics) {
    return res.status(204).json({ blocked: 'analytics-opt-out' });
  }
  next();
}
```

```typescript
// File: src/routes/consent.ts
import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();

router.post('/api/consent-log', async (req, res) => {
  const consent = req.body;
  if (!consent || typeof consent.analytics !== 'boolean') {
    return res.status(400).json({ error: 'invalid payload' });
  }

  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    ?? req.socket.remoteAddress
    ?? '';
  const ipHash = crypto
    .createHash('sha256')
    .update(ip + (process.env.IP_HASH_SALT ?? ''))
    .digest('hex')
    .slice(0, 16);

  // Persist via DB-Layer (Pseudo-Code)
  await req.app.locals.db.consentLog.create({
    data: {
      ipHash,
      userAgent: req.headers['user-agent']?.slice(0, 200) ?? '',
      consent: JSON.stringify(consent),
      timestamp: new Date(),
    },
  });

  // Set Cookie mit allen Security-Flags
  res.cookie('cookie-consent', JSON.stringify({ ...consent, timestamp: new Date().toISOString() }), {
    httpOnly: false,  // Banner-JS muss lesen koennen
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 30 * 24 * 60 * 60 * 1000,  // 12 Monate
    path: '/',
  });

  res.status(204).end();
});

export default router;
```

```typescript
// File: src/app.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { consentMiddleware, requireAnalyticsConsent } from './middleware/consent';
import consentRoutes from './routes/consent';

const app = express();

// Security
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://<placeholder-eu-analytics-host>"],
      connectSrc: ["'self'", "https://<placeholder-eu-analytics-host>"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Body + Cookies
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(consentMiddleware);

// IP-anonymisiertes Logging (custom morgan-token)
morgan.token('ipHash', (req) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    ?? req.socket.remoteAddress ?? '';
  return require('crypto').createHash('sha256').update(ip).digest('hex').slice(0, 8);
});
app.use(morgan(':ipHash :method :url :status :response-time ms'));

// Routes
app.use(consentRoutes);
app.post('/api/track', requireAnalyticsConsent, async (req, res) => {
  // ... Tracker-Forward-Logic
  res.status(204).end();
});

export default app;
```

## AVV / DPA

- Hosting-Provider — Art. 28 DSGVO
- Datenbank-Provider (Postgres-Cloud / Mongo-Atlas EU) — AVV
- Logging-Provider (sofern extern) — AVV mit IP-Hash-Garantie
- Reverse-Proxy (Cloudflare / Fastly EU) — AVV

## DSE-Wording-Vorlage

```markdown
### Server-Logs

Beim Aufruf dieser Webseite werden technische Daten in Server-Logs erfasst:

- Hash der IP-Adresse (SHA-256, gekuerzt auf 8 Zeichen)
- Zeitstempel des Aufrufs
- HTTP-Methode und URL
- HTTP-Statuscode
- Antwortzeit (ms)
- User-Agent (max. 200 Zeichen)

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
sicherem Webseitenbetrieb).
**Speicherdauer:** 14 Tage, danach automatische Loeschung.
**Hinweis:** Die volle IP-Adresse wird zu keinem Zeitpunkt gespeichert.
```

## Verify-Commands (Live-Probe)

```bash
# 1. X-Powered-By NICHT vorhanden
curl -sI https://<placeholder-domain>/ | grep -i "x-powered-by"
# Erwartung: leer

# 2. helmet-Headers
curl -sI https://<placeholder-domain>/ | grep -iE "x-content-type-options|x-frame-options|strict-transport-security"
# Erwartung: 3 Treffer

# 3. Tracker-Endpoint blockt ohne Consent
curl -X POST https://<placeholder-domain>/api/track -i
# Erwartung: 204 mit "blocked":"analytics-opt-out"

# 4. Consent-Cookie mit Secure-Flags
curl -X POST https://<placeholder-domain>/api/consent-log \
  -H "Content-Type: application/json" \
  -d '{"necessary":true,"analytics":false,"marketing":false}' -i
# Erwartung: Set-Cookie: cookie-consent=...; SameSite=Lax; Path=/; HttpOnly nein; Secure ja
```

## Cross-References

- AEGIS-Scanner: `cookie-flags-checker.ts`, `helmet-config-checker.ts`, `morgan-pii-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 32 (Sicherheit), § 25 TDDDG
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- Audit-Pattern: `references/audit-patterns.md` Phase 6 (Server-Side-Logs)
