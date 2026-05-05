---
license: MIT (snippet)
provider: SvelteKit + mdsvex (Open-Source)
last-checked: 2026-05-05
purpose: SvelteKit DSE-Pattern mit mdsvex-Markdown + Frontmatter-Versionierung.
---

# SvelteKit — DSE-Section Pattern (mdsvex)

## Trigger / Detection

Repo enthaelt:
- `mdsvex` oder `@sveltejs/enhanced-img` in Dependencies
- `svelte.config.js` mit `extensions: ['.svelte', '.md']`
- `src/content/legal/*.md` oder `src/routes/**/+page.md` mit Frontmatter
- Routes wie `/datenschutz`, `/impressum`, `/agb`

## Default-Verhalten (was passiert ohne Konfiguration)

- DSE in `+page.svelte` inline → kein Frontmatter, keine Versionierung
- Kein zentrales Auftragsverarbeiter-Register → DSE-Drift gegenueber Realitaet
- `last-updated` fehlt → User kann Aktualitaet nicht beurteilen
- Anchor-Links auf Sub-Sektionen funktionieren nicht (keine auto-IDs)
- DSE-Header-Level inkonsistent zwischen Pages

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| DSE outdated (kein Datum) | Art. 13 DSGVO | HOCH | Frontmatter `lastUpdated` rendern |
| Auftragsverarbeiter-Section fehlt | Art. 28 DSGVO | KRITISCH | Pflicht-Tabelle in DSE |
| Missing Loeschungs-Hinweis | Art. 17 DSGVO | HOCH | Section "Ihre Rechte" Pflicht |
| Sprache nicht deklariert | BITV 2.0 | MITTEL | `<html lang="de">` + `lang`-Attribut |
| Heading-Hierarchie kaputt (h1 dann h3) | A11y / Klarheit | MITTEL | mdsvex `rehype-slug` + lint |

## Code-Pattern (sanitized)

```javascript
// File: svelte.config.js
import adapter from '@sveltejs/adapter-vercel';
import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const config = {
  extensions: ['.svelte', '.md'],
  preprocess: [
    mdsvex({
      extensions: ['.md'],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'wrap' }],
      ],
      layout: {
        legal: 'src/lib/layouts/Legal.svelte',
      },
    }),
  ],
  kit: {
    adapter: adapter({ regions: ['fra1'] }),
  },
};

export default config;
```

```markdown
<!-- File: src/routes/datenschutz/+page.md -->
---
title: Datenschutzerklaerung
layout: legal
lastUpdated: 2026-05-05
version: "2.3"
section: datenschutz
author: "<placeholder-legal-counsel>"
---

# Datenschutzerklaerung

## 1. Verantwortliche Stelle

<placeholder-company-name>
<placeholder-street>
<placeholder-postal-code> <placeholder-city>

E-Mail: <placeholder-email>

## 2. Erhobene Daten und Zwecke

| Datum | Zweck | Rechtsgrundlage | Speicherdauer |
|---|---|---|---|
| Server-Logs (Hash) | Sicherheit | Art. 6 Abs. 1 lit. f | 14 Tage |
| Cookie-Consent | Nachweis | Art. 7 DSGVO | 12 Monate |
| Analytics (Opt-In) | Optimierung | Art. 6 Abs. 1 lit. a | <placeholder-days> Tage |

## 3. Auftragsverarbeiter

| Anbieter | Sitz | Zweck | Drittland | AVV |
|---|---|---|---|---|
| <placeholder-hosting-provider> | <placeholder-eu-country> | Hosting | Nein | Ja |
| <placeholder-analytics-provider> | <placeholder-eu-country> | Webanalyse | Nein | Ja |
| <placeholder-error-tracking-provider> | <placeholder-eu-country> | Error-Tracking | Nein | Ja |

## 4. Cookies und vergleichbare Technologien

Siehe [Cookie-Einstellungen](#cookie-settings) — Sie koennen Ihre Einwilligung
jederzeit widerrufen.

## 5. Ihre Rechte

Sie haben gegen uns folgende Rechte:
- Auskunft (Art. 15 DSGVO)
- Berichtigung (Art. 16 DSGVO)
- Loeschung (Art. 17 DSGVO)
- Einschraenkung (Art. 18 DSGVO)
- Datenuebertragbarkeit (Art. 20 DSGVO)
- Widerspruch (Art. 21 DSGVO)
- Beschwerde bei Aufsichtsbehoerde (Art. 77 DSGVO)

Kontakt: <placeholder-email>

## 6. Aenderungen

Die jeweils aktuelle Version dieser Datenschutzerklaerung ist unter dieser
URL abrufbar. aenderungen werden mit aktualisiertem `Stand`-Datum publiziert.
```

