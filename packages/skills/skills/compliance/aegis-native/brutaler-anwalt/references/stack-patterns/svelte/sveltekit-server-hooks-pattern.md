---
license: MIT (snippet)
provider: SvelteKit (Open-Source)
last-checked: 2026-05-05
purpose: SvelteKit Server-Hooks Pattern fuer Tracker-Authorization + Consent-Cookie-Forwarding.
---

# SvelteKit — Server-Hooks Pattern (Tracker-Auth + Consent-Forward)

## Trigger / Detection

Repo enthaelt:
- `src/hooks.server.ts` oder `src/hooks.server.js`
- `handle`/`handleFetch` Export
- `event.cookies` / `event.locals` Usage
- Optional: `/api/track` oder `/api/consent-log` Server-Endpoints

Pattern: Server-Hooks pruefen den Consent-Cookie BEVOR sie Tracker-Server-Calls (intern oder als Reverse-Proxy) durchfuehren. Bei fehlendem Consent wird der Tracker-Forward unterdrueckt.

## Default-Verhalten (was passiert ohne Konfiguration)

- Default-`hooks.server.ts` ist meistens leer (kein Handle-Export) → keine Cookie-Validierung
- `handleFetch` wird nicht ueberschrieben → SvelteKit forwarded Server-Side-Fetch ohne Consent-Pruefung
- Tracker-Calls werden in `+page.server.ts` blind ausgefuehrt
- Set-Cookie-Header werden vom Server gesetzt ohne `Secure;HttpOnly;SameSite=Lax`-Flags

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Server-Tracker-Call ohne Consent | § 25 TDDDG | KRITISCH | Hook prueft `cookie-consent` vor Forward |
| Tracker-Cookie ohne `Secure` Flag | Art. 32 DSGVO | HOCH | `cookies.set(..., { secure, sameSite: 'lax' })` |
| Drittland-Forward in `handleFetch` | Art. 44 DSGVO | KRITISCH | Allowlist EU-Hosts |
| Klartext-IP in Server-Logs | Art. 5 Abs. 1 lit. f | HOCH | IP-Hash in Hook |
| Consent-Cookie nicht `HttpOnly` (wenn nur Server liest) | Art. 32 DSGVO | MITTEL | Trennung: Read-Cookie HttpOnly, Banner-Cookie nicht |

## Code-Pattern (sanitized)

```typescript
// File: src/hooks.server.ts
import type { Handle, HandleFetch } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import crypto from 'node:crypto';

const ANALYTICS_ALLOWLIST = new Set([
  '<placeholder-eu-analytics-host>',
  '<placeholder-eu-error-tracking-host>',
]);

const consentHandle: Handle = async ({ event, resolve }) => {
  // 1. Lese Consent-Cookie (kein HttpOnly, weil Banner-Komponente liest)
  const raw = event.cookies.get('cookie-consent');
  let consent = { necessary: true, analytics: false, marketing: false };
  if (raw) {
    try {
      consent = { ...consent, ...JSON.parse(raw) };
    } catch {
      /* ignore malformed */
    }
  }

  // 2. In locals fuer Page-Server-Code verfuegbar
  event.locals.consent = consent;

  // 3. IP-Hash fuer Logs (anonymisiert)
  const rawIp = event.getClientAddress();
  event.locals.ipHash = crypto
    .createHash('sha256')
    .update(rawIp + (process.env.IP_HASH_SALT ?? ''))
    .digest('hex')
    .slice(0, 16);

  // 4. Resolve Request
  const response = await resolve(event);

  // 5. Security-Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  return response;
};

const fetchHandle: HandleFetch = async ({ event, request, fetch }) => {
  const url = new URL(request.url);

  // Allowlist-Check fuer Drittland-Calls
  if (!ANALYTICS_ALLOWLIST.has(url.host) && url.host !== event.url.host) {
    // Pruefe Consent vor externem Fetch
    if (!event.locals.consent?.analytics) {
      return new Response(JSON.stringify({ blocked: 'consent-required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return fetch(request);
};

export const handle = sequence(consentHandle);
export const handleFetch = fetchHandle;
```

```typescript
// File: src/app.d.ts (Type-Augmentation)
declare global {
  namespace App {
    interface Locals {
      consent: {
        necessary: true;
        analytics: boolean;
        marketing: boolean;
      };
      ipHash: string;
    }
  }
}

export {};
```

```typescript
// File: src/routes/api/track/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
  // Hook hat consent + ipHash gesetzt
  if (!locals.consent.analytics) {
    return json({ blocked: 'analytics-opt-out' }, { status: 204 });
  }

  const payload = await request.json();
  const safe = {
    path: typeof payload.path === 'string' ? payload.path.slice(0, 200) : '/',
    visitorHash: locals.ipHash,
    timestamp: new Date().toISOString(),
  };

  // Forward an EU-Provider (im Allowlist)
  await fetch('https://<placeholder-eu-analytics-host>/api/event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ANALYTICS_TOKEN}`,
    },
    body: JSON.stringify(safe),
  });

  return new Response(null, { status: 204 });
};
```

```typescript
// File: src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  return {
    // Niemals ipHash an Client leaken
    consent: locals.consent,
  };
};
```

## AVV / DPA

- Hosting-Adapter mit EU-Region (Vercel `regions: ['fra1']` / Cloudflare Workers EU) — Art. 28 DSGVO
- Analytics-Provider (im Allowlist) — AVV mit EU-Hosting
- Logging-Provider (Sentry / Datadog EU) — AVV; Logs muessen IP-Hashed sein

## DSE-Wording-Vorlage

```markdown
### Server-Side-Verarbeitung

Diese Webseite verwendet SvelteKit mit Server-Side Rendering. Beim
initialen Aufruf werden serverseitig folgende Daten kurzzeitig verarbeitet:

- IP-Adresse: nur als SHA-256-Hash (mit Salt) gespeichert, niemals im Klartext
- User-Agent (anonymisiert auf Browser-Familie)
- Sprach-Header (`Accept-Language`)

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (Sicherheit, Stabilitaet)
i.V.m. § 25 Abs. 2 Nr. 2 TDDDG.
**Speicherdauer:** Server-Logs 14 Tage, Hashes 30 Tage zur Missbrauchs-Erkennung.
**Externe Forwards:** nur an Auftragsverarbeiter im EU-Wirtschaftsraum
([Liste in Auftragsverarbeiter-Section](#auftragsverarbeiter)).
```

## Verify-Commands (Live-Probe)

```bash
# 1. Security-Headers gesetzt
curl -sI https://<placeholder-domain>/ | grep -iE "x-content-type-options|referrer-policy|permissions-policy"
# Erwartung: 3 Treffer

# 2. Tracker-Endpoint blockt ohne Consent-Cookie
curl -X POST https://<placeholder-domain>/api/track \
  -H "Content-Type: application/json" -d '{"path":"/test"}' -i
# Erwartung: 204 mit "analytics-opt-out"

# 3. handleFetch blockiert Drittland-Forward
# (manueller Test: setze Server-Code-Stelle die nicht-allowlisted Host fetcht)

# 4. IP-Hash niemals im Client-State
curl -sS https://<placeholder-domain>/ | grep -ic "ipHash"
# Erwartung: 0
```

## Cross-References

- AEGIS-Scanner: `server-hook-checker.ts`, `cors-allowlist-checker.ts`, `pii-flow-tracker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 32 (Sicherheit), Art. 44 (Drittland)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 3 (Drittland-Audit), Phase 6 (Server-Side-Logs)
