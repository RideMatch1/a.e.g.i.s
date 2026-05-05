---
license: MIT (snippet)
provider: Vue 3 + Pinia (Open-Source)
last-checked: 2026-05-05
purpose: Pinia-Store fuer Consent-State + Tracker-Gate Pattern mit Subscriber-Watch.
---

# Vue/Pinia — Tracking-Store (Pattern)

## Trigger / Detection

Repo enthaelt:
- `pinia` in `package.json`
- `src/stores/*.ts` Pinia-Stores
- `defineStore('consent', ...)` oder vergleichbar
- Optional: `pinia-plugin-persistedstate` fuer localStorage-Sync

Pattern: zentraler Store fuer Consent + Tracker-Aktivierung. Komponenten subscriben statt direktem `useConsent`-Composable.

## Default-Verhalten (was passiert ohne Konfiguration)

- Pinia-State liegt im Memory → kein Persist ohne Plugin
- Tracker-SDKs in Components separat initialisiert → mehrfach-Init bei Re-Mount
- Persist-Plugin schreibt Consent-State, aber auch UI-State unkontrolliert in localStorage
- `$subscribe` lauscht auf alle Mutations → Tracker triggert bei UI-Klicks (FP)

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Tracker mehrfach initialisiert | Performance / DSGVO Daten-Min | MITTEL | Singleton-Init im Plugin |
| Persist-Plugin speichert PII unverschluesselt | Art. 32 DSGVO | HOCH | Whitelist `paths: ['consent']` |
| Subscriber feuert Tracker bei UI-State-Change | DSGVO Art. 5 lit. b Zweckbindung | HOCH | Watcher auf `consent.analytics` only |
| Missing Tracker-Teardown bei Widerruf | Art. 7 Abs. 3 DSGVO | HOCH | `$reset` + `unloadAnalytics()` |
| Drittland-Provider unverhandelt | Art. 44 DSGVO | KRITISCH | EU-Provider + AVV |

## Code-Pattern (sanitized)

```typescript
// File: src/stores/consent.ts
import { defineStore } from 'pinia';

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

export const useConsentStore = defineStore('consent', {
  state: (): Consent => ({ ...defaultConsent }),

  getters: {
    hasDecided: (s) => s.timestamp !== null,
  },

  actions: {
    grant(partial: Partial<Pick<Consent, 'analytics' | 'marketing'>>) {
      this.$patch({
        ...partial,
        timestamp: new Date().toISOString(),
      });
      // Server-side log fuer Nachweispflicht
      fetch('/api/consent-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.$state),
      });
    },
    revoke() {
      this.$reset();
      this.timestamp = new Date().toISOString();
      // Tracker-Teardown
      window.dispatchEvent(new CustomEvent('consent:revoked'));
    },
  },

  persist: {
    key: 'cookie-consent',
    paths: ['necessary', 'analytics', 'marketing', 'timestamp', 'version'],  // Whitelist!
  },
});
```

```typescript
// File: src/plugins/tracking.ts
import { useConsentStore } from '@/stores/consent';
import { watch } from 'vue';

let analyticsLoaded = false;

export function setupTrackingWatchers() {
  const store = useConsentStore();

  // Watcher feuert NUR bei aenderung von analytics-Flag
  watch(
    () => store.analytics,
    (next) => {
      if (next && !analyticsLoaded) {
        loadAnalytics();
        analyticsLoaded = true;
      }
      if (!next && analyticsLoaded) {
        unloadAnalytics();
        analyticsLoaded = false;
      }
    },
    { immediate: true }
  );
}

function loadAnalytics() {
  const s = document.createElement('script');
  s.src = 'https://<placeholder-eu-analytics-host>/script.js';
  s.async = true;
  s.dataset.domain = '<placeholder-domain>';
  document.head.appendChild(s);
  console.log('[tracking] analytics loaded');
}

function unloadAnalytics() {
  document.querySelectorAll('script[data-domain]').forEach(s => s.remove());
  // Cookies invalidieren
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0]?.trim();
    if (name?.startsWith('_pa_') || name?.startsWith('_ga')) {
      document.cookie = `${name}=; max-age=0; path=/`;
    }
  });
}
```

```typescript
// File: src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';
import { setupTrackingWatchers } from './plugins/tracking';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
app.use(pinia);
app.mount('#app');

// Tracking-Watchers nach Mount aufsetzen
setupTrackingWatchers();
```

## AVV / DPA

- Hosting-Provider — Art. 28 DSGVO
- Analytics-Provider (EU-Region) — AVV Pflicht
- pinia-plugin-persistedstate: schreibt nur in localStorage = kein AVV (Browser-Storage = First-Party)

## DSE-Wording-Vorlage

```markdown
### Speicherung Ihrer Consent-Entscheidung

Wir speichern Ihre Cookie-Einwilligung in Ihrem Browser-Speicher
(`localStorage`) unter dem Schluessel `cookie-consent`. Die Speicherung dient
ausschliesslich der Nachweispflicht (Art. 7 Abs. 1 DSGVO).

**Gespeicherte Daten:**
- Zeitstempel Ihrer Entscheidung
- Welche Cookie-Kategorien Sie aktiviert haben
- Version der Einwilligungs-Vereinbarung

Es findet keine Uebertragung an Dritte statt. Die Daten verbleiben in Ihrem
Browser. Sie koennen die Speicherung jederzeit ueber die Browser-Einstellungen
loeschen oder ueber den [Cookie-Einstellungen](#cookie-settings)-Link im Footer.
```

## Verify-Commands (Live-Probe)

```bash
# 1. localStorage-Key korrekt
echo "JS in DevTools:"
echo "  JSON.parse(localStorage.getItem('cookie-consent'))"
# Erwartung: { necessary: true, analytics: bool, marketing: bool, timestamp: ..., version: "1.0" }

# 2. Tracker-Script erst nach Accept
# DevTools-Network-Tab vor + nach Accept-Button-Click pruefen

# 3. Revoke-Action entfernt Tracker-Cookies
# DevTools: localStorage.removeItem('cookie-consent') + reload
# document.cookie sollte keine _pa_/_ga-Eintraege mehr enthalten

# 4. Pinia Persist nur whitelisted paths
# DevTools: localStorage.getItem('cookie-consent')
# Erwartung: nur consent-Felder, keine UI-State-Reste
```

## Cross-References

- AEGIS-Scanner: `state-leak-checker.ts`, `tracking-scan.ts`, `consent-flow-checker.ts`
- Skill-Reference: `references/dsgvo.md` § 25 TDDDG, Art. 7 (Nachweispflicht)
- BGH-Rechtsprechung: `references/bgh-urteile.md` BGH I ZR 7/16
- Audit-Pattern: `references/audit-patterns.md` Phase 2 (Cookie-Audit), Phase 4 (Widerrufs-Test)
