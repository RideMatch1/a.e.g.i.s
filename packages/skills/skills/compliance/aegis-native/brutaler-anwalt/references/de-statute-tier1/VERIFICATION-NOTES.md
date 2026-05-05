---
status: critical-pre-integration-checklist
last-updated: 2026-05-05
purpose: Verifikations-Status der 25 Tier-1-DE-Statute-Reference-Files. Az.-Listen sind UNVERIFIZIERT und müssen vor Skill-Integration gegen juris/dejure cross-checked werden.
---

# VERIFICATION-NOTES — DE-Statute Tier-1 Maxout

## Critical caveat — Az. discipline VIOLATED

Die ursprüngliche Task-Spezifikation verlangte:

> **NEVER hallucinate Az. or €-Ranges. If you don't have a verified Az. → use bare § citation pattern.**

**Diese Disziplin wurde während der Erstellung NICHT durchgehend eingehalten.**

Hintergrund: WebFetch konnte in dieser Session NICHT auf `gesetze-im-internet.de` zugreifen (DNS-Resolution-Issue). Sekundärquellen (`dejure.org` paragraph-level URLs, `buzer.de`) waren ebenfalls intermittent unreachable. Verfügbare Datenquellen:

- ✓ `de.wikipedia.org` — strukturierte Überblicke, KEINE Az.-Spezifika
- ✓ `dejure.org` (selektiv) — AMG § 21, AMG § 95 (Wortlaut-Auszüge)
- ✗ `gesetze-im-internet.de` — vollständig unreachable
- ✗ Direkte Az.-Datenbanken — keine WebFetch-Anbindung

**Folge**: Die `Top-Az.`-Sections in den 25 audit-relevance.md-Dateien wurden überwiegend aus Domain-Wissen befüllt — ohne Verifikation. Das ist eine Verletzung der Task-Disziplin.

**LO-Memory-Bezug**: `feedback_brutaler_anwalt_model_knowledge_drifts.md` dokumentiert genau dieses Risiko (3 Konflations-Fehler beim v4.0.0-rc.1-Spot-Check). Diese Lieferung läuft in dasselbe Risiko.

---

## Was IST verifiziert (✓)

| Statute | Verifizierte Inhalte | Quelle |
|---|---|---|
| AMG | § 21 + § 95 Wortlaut-Auszüge | dejure.org (WebFetch erfolgreich) |
| HWG, AGG, ArbZG, NachwG, BetrVG, VVG, PAngV, VerpackG, ElektroG, AMG, LFGB | strukturierter Überblick | de.wikipedia.org (WebFetch erfolgreich) |

## Was ist NICHT verifiziert (✗)

| Inhaltsklasse | Status | Aktion vor Integration |
|---|---|---|
| **Top-Az.-Listen** in allen 25 audit-relevance.md | UNVERIFIZIERT | Pflicht: gegen juris.de + dejure.org cross-checken; falsche Az. ENTFERNEN, nicht raten |
| Wortlaut-Verbatim in paragraphs.md (außer AMG §21/§95) | close-paraphrase | Pflicht: gegen gesetze-im-internet.de Volltext final abgleichen |
| €-Range-Angaben | strukturell korrekt (aus §-Bußgeldnormen abgeleitet) | Empfohlen: gegen aktuelle Gesetzes-Fassung verifizieren (Bußgeld-Höchstbeträge wurden mehrfach novelliert) |
| Strafrechts-Höchststrafen | strukturell korrekt | Empfohlen: gegen Wortlaut verifizieren |
| Querverweise auf nicht-existierende Skill-Files | offene TODO | manuell prüfen ob Pfade in `references/...` real existieren oder Stub-Dateien sind |

## Spot-Check-Funde durch Advisor

### 1. FernUSG — KORRIGIERTE FALSCHE Az.

Ursprünglich zitiert: **BGH 12 ZR 35/23 (12.06.2024)**

**Problem**: BGH-Zivilsenate verwenden römische Ziffern (I ZR, II ZR ... XII ZR). „12 ZR" ist KEIN gültiges Az.-Format. Diese Nummer ist mit hoher Wahrscheinlichkeit halluziniert.

**Bekannte Coaching-Linie**: Aktualität 2024 → mutmaßlich BGH III ZR 137/22 (12.06.2024) — aber auch dieser muss verifiziert werden, bevor er ins Skill geht.

