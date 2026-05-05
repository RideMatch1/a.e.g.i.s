---
license: MIT (snippet)
provider: Astro (Open-Source)
last-checked: 2026-05-05
purpose: Astro Server-Endpoint Pattern fuer Static-Site-Tracking ohne Client-Fetches an Drittlaender.
---

# Astro — Server-Endpoint Tracking (Pattern)

## Trigger / Detection

Repo enthaelt:
- `astro.config.mjs` mit `output: 'hybrid'` oder `output: 'server'`
- `src/pages/api/*.ts` Server-Endpoints
- Adapter-Integration: `@astrojs/node` / `@astrojs/vercel` / `@astrojs/netlify`
- Static-Site mit Tracker-Bedarf, der NICHT direkt vom Client an Drittlaender geht

Zweck: Tracker-Calls laufen via eigener API-Route (Same-Origin) statt direkt an `<placeholder-tracking-domain>`. Vorteile: kein Drittland-Cookie, IP-Anonymisierung serverseitig, Proxy-Layer fuer DSGVO-Konformitaet.

## Default-Verhalten (was passiert ohne Konfiguration)

- `output: 'static'` (Default) erlaubt KEINE Server-Endpoints — Tracker laeuft direkt vom Client
- Direkte Tracker-Calls senden IP, User-Agent, Referrer ungeschuetzt an Drittland
- Keine Moeglichkeit zur Daten-Minimierung vor Tracker-Provider
- Cookie-Sets vom Drittland-Tracker nicht via § 25 TDDDG-konformem Banner gefiltert

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Direkter Drittland-Tracker-Call | Art. 44 DSGVO | KRITISCH | Server-Endpoint-Proxy + IP-Hashing |
| Kein Consent-Check serverseitig | § 25 TDDDG | HOCH | Consent-Cookie pruefen vor Forward |
| Volle IP an Provider | Art. 5 Abs. 1 lit. c | HOCH | IP-Truncate (letztes Octett /24) |
| Default-Logs Klartext-IP | Art. 5 Abs. 1 lit. f | MITTEL | Anonymisierung im Endpoint |
| Astro-SSR-Function in US-Region | Art. 44 DSGVO | KRITISCH | Adapter-Region auf EU pinnen |

## Code-Pattern (sanitized)

```typescript
// File: src/pages/api/track.ts
import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

export const prerender = false;  // Pflicht: Server-Route

const ANALYTICS_ENDPOINT = '<placeholder-eu-analytics-endpoint>';
const ANALYTICS_TOKEN = import.meta.env.ANALYTICS_TOKEN;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // 1. Consent-Check (Cookie vom Banner)
  const cookie = request.headers.get('cookie') ?? '';
  const consentMatch = /cookie-consent=([^;]+)/.exec(cookie);
  if (!consentMatch) {
    return new Response(JSON.stringify({ blocked: 'no-consent' }), { status: 204 });
  }
  try {
    const consent = JSON.parse(decodeURIComponent(consentMatch[1]));
    if (!consent.analytics) {
      return new Response(JSON.stringify({ blocked: 'analytics-opt-out' }), { status: 204 });
    }
  } catch {
    return new Response(null, { status: 204 });
  }

  // 2. Body-Validation (kein PII durchlassen)
  const payload = await request.json().catch(() => ({}));
  const safe = {
    path: typeof payload.path === 'string' ? payload.path.slice(0, 200) : '/',
    referrer: typeof payload.referrer === 'string' ? truncateReferrer(payload.referrer) : '',
    timestamp: new Date().toISOString(),
  };

  // 3. IP-Anonymisierung (letztes Octett auf 0)
  const anonIp = anonymizeIp(clientAddress);
  const ipHash = crypto.createHash('sha256').update(anonIp).digest('hex').slice(0, 16);

  // 4. Forward an EU-Analytics-Provider
  await fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANALYTICS_TOKEN}`,
    },
    body: JSON.stringify({ ...safe, visitorHash: ipHash }),
  });

  return new Response(null, { status: 204 });
};

function anonymizeIp(ip: string): string {
  if (ip.includes('.')) {
    return ip.replace(/\.\d+$/, '.0');  // IPv4 /24
  }
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 4).join(':') + '::';  // IPv6 /64
  }
  return '0.0.0.0';
}

function truncateReferrer(ref: string): string {
  try {
    const url = new URL(ref);
    return `${url.origin}${url.pathname}`;  // Kein Query-String
  } catch {
    return '';
  }
}
```

```astro
---
// File: src/components/PageView.astro
---
<script>
  // Feuert nur nach Consent (siehe cookie-banner-pattern.md)
  const consent = (() => {
    try { return JSON.parse(localStorage.getItem('cookie-consent') ?? '{}'); }
    catch { return {}; }
  })();

  if (consent.analytics) {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer,
      }),
      keepalive: true,
    });
  }
</script>
```

## AVV / DPA

- Hosting-Adapter (Vercel / Netlify / Node-Self-Host) — Art. 28 DSGVO
- Analytics-Provider (gewaehlt fuer EU-Region) — AVV + TIA bei Drittland-Backup-Region
- Optional: Logging-Provider (Datadog / Sentry) — wenn Endpoint-Logs PII enthalten muessen Logs anonymisiert sein

DSE-Pflicht-Eintrag: "Daten-Verarbeitung im Auftrag" — Tracker-Provider mit Sitz, EU-Hosting-Region, Speicherdauer, Loeschvereinbarung.

## DSE-Wording-Vorlage

```markdown
### Webanalyse via Server-Endpoint

Wir verarbeiten Webanalyse-Daten ueber unseren eigenen Server-Endpoint
(`/api/track`). Daten werden vor Weitergabe an unseren Analytics-Anbieter
anonymisiert:

- IP-Adresse: gekuerzt auf /24-Subnetz (z.B. 192.168.1.0)
- Referrer: ohne Query-String
- Visitor-Hash: SHA-256, nicht reversibel

**Anbieter:** <placeholder-analytics-provider>, Sitz: <placeholder-eu-country>,
EU-Hosting-Region: <placeholder-region>.
**Rechtsgrundlage:** § 25 Abs. 1 TDDDG i.V.m. Art. 6 Abs. 1 lit. a DSGVO
(Einwilligung).
**Speicherdauer:** <placeholder-days> Tage, danach automatische Loeschung.
**Widerruf:** [Cookie-Einstellungen](#cookie-settings) im Footer.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Endpoint blockt ohne Consent-Cookie
curl -X POST https://<placeholder-domain>/api/track \
  -H "Content-Type: application/json" -d '{"path":"/test"}' -i
# Erwartung: 204 mit Body {"blocked":"no-consent"}

# 2. Endpoint forwarded mit Consent
curl -X POST https://<placeholder-domain>/api/track \
  -H "Content-Type: application/json" \
  -H 'Cookie: cookie-consent=%7B%22analytics%22%3Atrue%7D' \
  -d '{"path":"/test"}' -i
# Erwartung: 204

# 3. Pruefe IP-Anonymisierung (Provider-Logs)
# Sollte 192.168.1.0 statt 192.168.1.42 zeigen

# 4. Region-Pruefung
dig <placeholder-domain> | grep -i "edge\|region"
# Erwartung: EU-Region
```

## Cross-References

- AEGIS-Scanner: `tracking-scan.ts`, `data-transfer-checker.ts`, `pii-flow-tracker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 44-46 (Drittland-Transfer), § 25 TDDDG
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- EDPB: `references/eu-edpb-guidelines.md` Recommendations 01/2020 SCC
- Audit-Pattern: `references/audit-patterns.md` Phase 3 (Drittland-Audit)
