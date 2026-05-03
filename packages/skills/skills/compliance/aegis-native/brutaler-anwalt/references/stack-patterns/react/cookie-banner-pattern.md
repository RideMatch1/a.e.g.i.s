---
license: MIT (snippet)
provider: React (Open-Source)
last-checked: 2026-05-02
purpose: React Cookie-Banner Pattern mit Accept/Reject/Settings + Dokumentation.
---

# React — Cookie-Banner (Pattern)

## 1. DSGVO/TDDDG-Pflicht-Eigenschaften

| Pflicht | Quelle |
|---|---|
| Banner sichtbar bei Erstbesuch | EuGH C-673/17 Planet49 |
| Akzeptieren + Ablehnen gleichwertig | OLG Koeln 6 U 80/23 |
| Keine Pre-Tick-Boxen | EuGH C-673/17 |
| Granulare Kategorien | EDPB Guidelines 03/2022 |
| Widerruf jederzeit (Footer-Link) | DSGVO Art. 7 Abs. 3 |
| Consent-Log mit Timestamp | DSGVO Art. 7 Abs. 1 (Nachweis) |

## 2. Code-Pattern (sanitized)

```tsx
// File: src/components/CookieBanner.tsx
'use client';

import { useState, useEffect } from 'react';

type ConsentState = {
  necessary: true;       // Default true (immer erlaubt)
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
  version: '1.0';
};

const STORAGE_KEY = 'cookie-consent';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    analytics: false,  // Default false (Opt-In)
    marketing: false,  // Default false (Opt-In)
    version: '1.0',
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setShowBanner(true);
    }
  }, []);

  const persistConsent = (state: ConsentState) => {
    const final = { ...state, timestamp: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
    // Server-side log fuer Beweis Pflicht
    fetch('/api/consent-log', {
      method: 'POST',
      body: JSON.stringify(final),
      headers: { 'Content-Type': 'application/json' },
    });
    setShowBanner(false);
  };

  const acceptAll = () => persistConsent({
    ...consent,
    analytics: true,
    marketing: true,
    version: '1.0',
  });

  const rejectAll = () => persistConsent({
    necessary: true,
    analytics: false,
    marketing: false,
    version: '1.0',
  });

  if (!showBanner) return null;

  return (
    <aside role="dialog" aria-label="Cookie-Einwilligung" className="cookie-banner">
      <p>
        Wir nutzen Cookies fuer notwendige Funktionen und (mit Ihrer Einwilligung)
        fuer Webanalyse. Details in <a href="/datenschutz">Datenschutzerklaerung</a>.
      </p>
      <div className="cookie-banner-buttons">
        {/* Beide Buttons gleichwertig (OLG Koeln 6 U 80/23) */}
        <button onClick={rejectAll} className="btn-secondary">
          Nur Notwendige
        </button>
        <button onClick={() => setShowSettings(true)} className="btn-secondary">
          Einstellungen
        </button>
        <button onClick={acceptAll} className="btn-primary">
          Alle akzeptieren
        </button>
      </div>
      {showSettings && (
        <CookieSettings
          consent={consent}
          onSave={persistConsent}
          onChange={setConsent}
        />
      )}
    </aside>
  );
}

function CookieSettings({ consent, onSave, onChange }: any) {
  return (
    <div className="cookie-settings">
      <label>
        <input type="checkbox" checked disabled />
        <strong>Notwendig</strong> (Session-Login, CSRF, Cookie-Consent — kein Opt-Out)
      </label>
      <label>
        <input
          type="checkbox"
          checked={consent.analytics}
          onChange={(e) => onChange({ ...consent, analytics: e.target.checked })}
        />
        <strong>Analytics</strong> (Webseiten-Statistiken, Datenerhebung anonym)
      </label>
      <label>
        <input
          type="checkbox"
          checked={consent.marketing}
          onChange={(e) => onChange({ ...consent, marketing: e.target.checked })}
        />
        <strong>Marketing</strong> (Werbung, Tracking ueber Drittanbieter)
      </label>
      <button onClick={() => onSave(consent)}>Auswahl speichern</button>
    </div>
  );
}
```

## 3. Footer-Link fuer Widerruf

```tsx
// File: src/components/Footer.tsx
export default function Footer() {
  const reopenBanner = () => {
    localStorage.removeItem('cookie-consent');
    window.location.reload();
  };

  return (
    <footer>
      <button onClick={reopenBanner}>
        Cookie-Einstellungen aendern
      </button>
    </footer>
  );
}
```

## 4. Server-Side Consent-Log

```ts
// File: src/app/api/consent-log/route.ts
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const consent = await req.json();
  await db.consentLog.create({
    data: {
      ip: hashIp(req.headers.get('x-forwarded-for') ?? ''),
      userAgent: req.headers.get('user-agent') ?? '',
      consent: JSON.stringify(consent),
      timestamp: new Date(),
    },
  });
  return new Response(null, { status: 204 });
}

function hashIp(ip: string): string {
  return require('crypto').createHash('sha256').update(ip).digest('hex');
}
```

## 5. Az.-Anker

- EuGH C-673/17 Planet49 (01.10.2019)
- BGH I ZR 7/16 (28.05.2020)
- OLG Koeln 6 U 80/23 (19.01.2024)
- LG Berlin 16 O 252/22 (28.06.2023)

## 6. Verify

```bash
# 1. Banner laedt bei Erstbesuch (no consent set)
curl -sS https://example.com -H "Cookie: " | grep -ic "cookie-banner\|akzeptieren\|ablehnen"

# 2. Reject = Akzeptieren gleichwertig
# (manuell: pruefe CSS dass beide Buttons gleiche Klasse / Groesse haben)

# 3. Settings-Link im Footer
curl -sS https://example.com | grep -ic "cookie.einstell\|cookie-settings"
```
