---
license: MIT
last-checked: 2026-05-05
purpose: Zentrale Verifikations-Status-Liste fuer references/gesetze/ — Provenance-Disziplin §5 erweitert um EU/DE-Verordnungs-Detail-Coverage.
---

# Gesetze — Verification Status (v4.0.0-rc.1)

> **Pflicht-Lesen vor jedem Citation-Output, der eine Sanktions-Hoehe, Frist
> oder Artikel-Nummer aus den Detail-Files zitiert.**

## Hintergrund

Phase B.1+B.2 (Million-Euro-Tier-Audit 2026-05-02) hat 14 EU-Verordnungs-Detail-
Files + 23 DE-Spezialgesetz-Files neu erstellt. Die Inhalte basieren teils auf
Modell-Wissen, das **nicht** primary-source-verifiziert wurde.

Spot-Check 2026-05-02 (12 high-stakes Claims):
- **3 substantielle Findings** (1.5%->1% AI-Act, DORA-Frist unvollstaendig, MiCA Art.-Nummer-Drift Art. 86 vs Art. 111)
- **1 minor Finding** (LkSG-Cap unvollstaendig dokumentiert — gefixt)
- **8 ✅ verifiziert** (AI-Act-Timeline, Data-Act 12.01.2027, DSA Art. 16 + Art. 74 + 45M-MAU, HinSchG 50/250, PSD2 30 EUR, etc.)

Empirische Error-Rate: ~25-33%. Damit gilt Pfad B (Experimental-Scope) der
advisor-Empfehlung: alle B.1/B.2 Detail-Files als coverage-experimental markiert,
Skill-Output zitiert nur aus Files mit `verification-status: verified` ohne
zusaetzliche Volltext-Verifikation.

## Status-Klassen

- **verified** — Inhalte gegen Primaerquelle (eur-lex / gesetze-im-internet)
  oder mind. 2 unabhaengige Sekundaerquellen (Behoerden + Anwaltskanzleien)
  abgeglichen. Skill-Output darf zitieren.
