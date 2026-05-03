---
license: MIT (snippet) / Vendor-Doc separat
provider: PostHog (PostHog Inc., USA — EU-Cloud verfuegbar)
provider-AVV-status: DPA verfuegbar + EU-Cloud-Region
last-checked: 2026-05-02
purpose: PostHog Consent + EU-Cloud-Region.
---

# PostHog — Consent + EU-Cloud

## 1. Default-Verhalten

- US-Cloud (default) ODER EU-Cloud (eu.posthog.com)
- Cookies: `ph_*`, `ph_phc_*`
- Self-Hosting moeglich (Open-Source)

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Default US-Cloud | Drittland | EU-Cloud (eu.posthog.com) waehlen |
| Auto-Capture aller Events | DSGVO-Datenminimierung | Selective Capture |
| Pre-Consent-Loading | § 25 TDDDG | ConsentGate |

## 3. Code-Pattern (Next.js)

```tsx
// File: src/components/analytics/PostHog.tsx
'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { useConsent } from '@/lib/consent';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com';  // EU

export default function PostHogProvider() {
  const { hasConsented } = useConsent();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (!hasConsented('analytics')) {
      posthog.opt_out_capturing();
      return;
    }

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      autocapture: false,  // Selective Capture (Datenminimierung)
      disable_session_recording: true,  // Privacy-friendly default
      mask_all_text: true,  // Mask Inputs by default
      person_profiles: 'identified_only',  // Nur eingeloggte User profilieren
    });
    posthog.opt_in_capturing();
  }, [hasConsented]);

  return null;
}
```

## 4. AVV / DPA

- **DPA-Link**: https://posthog.com/dpa
- **EU-Cloud**: eu.posthog.com (Frankfurt)

## 5. DSE-Wording-Vorlage

> Wir nutzen PostHog (PostHog Inc., 2261 Market St, San Francisco, USA — EU-Cloud Frankfurt)
> als Auftragsverarbeiter im Sinne von Art. 28 DSGVO. Datenstandort: EU. EU-SCC Modul 2.
> Datenschutzhinweise: https://posthog.com/privacy.

## 6. Verify

```bash
# EU-Cloud-Pruefung
curl -sI https://eu.posthog.com/decide | grep -i "X-Region"
```
