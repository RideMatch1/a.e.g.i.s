---
license: MIT (snippet)
provider: Nuxt 3 / Vue 3 (Open-Source)
last-checked: 2026-05-05
purpose: Nuxt 3 SSR vs Vue-only SPA Hydration-Pattern fuer DSGVO-konforme Tracker-Initialisierung.
---

# Nuxt vs Vue-only — Hydration-Pattern (Tracker-Lazy-Init)

## Trigger / Detection

Nuxt 3 Repo:
- `nuxt.config.ts` mit `ssr: true` (Default)
- `package.json` enthaelt `nuxt`
- `composables/`, `plugins/`, `server/` Top-Level Folders
- `useFetch`, `useState`, `useNuxtApp` in Components

Vue-only Repo:
- `vite.config.ts` + `vue` Dependency (kein nuxt)
- `index.html` als Entry mit `<div id="app">`
- `main.ts` mit `createApp`

Hydration-Issue: Nuxt rendered HTML serverseitig + hydratiert clientseitig. Tracker-Calls in `setup()` feuern auf BEIDEN Seiten = Daten doppelt + Tracker fuer NICHT-eingewilligte Users serverseitig geladen.

## Default-Verhalten (was passiert ohne Konfiguration)

Nuxt-Default:
- `setup()` laeuft auf Server UND Client → fetch-Aufrufe doppelt
- `process.client` / `import.meta.client` Check fehlt oft → SSR-Crash bei `localStorage`-Access
- Tracker im Default-Layout `app.vue` laed ueber `<Head>` → vor jeder Banner-Logik
- Cookies werden vom Server ausgelesen ohne Consent-Check

Vue-only:
- Kein SSR, daher kein Hydration-Problem, ABER kein SEO ohne Pre-Rendering
- Tracker in `main.ts` startet bevor Banner-Komponente mounted

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker in Nuxt-Layout `<Head>` | § 25 TDDDG | KRITISCH | `useHead` nur nach `consent:granted` Event |
| `localStorage` in `setup()` ohne Client-Check | DSGVO Art. 25 | HOCH | `if (import.meta.client)` Guard |
| Server-Side Cookie-Read ohne Consent | § 25 TDDDG | KRITISCH | `useCookie` mit Consent-Pruefung |
| Hydration-Mismatch zeigt Banner kurz | UX / Vertrauen | MITTEL | `v-if="mounted"` + `useState('mounted', () => false)` |
| Drittland-CDN fuer Vue-Vendor-Bundle | Art. 44 DSGVO | HOCH | Self-host Bundle, EU-CDN |

## Code-Pattern (sanitized)

### Nuxt 3 Pattern

```typescript
// File: plugins/consent.client.ts (Pflicht: .client.ts Suffix → nur Client)
import { defineNuxtPlugin } from '#app';

export default defineNuxtPlugin(() => {
  const STORAGE_KEY = 'cookie-consent';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const consent = JSON.parse(raw);
    if (consent.analytics) {
      // Lazy-Load Tracker-Modul erst hier
      import('~/utils/analytics').then(m => m.init());
    }
  } catch {
    /* ignore */
  }
});
```

```vue
<!-- File: components/CookieBanner.vue -->
<script setup lang="ts">
const mounted = useState('cookie-banner-mounted', () => false);
const visible = useState('cookie-banner-visible', () => false);

onMounted(() => {
  mounted.value = true;
  if (!localStorage.getItem('cookie-consent')) {
    visible.value = true;
  }
});

function persist(consent: { analytics: boolean; marketing: boolean }) {
  const final = { necessary: true, ...consent, version: '1.0', timestamp: new Date().toISOString() };
  localStorage.setItem('cookie-consent', JSON.stringify(final));
  visible.value = false;
  if (consent.analytics) import('~/utils/analytics').then(m => m.init());
}
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <aside v-if="mounted && visible" role="dialog" class="cookie-banner">
        <p>Cookie-Hinweis-Text. <NuxtLink to="/datenschutz">Datenschutz</NuxtLink></p>
        <button @click="persist({ analytics: false, marketing: false })">Nur Notwendige</button>
        <button @click="persist({ analytics: true, marketing: true })">Alle akzeptieren</button>
      </aside>
    </Teleport>
  </ClientOnly>
</template>
```

```typescript
// File: nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      // KEINE Tracker-Scripts hier — bleiben aussen
    },
  },
  routeRules: {
    '/api/track/**': { cors: false },  // Same-Origin enforced
  },
});
```

### Vue-only Pattern (kein SSR)

```typescript
// File: src/main.ts
import { createApp } from 'vue';
import App from './App.vue';

// KEIN Tracker-Init hier
const app = createApp(App);

window.addEventListener('consent:granted', async (e: any) => {
  if (e.detail?.analytics) {
    const m = await import('./trackers/analytics');
    m.init();
  }
});

app.mount('#app');
```

## AVV / DPA

Nuxt SSR + Vercel/Netlify Edge:
- SSR-Function-Region MUSS auf EU gepinnt sein (`vercel.json` `regions: ['fra1']`)
- AVV mit Hosting-Provider Pflicht
- Bei Nitro-Self-Host: keine zusaetzliche AVV, aber Hosting-AVV bleibt

Vue-only Static:
- Hosting-AVV
- Optional: Form-Service / Backend-API (separate AVV)

## DSE-Wording-Vorlage

```markdown
### Server-Side Rendering und Hosting

Diese Webseite verwendet Server-Side Rendering (SSR) bei Nuxt 3. Initiale
HTML-Generierung findet auf <placeholder-hosting-provider>-Servern in der
Region <placeholder-eu-region> statt.

**Verarbeitete Daten beim Initial-Render:**
- IP-Adresse (anonymisiert auf /24 in Server-Logs)
- User-Agent
- Sprach-Header (`Accept-Language`)
- Referrer (ohne Query-String)

**Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
sicherem Webseitenbetrieb).
**Speicherdauer Logs:** 14 Tage, danach Loeschung.
```

## Verify-Commands (Live-Probe)

```bash
# 1. SSR-HTML enthaelt KEINEN Tracker-Script
curl -sS https://<placeholder-domain>/ | grep -ic "<script[^>]*analytics\|gtag\|fbq"
# Erwartung: 0

# 2. Banner nicht im initial SSR-HTML (vermeidet Flash)
curl -sS https://<placeholder-domain>/ | grep -ic "cookie-banner"
# Erwartung: 0 (wird via ClientOnly nachgeladen)

# 3. Region-Check (Nuxt SSR Edge)
curl -sI https://<placeholder-domain>/ | grep -i "x-vercel-id\|server"
# Erwartung: fra1 / cdg1 / ams1 etc. (EU-Region)

# 4. Hydration ohne Mismatch
# Browser-Console: kein Vue-Warning "[Vue warn]: Hydration mismatch"
```

## Cross-References

- AEGIS-Scanner: `ssr-data-leak-checker.ts`, `tracking-scan.ts`, `region-pinning-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 44 (Drittland), § 25 TDDDG
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- EDPB: `references/eu-edpb-guidelines.md` (Schrems II Folgen)
- Audit-Pattern: `references/audit-patterns.md` Phase 3 (Drittland-Audit)
