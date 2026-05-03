---
license: MIT (snippet) / Vendor-Doc separat
provider: Google (Google LLC, USA)
provider-AVV-status: GA4-DPA + EU-Server-Standort verfuegbar (Consent Mode v2)
last-checked: 2026-05-02
purpose: Google Analytics 4 mit Consent Mode v2 + EU-Standort + IP-Anonymisierung.
---

# Google Analytics 4 — TOMs + Consent Mode v2

## 1. Default-Verhalten

- Datenstandort: konfigurierbar (EU oder US-Server, Default haengt von GA-Property-Setup ab)
- **Cookies**: `_ga`, `_ga_*`, `_gid` — Pflicht Consent
- IP-Anonymisierung: in GA4 standardmaessig aktiv (von Google)
- Consent Mode v2: ab Maerz 2024 EEA-Pflicht (EU + UK + CH)

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Tracker laedt vor Consent | § 25 TDDDG-Verstoss + Massen-Abmahn-Welle | ConsentGate Pflicht |
| US-Server-Standort | Schrems II / DPF-Risiko | Server-Side-Tagging mit EU-Endpoint |
| GA-Cookies in Consent-Banner als „necessary" deklariert | Tatsachen-Verschleierung + UWG | Marketing-Kategorie |
| Cross-Site-Tracking via _ga | Aufgewertete-Profile-Bildung | Server-Side-Tagging + sgtm.io |

## 3. Code-Pattern (Next.js + Consent Mode v2)

```tsx
// File: src/components/analytics/GoogleAnalytics.tsx
'use client';

import Script from 'next/script';
import { useConsent } from '@/lib/consent';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  const { consent } = useConsent();

  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          // Consent Mode v2 — Pflicht-Default vor User-Choice
          gtag('consent', 'default', {
            'ad_storage': 'denied',
            'analytics_storage': '${consent.analytics ? 'granted' : 'denied'}',
            'ad_user_data': '${consent.marketing ? 'granted' : 'denied'}',
            'ad_personalization': '${consent.marketing ? 'granted' : 'denied'}',
            'wait_for_update': 500
          });

          gtag('config', '${GA_MEASUREMENT_ID}', {
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure'
          });
        `}
      </Script>
    </>
  );
}
```

## 4. Update bei Consent-Aenderung

```tsx
// In useConsent-Hook:
useEffect(() => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_user_data: consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.marketing ? 'granted' : 'denied',
    });
  }
}, [consent]);
```

## 5. Server-Side-Tagging (besser, optional)

EU-Endpoint via sgtm.io oder Self-Hosting:
```ts
// Frontend posted Events an EU-Endpoint
fetch('https://gtm.example.com/g/collect', { /* ... */ });
```

## 6. AVV / DPA

- **DPA-Link**: https://business.safety.google/adsprocessorterms/
- **SCC-Modul**: Module 2 + 3
- **DPF**: Google ist DPF-zertifiziert (Sep 2023)

## 7. DSE-Wording-Vorlage

> Wir nutzen Google Analytics 4 (Google LLC, 1600 Amphitheatre Pkwy, Mountain View, USA)
> mit Consent Mode v2. Daten werden nur mit Ihrer ausdruecklichen Einwilligung erhoben
> (Art. 6 Abs. 1 lit. a DSGVO + § 25 Abs. 1 TDDDG). IP-Anonymisierung ist aktiv.
> EU-SCC Modul 2 + 3 abgeschlossen. Datenschutzhinweise von Google:
> https://policies.google.com/privacy.

## 8. Az.-Anker

- EuGH C-673/17 Planet49 (Cookie-Einwilligung)
- BGH I ZR 7/16 (DSGVO als UWG-Schutzgesetz)
- LG Berlin 16 O 252/22 (Reject-All-Pflicht)
- LG Duesseldorf 12 O 33/24 (TCF-Banner ohne lokale Wirksamkeit unzureichend)

## 9. Verify

```bash
# 1. Pre-Consent-Loading-Pruefung
curl -s https://example.com -H "Cookie: " | grep -ic "googletagmanager"
# Erwartung: 0 Hits

# 2. Mit gesetztem Consent-Cookie
curl -s -b "cookie-consent=$(echo '{\"analytics\":true}' | base64)" https://example.com | grep -ic "googletagmanager"
# Erwartung: 1+ Hits
```
