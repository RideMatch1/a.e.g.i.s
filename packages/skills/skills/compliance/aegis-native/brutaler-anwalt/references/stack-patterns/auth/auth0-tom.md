---
license: MIT (snippet) / Vendor-Doc separat
provider: Auth0 (Okta, USA)
provider-AVV-status: Standardvertrag verfuegbar (DPA + EU-SCC + DPF)
last-checked: 2026-05-02
purpose: Auth0 TOMs + DPA + DSE-Wording.
---

# Auth0 — TOMs + DPA + DSE-Wording

## 1. Default-Verhalten

- Datenstandort waehlbar: US / EU / Australia / Japan
- **Default = US**! EU-Tenant muss explizit gewaehlt werden.
- Sub-Auftragsverarbeiter: AWS (Hosting), CloudFlare (CDN)
- Cookies: `auth0.is.authenticated`, `_legacy_*`, einige technisch noetig

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Default-Region us-east-1 | Drittland-Transfer USA | EU-Tenant beantragen + Migration |
| DPF-Status (Okta DPF-zertifiziert seit Sep 2023) | Drittland-Transfer-Risiko bei DPF-Klage | EU-Tenant + SCC zusaetzlich |
| Cookies vor Consent | § 25 TDDDG | bei Login-Page nur necessary Cookies |
| Magic-Link via Email | Phishing-Risiko | DMARC + SPF + DKIM auf custom-Sending-Domain |

## 3. Code-Pattern (Next.js)

```ts
// File: src/lib/auth0.ts
import { initAuth0 } from '@auth0/nextjs-auth0';

export const auth0 = initAuth0({
  baseURL: process.env.AUTH0_BASE_URL,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,  // PFLICHT: EU-Tenant URL
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  session: {
    rollingDuration: 60 * 60 * 24,
    absoluteDuration: 60 * 60 * 24 * 30,
    cookie: {
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    },
  },
  routes: {
    callback: '/api/auth/callback',
    postLogoutRedirect: '/',
  },
});
```

## 4. EU-Tenant aktivieren

Pflicht-Setting im Auth0-Dashboard:
- Bei Tenant-Erstellung "EU" als Region waehlen
- URL: `https://<tenant>.eu.auth0.com/...`

Migration bestehender US-Tenant: nicht trivial, ggf. neue Tenant-ID + Daten-Migration.

## 5. AVV / DPA

- **DPA-Link**: https://www.okta.com/agreements/data-processing-addendum/
- **SCC-Modul**: Module 2 (Controller-Processor)
- **DPF**: seit Sep 2023 zertifiziert
- **Sub-Processors**: https://www.okta.com/agreements/sub-processors/

## 6. DSE-Wording-Vorlage

> Wir nutzen den Identity-Service Auth0 (von Okta, Inc., 100 First St, San Francisco, USA)
> als Auftragsverarbeiter im Sinne von Art. 28 DSGVO. Datenstandort: EU-Region (Frankfurt).
> Auth0 ist DPF-zertifiziert (https://www.dataprivacyframework.gov). Zusaetzlich
> haben wir EU-Standardvertragsklauseln Modul 2 abgeschlossen. Detaillierte
> Datenschutzhinweise: https://www.okta.com/privacy-policy/.

## 7. Verify

```bash
# Region-Check
curl -sI "https://<tenant>.eu.auth0.com/" | grep -i "X-Region"
# Erwartung: eu

# Cookie-Inspection nach Login
curl -sI https://example.com/api/auth/callback | grep -i set-cookie
# Erwartung: Secure + HttpOnly + SameSite=Lax
```

## 8. Az.-Anker

- EuGH C-311/18 Schrems II (DPF-Risiko)
