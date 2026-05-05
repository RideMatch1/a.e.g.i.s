---
status: draft-complete (25/25 Tier-1 DE-Statute) — Az.-Listen UNVERIFIZIERT
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md)
license: gemeinfrei nach § 5 UrhG (DE) per file
last-checked: 2026-05-05 (file-creation; NICHT Inhalts-Verifikation)
purpose: Index der 25 Tier-1 DE-Statute-Reference-Files für brutaler-anwalt-Skill-Maxout. Jede Sub-Folder hat paragraphs.md + audit-relevance.md. Pre-Integration: VERIFICATION-NOTES.md lesen.
---

# DE-Statute Tier-1 — Index

25 Tier-1-DE-Statute, geordnet nach Cluster. Jede Folder hat:
- `paragraphs.md` — Wortlaut (verbatim oder close-paraphrase) der Audit-relevanten §§
- `audit-relevance.md` — Trigger im Code/UI, €-Range, Az.-Anker, Cross-References

## Status-Übersicht

| # | Statute | Folder | Cluster | Status |
|---|---------|--------|---------|--------|
| 1 | HWG (Heilmittelwerbegesetz) | de-statute-tier1/HWG/ | Health | ✓ |
| 2 | AMG (Arzneimittelgesetz) | de-statute-tier1/AMG/ | Health | ✓ |
| 3 | MPDG (Medizinprodukte-Durchführungsgesetz) | de-statute-tier1/MPDG/ | Health | ✓ |
| 4 | DiGAV (Digitale-Gesundheitsanwendungen-Verordnung) | de-statute-tier1/DiGAV/ | Health | ✓ |
| 5 | LFGB (Lebensmittel-/Bedarfsgegenstände-/Futtermittelgesetzbuch) | de-statute-tier1/LFGB/ | Health | ✓ |
| 6 | GwG (Geldwäschegesetz) | de-statute-tier1/GwG/ | Finance | ✓ |
| 7 | KWG (Kreditwesengesetz) | de-statute-tier1/KWG/ | Finance | ✓ |
| 8 | ZAG (Zahlungsdiensteaufsichtsgesetz) | de-statute-tier1/ZAG/ | Finance | ✓ |
| 9 | WpHG (Wertpapierhandelsgesetz) | de-statute-tier1/WpHG/ | Finance | ✓ |
| 10 | ArbZG (Arbeitszeitgesetz) | de-statute-tier1/ArbZG/ | Arbeitsrecht | ✓ |
| 11 | NachwG (Nachweisgesetz) | de-statute-tier1/NachwG/ | Arbeitsrecht | ✓ |
| 12 | AGG (Allgemeines Gleichbehandlungsgesetz) | de-statute-tier1/AGG/ | Arbeitsrecht | ✓ |
| 13 | BetrVG (Betriebsverfassungsgesetz) | de-statute-tier1/BetrVG/ | Arbeitsrecht | ✓ |
| 14 | HinSchG (Hinweisgeberschutzgesetz) | de-statute-tier1/HinSchG/ | Arbeitsrecht | ✓ |
| 15 | VVG (Versicherungsvertragsgesetz) | de-statute-tier1/VVG/ | Verbraucher | ✓ |
| 16 | PAngV (Preisangabenverordnung 2022) | de-statute-tier1/PAngV/ | Verbraucher | ✓ |
| 17 | VerpackG (Verpackungsgesetz) | de-statute-tier1/VerpackG/ | Verbraucher | ✓ |
| 18 | ElektroG (Elektro-/Elektronikgerätegesetz) | de-statute-tier1/ElektroG/ | Verbraucher | ✓ |
| 19 | DDG (Digitale-Dienste-Gesetz) | de-statute-tier1/DDG/ | Verbraucher | ✓ |
| 20 | TDDDG (Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz) | de-statute-tier1/TDDDG/ | Verbraucher | ✓ |
| 21 | VDuG (Verbraucherrechtedurchsetzungsgesetz) | de-statute-tier1/VDuG/ | Verbraucher | ✓ |
| 22 | RDG (Rechtsdienstleistungsgesetz) | de-statute-tier1/RDG/ | Verbraucher | ✓ |
| 23 | FernUSG (Fernunterrichtsschutzgesetz) | de-statute-tier1/FernUSG/ | Verbraucher | ✓ |
| 24 | UrhG + UrhDaG (Urheberrecht + Diensteanbieter) | de-statute-tier1/UrhG-UrhDaG/ | Misc | ✓ |
| 25 | GeschGehG (Geschäftsgeheimnisgesetz) | de-statute-tier1/GeschGehG/ | Misc | ✓ |