```svelte
<!-- File: src/lib/layouts/Legal.svelte -->
<script lang="ts">
  export let title: string;
  export let lastUpdated: string;
  export let version: string;
  export let section: string;

  const formattedDate = new Date(lastUpdated).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="robots" content="index,follow" />
</svelte:head>

<article class="legal" lang="de" data-section={section}>
  <header>
    <h1>{title}</h1>
    <p class="meta">
      Version {version} —
      Stand: <time datetime={lastUpdated}>{formattedDate}</time>
    </p>
  </header>

  <slot />

  <footer class="legal-footer">
    <p>
      Bei Fragen zur Verarbeitung wenden Sie sich an:
      <a href="mailto:<placeholder-email>"><placeholder-email></a>
    </p>
  </footer>
</article>

<style>
  .legal { max-width: 65ch; margin: 0 auto; padding: 2rem 1rem; }
  .meta { color: #666; font-size: 0.9rem; }
  .legal-footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #ddd; }
</style>
```

## AVV / DPA

DSE selbst keine AVV. Aber:
- Hosting-Provider liefert DSE → AVV
- DSE listet ALLE anderen Auftragsverarbeiter (siehe Tabelle in Section 3)
- Bei Aenderungen am Tech-Stack MUSS DSE versioniert werden (Frontmatter `version` bumpen)

## DSE-Wording-Vorlage

```markdown
### Versionierung dieser Datenschutzerklaerung

Diese Datenschutzerklaerung wird kontinuierlich gepflegt. Aktuelle Version:
**2.3** vom **5. Mai 2026**.

**Aenderungs-Historie verfuegbar via:**
- Git-Repository: <placeholder-repo-url>/commits/main/src/routes/datenschutz
- Tags fuer Major-Versionen: `legal-v2.0`, `legal-v2.3`

**Bei wesentlichen Aenderungen** (neue Datenkategorien, neue
Auftragsverarbeiter, geaenderte Speicherdauern) informieren wir Sie
zusaetzlich per E-Mail (sofern Sie Newsletter abonniert haben) oder via
Banner-Hinweis bei naechstem Webseitenbesuch.
```

## Verify-Commands (Live-Probe)

```bash
# 1. DSE erreichbar
curl -sI https://<placeholder-domain>/datenschutz | head -1
# Erwartung: HTTP/2 200

# 2. Frontmatter-Daten gerendered
curl -sS https://<placeholder-domain>/datenschutz | grep -ic "stand:\|version"

# 3. Auftragsverarbeiter-Tabelle vorhanden
curl -sS https://<placeholder-domain>/datenschutz | grep -ic "auftragsverarbeit\|hosting\|analytics"

# 4. Anker-Links generiert
curl -sS https://<placeholder-domain>/datenschutz | grep -oE 'id="[^"]+"' | head -10
# Erwartung: id="verantwortliche-stelle", id="ihre-rechte", etc.

# 5. lang-Attribut
curl -sS https://<placeholder-domain>/datenschutz | grep -oE 'lang="[a-z]+"' | head -1
# Erwartung: lang="de"

# 6. Heading-Hierarchie ohne Sprung
curl -sS https://<placeholder-domain>/datenschutz | grep -oE '<h[1-6]' | sort -u
# Erwartung: <h1, <h2, <h3 — kein Skip
```

## Cross-References

- AEGIS-Scanner: `dse-completeness-checker.ts`, `legal-pages-checker.ts`, `heading-hierarchy-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 13, 14, 28
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- DSK-Beschluesse: `references/de-dsk-beschluesse.md` (Auftragsverarbeitung)
- Audit-Pattern: `references/audit-patterns.md` Phase 1 (DSE-Vollstaendigkeit)
