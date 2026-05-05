---
license: MIT (snippet)
provider: Astro (Open-Source)
last-checked: 2026-05-05
purpose: Astro Static-MD/MDX Datenschutzerklaerung-Rendering-Pattern mit Content-Collections.
---

# Astro — DSE-Section Pattern (MD/MDX)

## Trigger / Detection

Repo enthaelt:
- `src/content/legal/*.md` oder `*.mdx` Files
- `astro:content` Collections-API in `src/content/config.ts`
- Routes wie `/datenschutz`, `/impressum`, `/agb` als statische Pages
- Optional: `@astrojs/mdx` integration in `astro.config.mjs`

Pattern: DSE wird als Markdown geschrieben (versionierbar, diff-bar, durch Lawyer reviewbar) und via Astro Content-Collections gerendert. Static-Build = max. Performance, kein Server-Roundtrip.

## Default-Verhalten (was passiert ohne Konfiguration)

- DSE-Inhalte oft inline in `.astro` Page-File → Versions-Diff schwer
- Keine `last-updated` Metadaten → Drift zur Realitaet nicht erkennbar
- Keine Anker-Links zu Sub-Sektionen → Footer-Links auf "#cookies" funktionieren nicht
- DSE wird statisch gepre-rendered ohne `lang`-Attribut → Screen-Reader Probleme

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| DSE outdated (kein Datum sichtbar) | Art. 13 DSGVO Transparenz | HOCH | Frontmatter `last-updated` rendern |
| Auftragsverarbeiter-Liste fehlt | Art. 28 DSGVO | HOCH | DSE-Section "Auftragsverarbeiter" Pflicht |
| Ankerlinks defekt | Art. 12 DSGVO Klarheit | MITTEL | Auto-generierte Heading-IDs |
| Sprache nicht ausgewiesen | BITV 2.0 Barrierefreiheit | MITTEL | `<html lang="de">` Pflicht |
| Versions-Historie fehlt | Art. 5 Abs. 2 Rechenschaft | MITTEL | Git-blame als Audit-Trail + DSE-Changelog |

## Code-Pattern (sanitized)

```typescript
// File: src/content/config.ts
import { defineCollection, z } from 'astro:content';

const legal = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    section: z.enum(['datenschutz', 'impressum', 'agb', 'widerrufsbelehrung']),
    lastUpdated: z.coerce.date(),
    version: z.string(),
    author: z.string(),  // z.B. "<placeholder-legal-counsel>"
  }),
});

export const collections = { legal };
```

```markdown
<!-- File: src/content/legal/datenschutz.md -->
---
title: Datenschutzerklaerung
section: datenschutz
lastUpdated: 2026-05-05
version: "2.3"
author: "<placeholder-legal-counsel>"
---

## 1. Verantwortliche Stelle

<placeholder-company-name>
<placeholder-street>
<placeholder-postal-code> <placeholder-city>
E-Mail: <placeholder-email>

## 2. Erhobene Daten und Zwecke

| Datum | Zweck | Rechtsgrundlage | Speicherdauer |
|---|---|---|---|
| Server-Logs (anonymisiert) | Sicherheit, Stabilitaet | Art. 6 Abs. 1 lit. f | 14 Tage |
| Cookie-Consent | Nachweis Einwilligung | Art. 7 DSGVO | 12 Monate |
| Analytics (mit Consent) | Webseiten-Optimierung | Art. 6 Abs. 1 lit. a | <placeholder-days> Tage |

## 3. Auftragsverarbeiter

| Anbieter | Sitz | Zweck | AVV |
|---|---|---|---|
| <placeholder-hosting-provider> | <placeholder-eu-country> | Hosting | Ja |
| <placeholder-analytics-provider> | <placeholder-eu-country> | Webanalyse | Ja |

## 4. Ihre Rechte

Sie haben das Recht auf:
- Auskunft (Art. 15 DSGVO)
- Berichtigung (Art. 16 DSGVO)
- Loeschung (Art. 17 DSGVO)
- Einschraenkung (Art. 18 DSGVO)
- Datenuebertragbarkeit (Art. 20 DSGVO)
- Widerspruch (Art. 21 DSGVO)
- Beschwerde bei Aufsichtsbehoerde (Art. 77 DSGVO)

Kontakt: <placeholder-email>
```

