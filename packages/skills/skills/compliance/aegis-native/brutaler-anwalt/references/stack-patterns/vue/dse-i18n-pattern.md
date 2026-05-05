---
license: MIT (snippet)
provider: Nuxt 3 + @nuxtjs/i18n (Open-Source)
last-checked: 2026-05-05
purpose: Nuxt-i18n DSE-Pattern fuer mehrsprachige Datenschutzerklaerung mit Locale-Routing.
---

# Nuxt-i18n — DSE-Pattern (mehrsprachig)

## Trigger / Detection

Repo enthaelt:
- `@nuxtjs/i18n` in Dependencies
- `nuxt.config.ts` mit `modules: ['@nuxtjs/i18n']`
- `i18n/locales/*.json` oder `i18n/locales/*.ts` Locale-Files
- `useI18n` / `$t` in Components
- Routes wie `/de/datenschutz`, `/en/privacy`

Pattern: DSE existiert in mehreren Sprachen — DE-Version ist rechtlich-verbindlich, EN-Version erklaerend. Locale-Detection bestimmt Default-View, Banner-Text und DSE-Inhalt.

## Default-Verhalten (was passiert ohne Konfiguration)

- Default-Locale-Detection via `Accept-Language`-Header → kann Drittland-IP triggern
- Cookie `i18n_redirected` gesetzt ohne § 25 TDDDG-Check
- DSE-Versionen koennen drift (DE updated, EN nicht)
- Cookie-Banner-Text aus EN-Locale falls IP nicht-DE → User versteht Banner nicht
- Fehlende `hreflang`-Tags → SEO + Transparenz

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| `i18n_redirected`-Cookie ohne Consent | § 25 TDDDG | HOCH | als notwendiger Cookie deklarieren oder als Session entfernen |
| DSE-Versionen drift zwischen Sprachen | Art. 12 DSGVO Klarheit | KRITISCH | CI-Check `last-updated` synchron |
| Banner-Text in falscher Sprache | EuGH C-673/17 (Klarheit) | HOCH | DE-Default fuer DE-Visitors via IP-Geolocation |
| Locale-Detection mit IP-Geo | Art. 6 Abs. 1 DSGVO | MITTEL | nur Accept-Language, kein IP-Lookup |
| Fehlende `hreflang`-Tags | SEO / DSGVO Transparenz | NIEDRIG | `<link hreflang="de">` setzen |

## Code-Pattern (sanitized)

```typescript
// File: nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'de',
    locales: [
      { code: 'de', iso: 'de-DE', file: 'de.json', name: 'Deutsch' },
      { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' },
    ],
    strategy: 'prefix_except_default',  // / = de, /en = en
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      cookieSecure: true,
      cookieCrossOrigin: false,
      redirectOn: 'root',
      // KEIN IP-Geo-Lookup
    },
  },
});
```

```json
// File: i18n/locales/de.json (Auszug)
{
  "cookie": {
    "title": "Cookie-Einwilligung",
    "intro": "Wir nutzen Cookies fuer notwendige Funktionen. Mit Ihrer Einwilligung zusaetzlich fuer Webanalyse.",
    "moreInfo": "Details in der",
    "privacyLink": "Datenschutzerklaerung",
    "rejectAll": "Nur Notwendige",
    "acceptAll": "Alle akzeptieren",
    "settings": "Einstellungen"
  },
  "privacy": {
    "title": "Datenschutzerklaerung",
    "lastUpdated": "Stand: {date}",
    "version": "Version {version}"
  }
}
```

```json
// File: i18n/locales/en.json (Auszug — informational, NICHT rechtsverbindlich)
{
  "cookie": {
    "title": "Cookie Consent",
    "intro": "We use cookies for essential functions. With your consent additionally for analytics.",
    "moreInfo": "Details in our",
    "privacyLink": "Privacy Policy",
    "rejectAll": "Only Essential",
    "acceptAll": "Accept All",
    "settings": "Settings"
  },
  "privacy": {
    "title": "Privacy Policy",
    "lastUpdated": "Last updated: {date}",
    "version": "Version {version}",
    "legalNote": "This is a translation. The German version is legally binding."
  }
}
```

