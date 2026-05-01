---
status: skeleton
purpose: Strukturierte Pflicht-§-Auszuege pro Gesetz. Volltext NICHT kopieren — Tenor-Kurzfassungen + Audit-Relevance-Mapping.
maintainer-note: Diese Datei ist der Entry-Point fuer Phase 2 Maxout. Bitte beim Befuellen Provenance-Disziplin (SKILL.md §5) wahren.
---

# `references/gesetze/` — Skeleton + Befuell-Plan

> Status: **skeleton**. Ziel: pro Gesetz ein File mit den fuer Web/SaaS-Audit
> relevanten §§. KEIN Volltext — strukturierte Tenor-Auszuege + Anwendungs-Mapping.
>
> **Source-Pflicht analog SKILL.md §5**: jeder Eintrag braucht eine
> Source-URL. Primaerquelle: `gesetze-im-internet.de` (BMJ, gemeinfrei
> per § 5 UrhG) bzw. `eur-lex.europa.eu` (CC BY 4.0 Attribution).

## Befuell-Reihenfolge (priorisiert nach Audit-Frequenz)

### Tier 1 — Pflicht fuer JEDES Audit (befuellen zuerst)
- [ ] `DSGVO/articles.md` — alle 99 Artikel mit 1-Satz-Tenor, audit-relevance-Mapping
- [ ] `DSGVO/recitals.md` — die ~30 Erwaegungsgruende, die in Bgh-/EuGH-Urteilen wiederkehrend zitiert werden (1, 4, 26, 32, 33, 39, 47, 49, 71, 75, 80, 85, 87, 91, 146, 158, 173)
- [ ] `BDSG/paragraphs.md` — §§ 1-85, Fokus auf §§ 1-7 (Begriff), 26 (Beschaeftigtendaten), 27 (wissenschaftliche Forschung), 38 (Datenschutzbeauftragter), 41 (Bussgeld)
- [ ] `TDDDG/paragraphs.md` — §§ 1-31, **Fokus § 25** (Cookies / Telemediendienste-Endgeraet-Zugriff)
- [ ] `DDG/paragraphs.md` — vormals TMG seit 14.03.2024, Fokus § 5 (Impressum), §§ 7-10 (Haftung)
- [ ] `BGB/paragraphs.md` — §§ 305-310 (AGB), §§ 312-312k (Verbraucherschutz), § 355 (Widerruf), §§ 357-357d (Widerrufsfolgen), §§ 651a-y (Pauschalreise), §§ 666 ff. (Auftrag, B2B-Service)
- [ ] `UWG/paragraphs.md` — §§ 3, 3a, 5, 5a, 6, 7, 8, 13 — Hauptabmahn-Vehikel im Web

### Tier 2 — Branchen-/Kontext-spezifisch (nach Tier 1)
- [ ] `HGB-AO/paragraphs.md` — HGB § 257 (6/10-Jahre-Aufbewahrung), AO § 147 (10-Jahre)
- [ ] `VSBG/paragraphs.md` — § 36 (Verbraucherschlichtung-Hinweis-Pflicht), § 17
- [ ] `EU-Verordnungen/DSA-2022-2065/articles.md` — 93 Artikel, Fokus Art. 14 (Notice-and-Action), 16 (Notice-Endpoint), 22 (Out-of-court-Dispute), 24 (Transparency), 26-28 (Werbung)
- [ ] `EU-Verordnungen/AI-Act-2024-1689/articles.md` — 113 Artikel, Fokus Art. 5 (Verbotene KI), 6-15 (Hochrisiko), 50 (Transparenz/KI-Hinweis), 99 (Sanktionen)
- [ ] `BFSG/paragraphs.md` — Pflicht seit 28.06.2025 fuer B2C-Online
- [ ] `HinSchG/paragraphs.md` — Hinweisgeberschutz-Gesetz (B2B mit > 50 MA)
- [ ] `NIS2UmsuCG-BSIG/paragraphs.md` — sobald in Kraft (deutsche NIS2-Umsetzung)
- [ ] `StGB/relevante-paragraphen.md` — §§ 202a-d (Datenausspaehung), 263a (Computerbetrug), 269 (Faelschung beweiserheblicher Daten)

### Tier 3 — Branchen-Spezifisch (on-demand)
- [ ] `EU-Verordnungen/DMA-2022-1925/articles.md` — fuer Plattformen ueber Schwellwert
- [ ] `EU-Verordnungen/ODR-524-2013/articles.md` — Art. 14 ODR-Link-Pflicht
- [ ] `EU-Verordnungen/eIDAS-910-2014/articles.md` — Trust-Services, qualifizierte Signaturen
- [ ] `KritisDachG/paragraphs.md` — KRITIS (KRITIS-Sektoren)
- [ ] `HWG-LMIV-HOAI-BORA-MPDG-GlueStV-JuSchG-FernUSG/audit-relevance.md` — Branchen-Kompendium
- [ ] `IHK-DSK-EDSA-Guidelines/stellungnahmen.md` — wichtige Aufsichtsbehoerden-Stellungnahmen

## Format pro File (Vorlage)

```markdown
---
license: gemeinfrei nach § 5 UrhG (DE) / CC BY 4.0 (EU-Verordnungen)
source: <primary-URL>
last-checked: <YYYY-MM-DD>
---

# <Gesetz / Verordnung> — Audit-relevante Paragraphen / Artikel

> Strukturierter Auszug fuer brutaler-anwalt-Audits.
> Volltext: <primary-URL>

## § / Art. <Nr.> — <Kurz-Bezeichnung>

**Tenor (1-2 Saetze):** <Inhalt>

**Audit-Relevanz:**
- Auf welcher Audit-Surface tritt dies auf? (Site, Code, Doku, AGB, DSE)
- Welche Findings im Skill triggern dies?
- Welche Az.-Belege sind verknuepft? (Cross-Ref zu bgh-urteile.md)

**Fix-Pattern (wenn anwendbar):** <Verweis auf templates/>

**Source:** <URL zur Primaerquelle>
```

## Quellen-Liste

### Primaer (DE)
- https://www.gesetze-im-internet.de/ — BMJ, Pflicht-Quelle DE-Gesetze
- https://juris.bundesgerichtshof.de/ — BGH-Entscheidungen-DB

### Primaer (EU)
- https://eur-lex.europa.eu/ — alle EU-Verordnungen + Richtlinien
- https://curia.europa.eu/ — EuGH-Entscheidungen

### Sekundaer (akzeptabel mit `[secondary-source-verified]`-Tag)
- https://dejure.org/, https://openjur.de/, https://rewis.io/
- https://www.bird-bird.com/, https://www.noerr.com/ (Anwalts-Blogs)
- https://www.edpb.europa.eu/ (EDPB-Guidelines)

## NICHT-Inhalt dieser Files

- KEIN kompletter Gesetzes-Volltext (Token-Effizient-Regel)
- KEINE Erwaegungs-Diskussion (das ist Aufgabe von Anwalts-Texten)
- KEINE Az.-Sammlung (gehoert in `bgh-urteile.md`)
- KEINE Branchen-spezifischen Pflicht-Klauseln (gehoert in `branchenrecht.md`)