```astro
---
// File: src/pages/datenschutz.astro
import { getEntry } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';

const entry = await getEntry('legal', 'datenschutz');
if (!entry) throw new Error('Datenschutz-Eintrag fehlt');

const { Content, headings } = await entry.render();
---
<BaseLayout title={entry.data.title}>
  <article class="legal">
    <header>
      <h1>{entry.data.title}</h1>
      <p class="meta">
        Version {entry.data.version} —
        Stand: <time datetime={entry.data.lastUpdated.toISOString()}>
          {entry.data.lastUpdated.toLocaleDateString('de-DE')}
        </time>
      </p>
    </header>

    <nav aria-label="Inhaltsverzeichnis">
      <ol>
        {headings.filter(h => h.depth === 2).map(h => (
          <li><a href={`#${h.slug}`}>{h.text}</a></li>
        ))}
      </ol>
    </nav>

    <Content />

    <footer class="legal-footer">
      <p>
        Bei Fragen zur Verarbeitung wenden Sie sich an:
        <a href="mailto:<placeholder-email>"><placeholder-email></a>
      </p>
    </footer>
  </article>
</BaseLayout>
```

## AVV / DPA

DSE selbst loest keine AVV aus (statischer Content). ABER:
- Hosting-Provider liefert die DSE aus → AVV mit Hoster Pflicht
- CDN cached die DSE → AVV mit CDN-Provider Pflicht
- DSE-Inhalt MUSS jeden externen Service aus dem Repo (Tracker, Forms, Embed) als Auftragsverarbeiter listen

## DSE-Wording-Vorlage

```markdown
### Aenderungen dieser Datenschutzerklaerung

Wir behalten uns vor, diese Datenschutzerklaerung anzupassen, falls aenderungen
am Webseitenbetrieb oder gesetzliche Vorgaben dies erfordern.

Die jeweils aktuelle Version ist unter dieser URL abrufbar.

**Aktuelle Version:** 2.3
**Stand:** 5. Mai 2026
**Aeltere Versionen:** Verfuegbar via Repository-History (Git-Tags
`legal-vX.Y` unter <placeholder-repo-url>).
```

## Verify-Commands (Live-Probe)

```bash
# 1. DSE erreichbar
curl -sI https://<placeholder-domain>/datenschutz | head -1
# Erwartung: HTTP/2 200

# 2. last-updated im HTML sichtbar
curl -sS https://<placeholder-domain>/datenschutz | grep -ic "stand:\|version"
# Erwartung: >=1

# 3. Auftragsverarbeiter-Section vorhanden
curl -sS https://<placeholder-domain>/datenschutz | grep -ic "auftragsverarbeit"
# Erwartung: >=1

# 4. Sprach-Attribut korrekt
curl -sS https://<placeholder-domain>/datenschutz | grep -oE 'lang="[a-z]+"' | head -1
# Erwartung: lang="de"

# 5. Anker-Links funktionieren
curl -sS https://<placeholder-domain>/datenschutz | grep -oE 'id="[^"]+"' | head -10
```

## Cross-References

- AEGIS-Scanner: `dse-completeness-checker.ts`, `legal-pages-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 13, 14 (Informationspflichten)
- BGH-Rechtsprechung: `references/bgh-urteile.md` (Transparenz-Anforderungen)
- DSK-Beschluesse: `references/de-dsk-beschluesse.md` (Auftragsverarbeitung)
- Audit-Pattern: `references/audit-patterns.md` Phase 1 (DSE-Vollstaendigkeit)