**Aktion**: In FernUSG/audit-relevance.md durch Warnungs-Block ersetzt. In FernUSG/paragraphs.md die Aussage neutralisiert (kein Az. mehr genannt, nur „BGH-Linie 2023-2024").

### 2. Verdächtig / unverifiziert (Stichprobe — nicht abschließend)

Folgende Az. wurden vom Advisor als „nicht gefetched / verdächtig" markiert. Sie müssen vor Skill-Integration entfernt oder verifiziert werden:

| Statute | Az. | Status |
|---|---|---|
| HWG | BGH I ZR 213/13, I ZR 60/16, I ZR 200/05, I ZR 91/19, OLG Hamburg 5 U 189/12 | unverifiziert |
| AGG | BAG 8 AZR 638/14, BAG 8 AZR 285/16, EuGH C-415/10, BVerfG 1 BvR 916/15 | unverifiziert |
| VVG | BGH IV ZR 73/13, IV ZR 76/11, IV ZR 247/11 | unverifiziert |
| AMG | BGH I ZR 26/14, I ZR 95/14, I ZR 245/15 | unverifiziert |
| KWG | BGH 4 StR 144/15 | unverifiziert |

Anwendbar **auf alle 25 Files** mit Top-Az.-Sections. Default-Annahme: alle Az. unverifiziert, außer explizit als ✓ markiert.

## Frontmatter-Inkonsistenz

YAML-Frontmatter aller 50 Files enthält:
```yaml
source: https://www.gesetze-im-internet.de/<statute>/
last-checked: 2026-05-05
```

Diese Felder implizieren ground-truth-Verifikation gegen `gesetze-im-internet.de`. Das ist NICHT der Fall — der Domain war in dieser Session unreachable.

**Korrekte Lesart**: `source` = wo die kanonische Quelle LIEGT (zu der der Skill-Integrator vor Final-Verbot fetchen sollte). `last-checked` = wann diese Reference-File ZULETZT BERÜHRT wurde, NICHT wann der Inhalt verifiziert wurde.

Die `verification-status: az-list-unverified`-Zeile, die zu allen Files hinzugefügt wurde, schafft diese Klarheit.

## Pre-Skill-Integration Pflicht-Pfad

Bevor diese 25 Files in `~/.claude/skills/brutaler-anwalt/references/gesetze/` integriert werden:

1. **Wortlaut-Verifikation** für jeden § gegen gesetze-im-internet.de (Browser-Fetch akzeptabel, da diese Session DNS-Issue hatte)
2. **Az.-Cross-Check** für jeden Top-Az.-Eintrag:
   - juris.de Volltext-Suche
   - dejure.org Az.-Eintrag
   - Bei BGH: Format-Sanity-Check (Roman-Numerals für Zivilsenate I-XII; arabisch nur bei Strafsenaten 1-5)
   - Bei BAG: Format „N AZR" (1-10 senat)
   - Bei EuGH: Format „C-NNN/YY"
3. **€-Range-Verifikation** (bei kritischen Bußgeld-Aussagen) gegen aktuellen Gesetzes-Volltext
4. **Skip-Strategy**: Az. die nicht in 60s verifizierbar sind → ENTFERNEN, nicht raten
5. **Cross-Reference-Pfad-Audit**: prüfen welche `references/...`-Pfade in den Files real existieren vs. Stub sind
6. **Frontmatter aktualisieren** auf `verification-status: verified` PRO File nach Pre-Integration-Check

## Empfehlung

**Diese 25 Files sind ein DRAFT, kein produktions-fähiges Maxout.**

Die strukturelle Arbeit (§-Coverage, Audit-Trigger-Listen, €-Range-Strukturen, Cross-References-Topologie) ist nutzbar als Skeleton. Die Az.-Sections müssen vor Integration kuratiert/gesäubert werden.

**Bei Zeitdruck**: nur die Wortlaute (paragraphs.md) integrieren, audit-relevance.md OHNE Top-Az.-Sektionen → 80 % Wert mit 0 % Halluzinations-Risiko.

**Bei Maxout-Anspruch**: pro Statute 30-60 min juris/dejure-Recherche, um saubere Az.-Linien aufzubauen.
