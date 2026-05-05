---
license: MIT (snippet)
provider: Svelte / SvelteKit (Open-Source)
last-checked: 2026-05-05
purpose: SvelteKit Cookie-Banner mit Stores fuer Consent-State + global +layout.svelte Mount.
---

# Svelte/SvelteKit — Cookie-Banner (Pattern)

## Trigger / Detection

Repo enthaelt:
- `svelte` und/oder `@sveltejs/kit` in `package.json`
- `svelte.config.js` mit Adapter-Config
- `src/routes/+layout.svelte` als globales Layout
- `src/lib/stores/*.ts` Svelte-Stores (`writable`/`readable`)
- Optional: `+layout.server.ts` fuer Server-Cookie-Read

## Default-Verhalten (was passiert ohne Konfiguration)

- SvelteKit SSR rendered initial HTML serverseitig → Banner-Logik die `localStorage` braucht muss `browser`-Guard nutzen
- Tracker-Imports im Top-Level `+layout.svelte` `<script>` werden gebundelt + im SSR-HTML referenziert
- Ohne `+layout.server.ts` sieht Server keinen Consent-Cookie → kann Tracker nicht filtern
- Stores haben kein Persist von Default → Reload zeigt Banner erneut

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker-Bundle in initial-load | § 25 TDDDG | KRITISCH | Dynamic-Import nach Consent |
| `localStorage`-Access ohne `browser`-Guard | SSR-Crash | HOCH | `import { browser } from '$app/environment'` |
| Banner doppelt gerendered (SSR + Hydration) | UX / DSGVO Klarheit | MITTEL | `{#if mounted}` Pattern |
| Cookie ohne `Secure; SameSite=Lax` | Art. 32 DSGVO | HOCH | `event.cookies.set(..., { secure, sameSite })` |
| Drittland-Adapter ohne EU-Region | Art. 44 DSGVO | KRITISCH | Adapter-Region konfigurieren |

## Code-Pattern (sanitized)

```typescript
// File: src/lib/stores/consent.ts
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string | null;
  version: '1.0';
};

const defaultConsent: Consent = {
  necessary: true,
  analytics: false,
  marketing: false,
  timestamp: null,
  version: '1.0',
};

function createConsentStore() {
  const initial: Consent = { ...defaultConsent };

  if (browser) {
    const stored = localStorage.getItem('cookie-consent');
    if (stored) {
      try {
        Object.assign(initial, JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }

  const { subscribe, set, update } = writable<Consent>(initial);

  return {
    subscribe,
    grant(partial: Partial<Pick<Consent, 'analytics' | 'marketing'>>) {
      update(c => {
        const next: Consent = {
          ...c,
          ...partial,
          timestamp: new Date().toISOString(),
        };
        if (browser) {
          localStorage.setItem('cookie-consent', JSON.stringify(next));
          fetch('/api/consent-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next),
          });
        }
        return next;
      });
    },
    revoke() {
      const reset: Consent = { ...defaultConsent, timestamp: new Date().toISOString() };
      if (browser) {
        localStorage.setItem('cookie-consent', JSON.stringify(reset));
      }
      set(reset);
    },
  };
}

export const consent = createConsentStore();
export const hasDecided = derived(consent, $c => $c.timestamp !== null);
```

```svelte
<!-- File: src/lib/components/CookieBanner.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { consent, hasDecided } from '$lib/stores/consent';
  import { browser } from '$app/environment';

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  function acceptAll() {
    consent.grant({ analytics: true, marketing: true });
  }

  function rejectAll() {
    consent.grant({ analytics: false, marketing: false });
  }
</script>

{#if mounted && !$hasDecided}
  <aside role="dialog" aria-label="Cookie-Einwilligung" class="cookie-banner">
    <p>
      Wir nutzen Cookies fuer notwendige Funktionen. Mit Ihrer Einwilligung
      zusaetzlich fuer Webanalyse. Details:
      <a href="/datenschutz">Datenschutzerklaerung</a>.
    </p>
    <div class="cookie-actions">
      <!-- Buttons gleichwertig (OLG Koeln 6 U 80/23) -->
      <button on:click={rejectAll} class="btn-secondary">Nur Notwendige</button>
      <button on:click={acceptAll} class="btn-primary">Alle akzeptieren</button>
    </div>
  </aside>
{/if}

<style>
  .cookie-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid #ccc;
    padding: 1rem;
    z-index: 9999;
  }
</style>
```

```svelte
<!-- File: src/routes/+layout.svelte -->
<script lang="ts">
  import CookieBanner from '$lib/components/CookieBanner.svelte';
  import { consent } from '$lib/stores/consent';
  import { browser } from '$app/environment';

  // Dynamic-Tracker-Load nach Consent-Aenderung
  if (browser) {
    consent.subscribe(async ($c) => {
      if ($c.analytics) {
        const m = await import('$lib/trackers/analytics');
        m.init();
      }
    });
  }
</script>

<slot />
<CookieBanner />
```

## AVV / DPA

- Hosting-Adapter (Vercel / Netlify / Node) — Art. 28 DSGVO
- Edge-Adapter Region MUSS auf EU gepinnt sein
- Analytics-Provider (EU) — AVV
- Form-Backends — separate AVV pro Service

## DSE-Wording-Vorlage

```markdown
### Cookie-Einwilligung (SvelteKit)

Diese Webseite verwendet einen Cookie-Banner zur Einholung Ihrer
Einwilligung gem. § 25 Abs. 1 TDDDG. Ihre Entscheidung wird im
Browser-Speicher (`localStorage`) gespeichert und zusaetzlich serverseitig
zur Nachweispflicht (Art. 7 Abs. 1 DSGVO) protokolliert.

**Server-Side-Log enthaelt:**
- Hash der IP-Adresse (SHA-256, gekuerzt)
- Zeitstempel
- Gewaehlte Kategorien
- User-Agent

**Speicherdauer Server-Log:** 6 Jahre (Beweisfunktion bei Rechtsstreit).
**Loeschung Browser-Storage:** ueber [Cookie-Einstellungen](#cookie-settings)
im Footer oder Browser-Einstellungen.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Banner sichtbar bei Erstbesuch
curl -sS https://<placeholder-domain>/ | grep -ic "cookie-banner"

# 2. Tracker-Bundle nicht im initial HTML
curl -sS https://<placeholder-domain>/ | grep -oE '<script[^>]*src="[^"]+"' | grep -i "analytics\|tracker"
# Erwartung: leer

# 3. SvelteKit-Region-Pinning
curl -sI https://<placeholder-domain>/ | grep -i "x-vercel-id"
# Erwartung: fra1 / cdg1 etc.

# 4. Hydration-Check (Browser DevTools-Console)
# Erwartung: kein "[svelte] hydration_mismatch" warning
```

## Cross-References

- AEGIS-Scanner: `cookie-audit.ts`, `tracking-scan.ts`, `consent-flow-checker.ts`, `ssr-data-leak-checker.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 DSGVO
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- OLG Koeln 6 U 80/23 (Button-Gleichwertigkeit)
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit)
