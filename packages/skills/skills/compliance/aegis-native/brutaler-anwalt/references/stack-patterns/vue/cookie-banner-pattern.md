---
license: MIT (snippet)
provider: Vue.js (Open-Source)
last-checked: 2026-05-05
purpose: Vue 3 Cookie-Banner Pattern mit Composition-API + useConsent Composable + Teleport.
---

# Vue — Cookie-Banner (Pattern)

## Trigger / Detection

Repo enthaelt:
- `vue` in `package.json` Dependencies (Version >= 3.x)
- `src/main.ts` mit `createApp(App).mount('#app')`
- `<script setup>`-Komponenten in `src/**/*.vue`
- Optional: `pinia` / `vuex` State-Management
- Optional: `vue-router` mit Navigation-Guards

## Default-Verhalten (was passiert ohne Konfiguration)

- SPA-Default: Banner-State im Memory → reload zeigt Banner erneut
- Tracker-SDKs in `main.ts` initialisiert vor Banner-Mount
- Reactive State leakt zwischen Visitors (bei SSR)
- `localStorage` Access vor Mount kann hydration-mismatch ausloesen (bei Nuxt)

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker in `main.ts` vor Consent | § 25 TDDDG | KRITISCH | Lazy-Init nach Consent-Event |
| LocalStorage-Read in `setup()` SSR | DSGVO Art. 25 | HOCH | `onMounted` + `useStorage` (VueUse) |
| Banner als Komponente ohne `<Teleport>` | A11y / DSGVO Klarheit | MITTEL | `<Teleport to="body">` fuer Modal-Style |
| Drittland-Tracker via CDN | Art. 44 DSGVO | KRITISCH | EU-Provider + AVV |
| Pre-Tick im Settings | EuGH C-673/17 | KRITISCH | Default `false` fuer Opt-In |

## Code-Pattern (sanitized)

```typescript
// File: src/composables/useConsent.ts
import { ref, computed, watch, readonly } from 'vue';

export type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
  version: '1.0';
};

const STORAGE_KEY = 'cookie-consent';

const defaultConsent: Consent = {
  necessary: true,
  analytics: false,
  marketing: false,
  version: '1.0',
};

const consent = ref<Consent>({ ...defaultConsent });
const hasDecided = ref(false);

function loadFromStorage() {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    consent.value = JSON.parse(raw);
    hasDecided.value = true;
  } catch {
    /* ignore malformed */
  }
}

function persist(next: Partial<Consent>) {
  consent.value = { ...consent.value, ...next, timestamp: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent.value));
  hasDecided.value = true;
  fetch('/api/consent-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consent.value),
  });
}

function reset() {
  localStorage.removeItem(STORAGE_KEY);
  consent.value = { ...defaultConsent };
  hasDecided.value = false;
}

export function useConsent() {
  return {
    consent: readonly(consent),
    hasDecided: readonly(hasDecided),
    loadFromStorage,
    persist,
    acceptAll: () => persist({ analytics: true, marketing: true }),
    rejectAll: () => persist({ analytics: false, marketing: false }),
    reset,
  };
}
```

```vue
<!-- File: src/components/CookieBanner.vue -->
<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useConsent } from '@/composables/useConsent';

const { consent, hasDecided, loadFromStorage, acceptAll, rejectAll, persist } = useConsent();

onMounted(() => {
  loadFromStorage();
});

const visible = computed(() => !hasDecided.value);
</script>

<template>
  <Teleport to="body">
    <aside
      v-if="visible"
      role="dialog"
      aria-label="Cookie-Einwilligung"
      class="cookie-banner"
    >
      <p>
        Wir nutzen Cookies fuer notwendige Funktionen.
        Mit Ihrer Einwilligung zusaetzlich fuer Webanalyse.
        Details:
        <RouterLink to="/datenschutz">Datenschutzerklaerung</RouterLink>.
      </p>
      <div class="cookie-actions">
        <!-- Buttons gleichwertig (OLG Koeln 6 U 80/23) -->
        <button @click="rejectAll" class="btn-secondary">Nur Notwendige</button>
        <button @click="acceptAll" class="btn-primary">Alle akzeptieren</button>
      </div>
    </aside>
  </Teleport>
</template>
```

```typescript
// File: src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);

// KEIN Tracker-Init hier — erst nach Consent-Event
window.addEventListener('consent:granted', (event: any) => {
  if (event.detail?.analytics) {
    import('./trackers/analytics').then(m => m.init());
  }
});

app.mount('#app');
```

## AVV / DPA

- Hosting (Vite-Build static / Nuxt SSR auf Vercel/Netlify) — Art. 28 DSGVO
- Optional Pinia-Persisted-Store-Provider (z.B. localStorage = kein AVV; backend-sync = AVV)
- Tracker-Provider (Plausible EU / Matomo Cloud EU / self-hosted Umami) — AVV
- Form-Backends (Formspree / FormBricks) — AVV bei Drittland: SCC + TIA

## DSE-Wording-Vorlage

```markdown
### Webanalyse (mit Einwilligung)

Sofern Sie Ihre Einwilligung erteilen, verwenden wir <placeholder-analytics-provider>
zur statistischen Auswertung der Webseiten-Nutzung. Verarbeitete Daten:
- Anonymisierte Besuchsdauer
- Referrer (ohne Query)
- Geraet-Typ (Desktop/Mobile)

**Anbieter:** <placeholder-analytics-provider>, Sitz <placeholder-eu-country>
**Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO i.V.m. § 25 Abs. 1 TDDDG
**Speicherdauer:** <placeholder-days> Tage
**Widerruf:** [Cookie-Einstellungen](#cookie-settings) im Footer
```

## Verify-Commands (Live-Probe)

```bash
# 1. Banner visible bei Erstbesuch
curl -sS https://<placeholder-domain>/ | grep -ic "cookie-banner\|cookie-einwilligung"

# 2. Tracker-Bundle nicht im initial-load
curl -sS https://<placeholder-domain>/ | grep -oE 'src="[^"]*\.js"' | grep -i "analytics\|tracker"
# Erwartung: leer oder nur lazy-chunk-Hashes

# 3. Playwright: Tracker-Request erst nach Accept
npx playwright test e2e/consent.spec.ts
```

## Cross-References

- AEGIS-Scanner: `cookie-audit.ts`, `consent-flow-checker.ts`, `tracking-scan.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 DSGVO
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- OLG-Rechtsprechung: OLG Koeln 6 U 80/23 (Button-Gleichwertigkeit)
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit)
