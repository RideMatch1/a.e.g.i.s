---
license: MIT (snippet)
provider: Astro (Open-Source)
last-checked: 2026-05-05
purpose: Astro Cookie-Banner Pattern mit View-Transitions + Island-Hydration + client-seitiger Consent-Init.
---

# Astro — Cookie-Banner (Pattern)

## Trigger / Detection

Repo enthaelt:
- `astro.config.mjs` / `astro.config.ts` mit `integrations: [...]`
- `src/layouts/*.astro` Layout-Komponenten
- `client:load` / `client:idle` / `client:visible` Direktiven in `.astro` Files
- `<ClientRouter />` (View-Transitions) in Layout
- Optional: `@astrojs/react` / `@astrojs/vue` / `@astrojs/svelte` integration

Astro ist Static-First, das heisst Cookie-Banner muss als Island laufen (`client:load`) — sonst wird er statisch gepre-rendered und JavaScript-Logik feuert nicht.

## Default-Verhalten (was passiert ohne Konfiguration)

- Astro pre-rendered `.astro` Files zu HTML — Banner-State (zeigen/nicht zeigen) ist NICHT pro Visitor differenziert
- Ohne `client:*`-Direktive feuert kein JS, also liest Banner kein localStorage
- Mit View-Transitions-Router muss Banner `transition:persist` haben sonst remount bei jeder Navigation
- Tracker-Scripts (Plausible, Umami, Google Analytics) werden via `<script>` in Layout typischerweise SOFORT geladen — vor jeder Consent-Pruefung

Resultat ohne Anpassung: Tracker laeuft trotz fehlendem Consent. § 25 TDDDG-Verstoss.

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker laedt vor Consent (Astro `<script>` im Head) | § 25 TDDDG | KRITISCH | Tracker als Island mit `client:idle` + Consent-Gate |
| Banner remountet pro View-Transition | DSGVO Art. 7 (Nachweisbarkeit) | MITTEL | `transition:persist` setzen |
| Static-Build cached Banner-State | DSGVO Art. 25 | HOCH | Banner ausschliesslich via `client:load` initialisieren |
| Drittland-Transfer durch CDN-Tracker | Art. 44-46 DSGVO | KRITISCH | EU-Region-Provider + AVV + TIA |
| Pre-Tick im Settings-Modal | EuGH C-673/17 Planet49 | KRITISCH | Default = false fuer alle Nicht-Notwendigen |

## Code-Pattern (sanitized)

```astro
---
// File: src/layouts/BaseLayout.astro
import CookieBanner from '../components/CookieBanner.tsx';
import { ClientRouter } from 'astro:transitions';
---
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <title><slot name="title">{Astro.props.title ?? '<placeholder-site-name>'}</slot></title>
    <ClientRouter />
    {/* KEIN Tracker-Script hier — erst nach Consent via Island */}
  </head>
  <body>
    <slot />
    {/* transition:persist verhindert Remount bei View-Transitions */}
    <CookieBanner client:load transition:persist="cookie-banner" />
  </body>
</html>
```

```tsx
// File: src/components/CookieBanner.tsx (React-Island)
import { useEffect, useState } from 'react';

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
  version: '1.0';
};

const STORAGE_KEY = 'cookie-consent';

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState<Consent>({
    necessary: true,
    analytics: false,  // Default false — Opt-In Pflicht
    marketing: false,
    version: '1.0',
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setOpen(true);
    else {
      const parsed = JSON.parse(stored) as Consent;
      if (parsed.analytics) loadAnalytics();
      if (parsed.marketing) loadMarketing();
    }
  }, []);

  const persist = (c: Consent) => {
    const final = { ...c, timestamp: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
    fetch('/api/consent-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(final),
    });
    if (final.analytics) loadAnalytics();
    if (final.marketing) loadMarketing();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <aside role="dialog" aria-label="Cookie-Einwilligung" className="cookie-banner">
      <p>
        Wir verwenden Cookies fuer notwendige Funktionen. Mit Ihrer Einwilligung
        zusaetzlich fuer Analyse und Marketing. Details:{' '}
        <a href="/datenschutz">Datenschutzerklaerung</a>.
      </p>
      <div className="cookie-actions">
        {/* Buttons gleichwertig (OLG Koeln 6 U 80/23) */}
        <button onClick={() => persist({ ...consent, analytics: false, marketing: false })}>
          Nur Notwendige
        </button>
        <button onClick={() => persist({ ...consent, analytics: true, marketing: true })}>
          Alle akzeptieren
        </button>
      </div>
    </aside>
  );
}

function loadAnalytics() {
  const s = document.createElement('script');
  s.src = 'https://<placeholder-eu-analytics-host>/script.js';
  s.defer = true;
  document.head.appendChild(s);
}

function loadMarketing() {
  // Lade Marketing-Pixel erst nach Consent
}
```

## AVV / DPA

Pflicht-AVV-Partner bei Default-Astro-Stack:
- Hosting-Provider (Netlify / Vercel / Self-host) — Art. 28 DSGVO
- CDN (Cloudflare / Bunny.net) — bei Drittland: SCC + TIA
- Analytics-Provider (Plausible EU / Umami self-hosted) — AVV bei Plausible.io B.V.
- Optional: Image-CDN (Cloudinary / imgix) bei `<Image>` Component

Pflicht-Dokumentation: `/datenschutz` Section "Auftragsverarbeiter" mit Tabelle (Anbieter, Sitz, Zweck, Rechtsgrundlage).

## DSE-Wording-Vorlage

```markdown
### Cookies und vergleichbare Technologien

Diese Website nutzt Cookies und browserseitigen Speicher (`localStorage`) fuer
folgende Zwecke:

**Notwendige Cookies (Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG)**
- `cookie-consent` — speichert Ihre Einwilligungs-Entscheidung
  (Speicherdauer: 12 Monate, kein Tracking)
- Session-Cookie fuer Login (falls vorhanden)

**Analyse-Cookies (Rechtsgrundlage: § 25 Abs. 1 TDDDG i.V.m. Art. 6 Abs. 1
lit. a DSGVO — Einwilligung)**
- `<placeholder-analytics-cookie>` — Webseiten-Statistiken
- Anbieter: <placeholder-analytics-provider>, EU-Hosting
- Speicherdauer: <placeholder-days> Tage

**Widerruf:** Sie koennen Ihre Einwilligung jederzeit widerrufen ueber
[Cookie-Einstellungen](#cookie-settings) im Footer.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Pre-Consent: kein Tracker-Script geladen
curl -sS https://<placeholder-domain>/ | grep -ic "<placeholder-analytics-host>" 
# Erwartung: 0

# 2. Banner sichtbar fuer neue Visitors
curl -sS https://<placeholder-domain>/ | grep -ic "cookie-banner\|cookie-einwilligung"
# Erwartung: >=1

# 3. Playwright: Tracker erst nach Accept
npx playwright codegen https://<placeholder-domain>/
# Manuelle Pruefung: Network-Tab vor + nach Accept

# 4. View-Transition-persist
# Navigiere ueber 3 Pages mit aktivem Banner — Banner darf nicht doppelt rendern
```

## Cross-References

- AEGIS-Scanner: `cookie-audit.ts`, `tracking-scan.ts`, `consent-flow-checker.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 DSGVO
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16 (Planet49-Folgeentscheidung)
- EuGH: `references/eu-eugh-dsgvo-schadensersatz.md` C-673/17 Planet49
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit)