## Skipped (source-unavailable)

— keine. Alle 25 Statute geliefert.

## Quellen-Hinweis + Verifikations-Status

> **WICHTIG**: Vor Skill-Integration siehe `VERIFICATION-NOTES.md`.

Primärquelle für alle Files: `gesetze-im-internet.de` (BMJ, gemeinfrei nach § 5 UrhG (DE)).

In dieser Session-Phase war direkter Fetch von `gesetze-im-internet.de` über WebFetch NICHT möglich (DNS-Resolution-Issue). Verfügbare Sekundär-Quellen:
- `dejure.org` (selektiv) — AMG § 21, AMG § 95 (Wortlaut-Auszüge)
- `de.wikipedia.org` — strukturierter Überblick + Auslegungs-Mappings
- Domain-Wissen — für Az.-Listen + Wortlaut-close-paraphrase (NICHT verifiziert)

**Az. discipline — KORREKTUR der ursprünglichen Behauptung**: Az.-Listen wurden überwiegend aus Domain-Wissen erstellt; vor Skill-Integration MÜSSEN sie gegen juris/dejure cross-checked werden. Spot-Check FernUSG „12 ZR 35/23" wurde vom Advisor bereits als FALSCH erkannt (BGH-Zivilsenate verwenden römische Ziffern). Default-Annahme: alle Top-Az.-Einträge unverifiziert.

Frontmatter aller 50 Files trägt jetzt:
```yaml
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md ...)
```

Siehe `VERIFICATION-NOTES.md` für vollständigen Pre-Skill-Integration Pflicht-Pfad.

## Cross-Cluster-Tabellen

### Beweislastumkehr — Mechanik in mehreren Statuten

| Statute | § | Mechanik |
|---|---|---|
| AGG | § 22 | Indizien reichen → Beklagte trägt Voll-Beweislast für Sachgrund |
| HinSchG | § 36 | Berufl. Nachteil nach Meldung = vermutete Repressalie |
| GeschGehG | § 18 | Beweislast für Geheimhaltung beim Inhaber, dann beim Verletzer |
| NachwG | (faktisch) | Fehlender Nachweis → AG trägt Beweislast für mündliche Vereinbarung |

### KMU-Schwellen / Pflicht-Stufen

| Statute | Schwelle | Pflicht |
|---|---|---|
| HinSchG | ≥ 50 MA | Meldekanal Pflicht |
| BetrVG | ≥ 5 MA | BR-Wahl möglich; ≥ 20 = § 99 voll |
| ElektroG | ≥ 400 qm Verkaufs-/Lager-Fläche | § 17 Rücknahme |
| UrhDaG | < 3 J + < € 10 Mio + < 5 Mio Visitors = KMU-Erleichterung | § 2 Abs. 2 S. 2 |
| GwG | jeder Verpflichtete | KYC-Pflicht ab Schwellen § 10 |

### Bußgeld-Höchstsätze (Top-Range pro Statute)