```vue
<!-- File: pages/datenschutz.vue / pages/privacy.vue -->
<script setup lang="ts">
const { locale, t } = useI18n();
const localePath = useLocalePath();

useHead(() => ({
  htmlAttrs: { lang: locale.value },
  title: t('privacy.title'),
  link: [
    { rel: 'alternate', hreflang: 'de', href: '<placeholder-domain>/datenschutz' },
    { rel: 'alternate', hreflang: 'en', href: '<placeholder-domain>/en/privacy' },
    { rel: 'alternate', hreflang: 'x-default', href: '<placeholder-domain>/datenschutz' },
  ],
}));

// Last-updated wird aus Frontmatter eines lokalen Content-Files gelesen
const { data: legal } = await useAsyncData('privacy', () =>
  queryContent(`/legal/${locale.value}/privacy`).findOne()
);
</script>

<template>
  <article class="legal">
    <header>
      <h1>{{ t('privacy.title') }}</h1>
      <p class="meta">
        {{ t('privacy.lastUpdated', { date: legal?.lastUpdated }) }}
        — {{ t('privacy.version', { version: legal?.version }) }}
      </p>
      <p v-if="locale !== 'de'" class="legal-note">
        <strong>{{ t('privacy.legalNote') }}</strong>
        <RouterLink :to="localePath('/datenschutz', 'de')">DE</RouterLink>
      </p>
    </header>
    <ContentDoc :path="`/legal/${locale}/privacy`" />
  </article>
</template>
```

## AVV / DPA

- Hosting-Provider mit EU-SSR-Region — Art. 28 DSGVO
- Cookie `i18n_redirected` = First-Party, kein AVV
- Translation-Service (falls extern, z.B. DeepL Pro) — AVV erforderlich
- Content-Lieferant fuer DSE-Texte (Anwalt/Lawyer) — Werkvertrag, kein AVV (kein Daten-Verarbeiter)

## DSE-Wording-Vorlage

```markdown
### Sprachversionen

Diese Datenschutzerklaerung ist in mehreren Sprachversionen verfuegbar.
Rechtsverbindlich ist ausschliesslich die **deutsche Version**. Andere
Sprachversionen dienen lediglich dem Verstaendnis.

**Verfuegbare Sprachen:**
- Deutsch (verbindlich): `<placeholder-domain>/datenschutz`
- English (informational): `<placeholder-domain>/en/privacy`

### Sprach-Praeferenz-Cookie

Wir setzen einen Cookie `i18n_redirected` zur Speicherung Ihrer
Sprach-Praeferenz. Dieser Cookie ist technisch notwendig (Art. 6 Abs. 1
lit. f DSGVO i.V.m. § 25 Abs. 2 Nr. 2 TDDDG) und erfordert keine
Einwilligung.

**Speicherdauer:** 365 Tage. **Inhalt:** ausschliesslich der gewaehlte
Locale-Code (z.B. `de` oder `en`).
```

## Verify-Commands (Live-Probe)

```bash
# 1. hreflang-Tags vorhanden
curl -sS https://<placeholder-domain>/datenschutz | grep -oE 'hreflang="[^"]+"' | sort -u
# Erwartung: hreflang="de", hreflang="en", hreflang="x-default"

# 2. lang-Attribut korrekt pro Locale
curl -sS https://<placeholder-domain>/datenschutz | grep -oE 'lang="[a-z]+"' | head -1
# Erwartung: lang="de"
curl -sS https://<placeholder-domain>/en/privacy | grep -oE 'lang="[a-z]+"' | head -1
# Erwartung: lang="en"

# 3. last-updated synchron zwischen Locales (CI-Check)
DE_DATE=$(grep -oE 'lastUpdated: [0-9-]+' content/legal/de/privacy.md | head -1)
EN_DATE=$(grep -oE 'lastUpdated: [0-9-]+' content/legal/en/privacy.md | head -1)
[ "$DE_DATE" = "$EN_DATE" ] && echo "OK" || echo "DRIFT: DE=$DE_DATE EN=$EN_DATE"

# 4. legalNote in EN-Version sichtbar
curl -sS https://<placeholder-domain>/en/privacy | grep -ic "legally binding\|german version"
# Erwartung: >=1
```

## Cross-References

- AEGIS-Scanner: `i18n-drift-checker.ts`, `dse-completeness-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 12 (Klarheit), Art. 13 (Informationspflichten)
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- Audit-Pattern: `references/audit-patterns.md` Phase 1 (DSE-Vollstaendigkeit), Phase 5 (Multi-Locale-Drift)
