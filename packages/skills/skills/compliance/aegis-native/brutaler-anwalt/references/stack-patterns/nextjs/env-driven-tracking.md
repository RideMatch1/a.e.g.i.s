---
license: MIT (snippet)
provider: Next.js (Vercel) — Framework
last-checked: 2026-05-02
purpose: Pattern fuer ENV-Driven Tracking-Loading mit Build-Arg-Pitfall-Schutz.
---

# Next.js — ENV-Driven Tracking (Pattern)

## 1. Default-Verhalten / Pitfalls

`NEXT_PUBLIC_*`-ENV-Vars werden zur **Build-Zeit** im Client-Bundle eingelogged (string-replace).
Wenn das Deployment-Tool (Dokploy / Coolify / Nixpacks / Railway) die ENV nur als
**Runtime-ENV** durchreicht aber nicht als `--build-arg` weitergibt, landet `undefined` im Bundle.

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Build-Arg-Pitfall | Tracker-URL leer → Tracker laeuft nicht | Build-Arg-Konfiguration |
| Tracker laedt vor Consent | § 25 TDDDG-Verstoss | ConsentGate |
| Tracker-URL hardcoded | Drift bei Subdomain-Wechsel | env-driven mit Default |
| Bundle leakt Brand-Codename | Public-OPSec-Issue | env-driven mit Brand-eigener Subdomain |

## 3. Code-Pattern (sanitized)

```ts
// File: src/components/analytics/UmamiScript.tsx
'use client';

import Script from 'next/script';
import { useConsent } from '@/lib/consent';

const ANALYTICS_HOST = (
  process.env.UMAMI_HOST ||
  process.env.NEXT_PUBLIC_ANALYTICS_HOST ||
  'https://metrics.example.com'  // Default = Brand-eigene Subdomain
).replace(/\/+$/, '');

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export default function UmamiScript() {
  const { hasConsented } = useConsent();

  if (!hasConsented('analytics') || !WEBSITE_ID) {
    return null;
  }

  return (
    <Script
      defer
      src={`${ANALYTICS_HOST}/script.js`}
      data-website-id={WEBSITE_ID}
      strategy="afterInteractive"
    />
  );
}
```

```dockerfile
# Dockerfile (builder-Stage)
FROM node:22-alpine AS builder

# Pflicht: NEXT_PUBLIC_*-Vars muessen ARG + ENV im Build-Stage sein
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID
ARG NEXT_PUBLIC_ANALYTICS_HOST
ENV NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID
ENV NEXT_PUBLIC_ANALYTICS_HOST=$NEXT_PUBLIC_ANALYTICS_HOST

# ... rest
```

```yaml
# Dokploy Build-Args (oder vergleichbares Tool)
buildArgs:
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: "abc-123"
  NEXT_PUBLIC_ANALYTICS_HOST: "https://metrics.example.com"
```

## 4. Server-Component-Variante (besser, kein Bundle-Leak)

```ts
// File: src/app/layout.tsx (Server-Component)
import { headers } from 'next/headers';

export default async function RootLayout({ children }) {
  const analyticsHost = process.env.UMAMI_HOST;  // server-only, kein NEXT_PUBLIC_

  return (
    <html>
      <head>
        {analyticsHost && (
          <script
            defer
            src={`${analyticsHost}/script.js`}
            data-website-id={process.env.UMAMI_WEBSITE_ID}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Server-Component-Variante:
- Keine NEXT_PUBLIC_-Pflicht (server-only env)
- Container-Runtime-ENV reicht (kein Build-Arg)
- Kein Code-Var-Leak im Public-Bundle

## 5. DSE-Wording-Vorlage

> Wir verwenden Umami (selbst-gehostete Webanalyse) auf `metrics.example.com`. Daten
> werden ohne Cookies erhoben + ohne Personenbezug ueber DAU-Hash. Erhebung erfolgt
> mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO + § 25 Abs. 1 TDDDG).

## 6. Verify-Commands

```bash
# 1. Bundle-Check (NEXT_PUBLIC_-Pfad)
docker exec <container> grep -rE "metrics.example.com|UMAMI_WEBSITE_ID" \
  /app/.next/server/chunks/ /app/.next/static/ 2>&1 | head -3

# 2. SSR-Render-Check (Server-Component-Pfad)
curl -s https://example.com | grep -oE 'metrics.example.com'

# 3. Pre-Consent-Loading-Pruefung
curl -s https://example.com | grep -oE '<script[^>]*metrics.example.com[^>]*>'
# Erwartung: kein direkter Script-Tag ohne ConsentGate-Wrapper
```

## 7. Az.-Anker

- EuGH C-673/17 Planet49 (Cookie-Einwilligung)
- BGH I ZR 7/16 (DSGVO-Pflichtinformation als UWG-Schutzgesetz)