- **secondary-source-derived** — Inhalte basieren auf Modell-Wissen +
  Sekundaerquellen. Primaerquellen-Verifikation pending v4.0.0-rc.2.
  Skill-Output muss bei Citation eine Disclaimer-Zeile drucken
  („Sekundaerquellen-Inhalt — gegen $URL verifizieren").
- **skeleton-only** — Folder existiert, Inhalt ist Skelett-Text mit
  defer-marker. NICHT in Skill-Output zitieren.

## Detail-Status (B.1 — EU-Verordnungen)

### AI-Act 2024/1689

| File | Status | Verifizierte Claims | Pending |
|---|---|---|---|
| `sanktionen-art-99.md` | **verified** | 35M/7%, 15M/3%, 7,5M/**1%** (gefixt von 1,5%) | KMU-Privileg-Range |
| `uebergangsfristen.md` | **verified** | 02.02.2025, 02.08.2025, 02.08.2026, 02.08.2027 | 02.08.2030 (Hochrisiko-Behoerden) |
| `hochrisiko-annex-iii.md` | secondary-source-derived | — | 8 Annex-III-Bereiche Volltext-Pruefung |
| `gpai-pflichten.md` | secondary-source-derived | — | Art. 51-56 Volltext + System-Risk-Schwelle 10^25 FLOPS |
| `transparenz-art-50.md` | secondary-source-derived | — | Art. 50 vollstaendiger Pflicht-Katalog |
| `audit-relevance.md` | secondary-source-derived | — | Audit-Pattern-Konsistenz |
| `articles.md` | secondary-source-derived (re-klassifiziert 2026-05-05; 108 Zeilen Detail-Inhalt) | — | Volltext-Verifikation pending v4.0.0-rc.2 |

### DSA 2022/2065

| File | Status | Verifizierte Claims | Pending |
|---|---|---|---|
| `notice-and-action.md` | **verified** (Top-Layer) | Art. 16 Pflicht-Felder, Art. 74 6%, Hosting-Provider-Geltung | Art. 17 Vollstaendigkeit |
| `vlop-vlose.md` | **verified** (Top-Layer) | 45M MAU = VLOP-Schwelle, 4-Monats-Compliance-Frist | Art. 33-43 Spezial-Pflichten |
| `articles.md` | secondary-source-derived (re-klassifiziert 2026-05-05; 131 Zeilen Detail-Inhalt) | — | Volltext-Verifikation pending v4.0.0-rc.2 |
| `trusted-flaggers.md` | secondary-source-derived | — | Art. 22 Volltext + DE Trusted-Flagger-Designation |
| `small-platform-pflichten.md` | secondary-source-derived | — | Art. 19 KMU-Privileg Volltext |
| `audit-relevance.md` | secondary-source-derived | — | Audit-Pattern-Konsistenz |

### DORA 2022/2554

| File | Status | Verifizierte Claims | Pending |
|---|---|---|---|
| `articles.md` | **verified** (Top-Layer) | Art. 19 4h+24h+72h+1M-Kaskade, Anwendbarkeit 17.01.2025 | Art. 28-31 Drittanbieter, Art. 50 Sanktionen |
| `audit-relevance.md` | secondary-source-derived | — | Audit-Pattern-Konsistenz |

### MiCA 2023/1114

| File | Status | Verifizierte Claims | Pending |
|---|---|---|---|
| `articles.md` | **partially verified** (Sanktions-Art. 86->111-Drift gefixt mit Hinweis-Marker) | 30.12.2024 anwendbar, Token-Kategorien, CASP-Definition | Art. 111 ff. exakte Sanktions-Hoehen + ART/EMT/CASP-Modul-Differenzierung |
| `audit-relevance.md` | secondary-source-derived | — | Audit-Pattern-Konsistenz |

### Data Act 2023/2854

| File | Status | Verifizierte Claims | Pending |
|---|---|---|---|
| `articles.md` | **verified** (Top-Layer) | Art. 25 Switching, 12.01.2027 Stichtag, 12.09.2024 Inkrafttreten | weitere Cloud-Switching-Detail-Pflichten |
| `audit-relevance.md` | secondary-source-derived | — | Audit-Pattern-Konsistenz |

### ePrivacy-RL 2002/58

| File | Status | Pending |
|---|---|---|
| `articles.md` | secondary-source-derived | Art. 5 Abs. 3 + DE-Umsetzung TDDDG-Mapping |
| `audit-relevance.md` | secondary-source-derived | — |

### Skeleton-Only Files (kein Skill-Citation)

- `DMA-2022-1925/articles.md`
- `DGA-2022-868/articles.md`
- `eIDAS-2024-1183/articles.md`
- `CER-2022-2557/articles.md`
- `ProdHaftRL-2024-2853/articles.md`
- `CSDDD-2024-1760/articles.md`
- `CSRD-2022-2464/articles.md`

### Secondary-Source-Derived (re-klassifiziert 2026-05-05)

Diese Files wurden zuvor faelschlich als "skeleton-only" gefuehrt, sind
aber tatsaechlich mit verifiziertem Sekundaerquellen-Inhalt befuellt
(98 bzw. 84 Zeilen mit konkreten Sanktions-Hoehen, Schwellwerten,
Meldepflichten):

- `NIS2-2022-2555/articles.md` — Art. 34 Sanktionen (10M/2% bzw. 7M/1,4%),
  Schwellwerte 250 MA / 50 Mio. EUR, Meldepflichten 24h/72h/1M
- `CRA-2024-2847/articles.md` — Hauptpflichten ab 11.12.2027, Reporting
  ab 11.09.2026, Common Specifications 2025/2026

Skill darf aus diesen Files zitieren mit Pflicht-Disclaimer
"⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen Verordnungs-
Volltext verifizieren".

## Detail-Status (B.2 — DE-Spezialgesetze)

| File | Status | Verifizierte Claims | Pending |
|---|---|---|---|
| `HinSchG/articles.md` | **verified** (Top-Layer) | 50/250-MA-Schwellen, 50.000 EUR Cap | Sanktions-Differenzierung pro Tatbestand |
| `LkSG/articles.md` | **verified** (Top-Layer) | § 24 vollstaendig (100k/500k/800k/8M-Cap mit 400M-Schwelle) | — |
| `StGB/relevante-paragraphen.md` | secondary-source-derived | §§ 202a-d, 263a, 269, 303a-b vorhanden | Volltext-Konsistenz mit BT-Drs |
| `JuSchG-JMStV/articles.md` | secondary-source-derived | — | Sanktions-Hoehen-Verifikation |
| `GlueStV/articles.md` | secondary-source-derived | — | Sanktions-Hoehen + GlueStV-2026-Aenderungen |
| `TKG/articles.md` | secondary-source-derived | — | VoIP-Applicability-Scope |
| `MedTech/MDR-2017-745.md` | secondary-source-derived | — | Annex-Pflichten-Vollstaendigkeit |
| `MedTech/IVDR-2017-746.md` | secondary-source-derived | — | Risikoklassen + UDI-Pflicht-Detail |
| `MedTech/DiGAV.md` | secondary-source-derived | — | DiGA-VO-Aenderungen 2025 |
| `Finance/PSD2.md` | **partially verified** | SCA 30 EUR Schwelle | Art. 98 Volltext + RTS 2018/389 |
| `Finance/ZAG.md` | secondary-source-derived | — | BaFin-Aufsichts-Praxis |
| `Finance/KWG.md` | secondary-source-derived | — | Erlaubnis-Pflicht-Tatbestaende |
| `NIS2UmsuCG-BSIG/articles.md` | skeleton-only | — | Bundestag-Verabschiedung pending |
| `KritisDachG/articles.md` | skeleton-only | — | Bundestag-Verabschiedung pending |

## Tier-1 audit-relevance.md (B.2 Sub-Phase)

Folgende Files wurden als **Audit-Pattern-Mappings** geschrieben — KEINE
neuen Sanktions/Frist-Behauptungen, sondern Verlinkungen mit bestehenden
Tier-1-Files (DSGVO, BDSG, etc.). Verifikations-Risiko gering, aber nicht 0.

| File | Status |
|---|---|
| `DSGVO/audit-relevance.md` | secondary-source-derived (Audit-Pattern-Konsistenz mit dsgvo.md) |
| `BDSG/audit-relevance.md` | secondary-source-derived |
| `TDDDG/audit-relevance.md` | secondary-source-derived |
| `DDG/audit-relevance.md` | secondary-source-derived |
| `BGB/audit-relevance.md` | secondary-source-derived |
| `UWG/audit-relevance.md` | secondary-source-derived |
| `HGB-AO/audit-relevance.md` | secondary-source-derived |
| `VSBG/audit-relevance.md` | secondary-source-derived |
| `BFSG/audit-relevance.md` | secondary-source-derived |

## Skill-Output-Regel (Pflicht ab v4.0.0-rc.1)

Bei jedem Skill-Output, der aus den `references/gesetze/`-Files (B.1/B.2)
zitiert:

1. **Top-Layer-`verified`-File**: zitierbar wie bisher mit Source-URL.
2. **`secondary-source-derived`-File**: bei jeder Citation Pflicht-Disclaimer:

   > „⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen
   > [eur-lex.europa.eu] / [gesetze-im-internet.de] verifizieren."

3. **`skeleton-only`-File**: NICHT zitieren. Skill-Output kann Folder-Existenz
   melden ("eIDAS 2.0 ist scoped, Detail-Coverage pending v4.0.0-rc.2"), aber
   keine konkreten Sanktions/Frist-Claims daraus generieren.

## Verifikations-Roadmap v4.0.0-rc.2

Vor v4.0.0-Final-Release: alle `secondary-source-derived` Files muessen auf
**verified** umgestellt sein. Verifikations-Workflow:

1. Pro File: Top-3 high-stakes Claims identifizieren (Sanktions-Hoehe, Frist, Artikel-Nummer)
2. WebFetch eur-lex/gesetze-im-internet Volltext (oder mind. 2 unabhaengige Sekundaerquellen)
3. Bei Diskrepanz: File-Update + CHANGELOG-Eintrag
4. Bei Match: Status auf `verified` umstellen
5. Falls Quelle nicht verfuegbar: File auf `skeleton-only` zurueckstufen

Erwarteter Verifikations-Aufwand: ~30-40 Files × 5-10min = 3-6h.

## Frontmatter-Disclaimer-Pattern (eingefuehrt 2026-05-05)

Ab v4.0.0-rc.1 tragen alle Gesetze-Files YAML-Frontmatter-Felder, die
das Skill-Konsumieren verifikations-status-aware machen. Damit kann der
Skill-Output bei Citation automatisch den richtigen Disclaimer drucken,
ohne dass der Skill jedes File manuell triagieren muss.

### Drei Status-Varianten + zugehoerige Disclaimer

**Variante 1 — `verified` (Top-Layer-verifiziert):**

```yaml
verification-status: verified
skill-output-disclaimer: "Top-Layer-verifiziert (gesetze-im-internet.de) — Sanktions-Hoehen + Schwellwerte primaer-verifiziert"
last-verified: 2026-05-05
```

Anwendung: HinSchG, LkSG, DORA articles, AI-Act sanktionen-art-99 +
uebergangsfristen, DSA notice-and-action + vlop-vlose, Data-Act articles.
URL im Disclaimer wird je nach Quelle variiert (`eur-lex.europa.eu` fuer
EU-Verordnungen, `gesetze-im-internet.de` fuer DE-Gesetze).

**Variante 2 — `partially-verified` (Top-Claims primaerquelle, Detail-Claims pending):**

```yaml
verification-status: partially-verified
skill-output-disclaimer: "⚠ Teil-verifiziert — Top-Claims primaerquelle-bestaetigt; weitere Detail-Claims gegen [Quelle] verifizieren"
last-verified: 2026-05-05
```

Anwendung: Finance/PSD2.md (SCA-Schwelle verifiziert, RTS 2018/389 pending),
MiCA articles.md (Anwendbarkeit + Token-Kategorien verifiziert, Sanktions-
Hoehen Art. 111 ff. pending).

**Variante 3 — `secondary-source-derived` (Modell-Wissen + Sekundaerquellen):**

```yaml
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen [Quelle] verifizieren"
last-verified: 2026-05-05
```

Anwendung: alle uebrigen B.1/B.2-Detail-Files + Tier-1 audit-relevance.md
Files (BDSG/TDDDG/DDG/BGB/UWG/HGB-AO/VSBG/BFSG).

### Skill-Konsumtions-Pattern

Der Skill (brutaler-anwalt SKILL.md / Citation-Output-Pipeline) soll bei
jedem Reference-File-Zugriff:

1. YAML-Frontmatter aus File-Top extrahieren (3-5 Zeilen unter `---`-Block).
2. `verification-status` lesen.
3. Wenn `secondary-source-derived` oder `partially-verified`:
   `skill-output-disclaimer` als Pflicht-Zeile in den Citation-Block
   einfuegen (vor oder nach der eigentlichen Quelle, ueber dem Source-URL).
4. Wenn `verified`: optional `skill-output-disclaimer` als Confidence-Note
   einfuegen (kein Pflicht-Disclaimer).
5. Wenn Frontmatter fehlt oder `verification-status` nicht gesetzt:
   File-Pfad als Reminder loggen + Default-Disclaimer drucken
   ("Verifikations-Status nicht annotiert — manuell pruefen").

### Health-Check-Erweiterung (TODO v4.0.0-rc.2)

`scripts/health-check.sh` soll einen 7. Check ergaenzen:

- Pro File unter `references/gesetze/` (ausser INDEX.md): pruefen, dass
  YAML-Frontmatter `verification-status` enthaelt.
- Bei `secondary-source-derived` / `partially-verified`: pruefen, dass
  `skill-output-disclaimer` gesetzt + nicht-leer ist.
- Issue-Counter erhoehen bei fehlenden Feldern.

### Migrations-Status 2026-05-05

37 Files migrated zu Frontmatter-Disclaimer-Pattern. Skipped:

- `EU-Verordnungen/AI-Act-2024-1689/sanktionen-art-99.md` — bereits canonical/verified per Spot-Check
- `KritisDachG/articles.md` — truly skeleton (39 Zeilen, kein konkreter Inhalt)
- `NIS2UmsuCG-BSIG/articles.md` — skeleton-only (Bundestags-Verfahren laufend)
- DGA / DMA / eIDAS / CER / ProdHaftRL / CSDDD / CSRD `articles.md` — alle pure skeleton-only
- `EU-Verordnungen/Data-Act-2023-2854/*` — nicht im Migrations-Scope (separate Tier verified)
- DSA `notice-and-action.md` / `vlop-vlose.md` / `trusted-flaggers.md` / `small-platform-pflichten.md` — nicht im Migrations-Scope (Tier-1 verified bzw. weitere Sub-Files)

Details: lokale Working-Notes (gitignored Operator-Workspace).