| Statute | Höchst-Bußgeld | § |
|---|---|---|
| WpHG | 15 Mio € / 15 % Jahresumsatz | § 120 |
| GwG | 5 Mio € / 10 % Jahresumsatz | § 56 |
| KWG | 5 Mio € / 10 % Jahresumsatz | § 56 |
| ZAG | 5 Mio € / 10 % Jahresumsatz | § 65 |
| UrhDaG | 5 % weltweiter Jahresumsatz | § 21 |
| TDDDG | 300.000 € + DSGVO-direkt parallel | § 28 |
| VerpackG | 200.000 € | § 34 |
| LFGB | 100.000 € (benannt) | § 60 |
| ElektroG | 100.000 € | § 29 |
| HWG | 50.000 € | § 15 |
| MPDG | 50.000 € OwiG (+ Strafrecht § 92) | § 94 |
| RDG | 50.000 € | § 20 |
| DDG | 50.000 € + DSA-direkt 6 % | § 33 |
| AMG | 25.000-50.000 € OwiG (+ Strafrecht § 95 bis 10 J) | § 97 |
| PAngV | 25.000 € (+ § 130 OWiG bis 10 Mio) | § 19 |
| HinSchG | 50.000 € (Repressalien) | § 40 |
| ArbZG | 15.000 € pro Verstoß | § 22 |
| FernUSG | 10.000 € (+ § 7 Vertrags-Nichtigkeit) | § 8 |
| BetrVG | 10.000 € + Unterlassung | § 121 |
| NachwG | 2.000 € pro Verstoß | § 4 |
| AGG | 3 Monatsgehälter (§ 15 Abs. 2) | § 15 |
| GeschGehG | Schadensersatz Lizenzanalogie (+ § 23 Strafrecht bis 5 J) | § 10 / § 23 |
| VVG | Schadensersatz, BaFin-Aufsicht | § 6 / § 63 |
| WpHG | s. oben | s. oben |
| VDuG | Aggregat-Schadensersatz; kein direktes Bußgeld | — |
| UrhG | Schadensersatz Lizenzanalogie + § 106 Strafrecht bis 3 J | § 97 |

### Strafrechts-Eskalation (Freiheitsstrafe-Möglichkeiten)

| Statute | § | Höchststrafe |
|---|---|---|
| AMG | § 95 Abs. 3 | 1-10 Jahre (besonders schwerer Fall) |
| MPDG | § 92 Abs. 2 | bis 10 Jahre (schwerer Fall) |
| LFGB | § 58 Abs. 6 | 6 Mo - 5 Jahre (schwer) |
| KWG | § 54 | bis 5 Jahre |
| ZAG | § 63 | bis 5 Jahre |
| WpHG | § 119 | 1-10 Jahre (schwer) |
| GeschGehG | § 23 Abs. 2 | bis 5 Jahre (schwer) |
| AMG | § 95 Abs. 1 | bis 3 Jahre |
| MPDG | § 92 Abs. 1 | bis 3 Jahre |
| LFGB | § 58 Abs. 1 | bis 3 Jahre |
| UrhG | § 106 | bis 3 Jahre |
| GeschGehG | § 23 Abs. 1 | bis 3 Jahre |
| ArbZG | § 23 | bis 1 Jahr (Gesundheitsgefährdung) |
| HWG | § 14 | bis 1 Jahr |

## Integration in Skill — Empfehlung

Pre-Integration:
1. **Wortlaut-Verifikation** gegen gesetze-im-internet.de (Browser-Fetch) für alle Verbatim-Stellen
2. **Az.-Cross-Check** mit dejure.org / juris für alle Top-Az.-Listen
3. **YAML-Frontmatter standardize**: `license / source / last-checked / purpose` (alle 25 haben das)
4. **Skill-Loader**: hinzufügen zu `references/gesetze/INDEX.md` (Tier-Promotion auf Tier-1)
5. **Cross-Reference-Audit**: prüfen, dass alle `references/...`-Pfade in Cross-Reference-Sections existieren

Post-Integration:
- regression-test in test-cycle (multiple internal customer-projects + AEGIS-self-audit) — siehe Million-Euro-Tier-Roadmap
- Verlinkung in Master-INDEX (`references/gesetze/INDEX.md`)
- Sanitize-Pass (keine Operator-Brand-Names oder LLM-Vendor-Refs — alle 25 Files sind clean by design)
