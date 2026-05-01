---
license: MIT (snippet)
provider: Plausible Insights OÜ (Estland) — EU-Anbieter
provider-AVV-status: Standardvertrag verfügbar (DPA)
last-checked: 2026-05-01
---

# Plausible Analytics — Cookieless Tracking + DSE-Wording

## 1. Default-Verhalten

- **Cookieless** by default — keine Tracking-Cookies, kein LocalStorage
- **EU-Hosting**: Server in Deutschland (Hetzner Falkenstein)
- **IP-Anonymisierung**: serverseitig, keine vollständige IP gespeichert
- **DNT-Respektierung**: Plausible respektiert Do-Not-Track auf Server-Seite
- **GDPR-konform** by design: keine personenbezogenen Daten gespeichert (anonyme Aggregate)

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|--------|---------|-----|
| Trotz cookieless: Skript-Aufruf von externer Domain | minimaler Drittland-Risk | Selbst-Hosting via Subdomain (siehe Code-Pattern) |
| Outbound-Link-Tracking | Browser-Telemetrie | per Skript-Variante optional |
| Custom-Events mit personenbezogenen Daten | Risiko Re-Identifizierung | Events ohne PII (nur Page-Path / Action-Type) |

## 3. Code-Pattern: env-driven, self-hostable

```tsx
// File: src/components/analytics/Plausible.tsx
'use client';
import Script from 'next/script';

export function PlausibleAnalytics() {
  // env-driven: Default = own-subdomain für ZUSÄTZLICHE Hardenings
  const host = (
    process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? 'https://plausible.io'
  ).replace(/\/+$/, '');
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) return null; // fail-soft

  return (
    <Script
      strategy="afterInteractive"
      defer
      data-domain={domain}
      data-api={`${host}/api/event`}
      src={`${host}/js/script.js`}
    />
  );
}
```

```typescript
// Custom-Events ohne PII
const trackPlausibleEvent = (name: string, props?: Record<string, string | number>) => {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (typeof w.plausible === 'function') {
    w.plausible(name, { props });
  }
};

// OK: trackPlausibleEvent('signup_clicked', { plan: 'pro' });
// NICHT OK: trackPlausibleEvent('user_login', { email: 'a@b.de' });  // PII-Verbot
```

## 4. AVV / DPA

- **DPA-Link**: https://plausible.io/dpa.pdf
- **GDPR-konform-Statement**: https://plausible.io/data-policy
- **Sub-Processors**: Hetzner (Hosting, DE), Mailgun EU (E-Mail-Versand für Reports)

## 5. DSE-Wording-Vorlage

> **Reichweitenmessung mit Plausible Analytics.** Wir nutzen Plausible
> Analytics (Anbieter: Plausible Insights OÜ, Tallinn, Estland) als
> Werkzeug zur anonymen Reichweitenmessung. Plausible setzt **keine
> Cookies** und speichert **keine personenbezogenen Daten** — IP-Adressen
> werden serverseitig nicht gespeichert, sondern über einen Hash anonym
> aggregiert. Die Daten verbleiben in der EU (Hetzner-Server in
> Deutschland). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
> Interesse an aggregierter Reichweitenmessung). Wegen der vollständigen
> Anonymisierung ist eine Einwilligung nach § 25 TDDDG **nicht
> erforderlich** (kein Speichern von Informationen in der Endeinrichtung).
> Datenschutz Plausible: https://plausible.io/privacy.

**Wichtig:** Diese Wording-Variante gilt nur bei Default-Plausible (cookieless + ohne Custom-Events mit PII). Bei Outbound-Link-Tracking + zusätzlichen Skript-Features erweitern.

## 6. Verify-Commands

```bash
# Cookies-Check (sollte KEINE plausible-Cookies setzen)
curl -s -c /tmp/cookies.txt https://<your-domain> > /dev/null
grep -i plausible /tmp/cookies.txt
# erwarte: kein Treffer

# Skript-Source
curl -s https://<your-domain> | grep -oE 'data-domain="[^"]+"'
# erwarte: deine Domain
```

## 7. Az.-Anker (Cookies allgemein, nicht plausible-spezifisch)

Keine spezifische Az. zu Plausible (zu jung). Allgemein: § 25 TDDDG-Befreiung gilt für Reichweitenmessung mit echter Anonymisierung — kommt aus EDPB Guidelines 2/2023 zur „Audience Measurement"-Ausnahme.

Source: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy_en
