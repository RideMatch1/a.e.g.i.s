# Changelog — brutaler-anwalt

Alle relevanten Aenderungen am Skill werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung folgt [SemVer](https://semver.org/lang/de/).

> Provenance-Disziplin (SKILL.md §5) ist seit v3.0 zero-tolerance.
> Jede neue Az. in `references/bgh-urteile.md` muss eine Source-URL haben
> (Primaerquelle bevorzugt; Sekundaerquelle mit `[secondary-source-verified]`-Tag).

---

## [5.0.2] — 2026-05-06 — Adversarial-Review Drift-Fixes (5 Findings)

> 5 substantive Drifts behoben, die ein P-1-Adversarial-Review-Agent
> (~14min Background-Analyse, 3 unabhaengige Quellen pro Finding) im
> v5.0.0-Inhalt aufgedeckt hatte. Alle Findings live-verifiziert via
> Primaerquellen (gesetze-im-internet.de, dejure.org, dataprotection.ie).

### Behoben (P0 — Mandanten-Memo-blockierend)

- **D-1** § 13 UWG / § 13a UWG paragraph + threshold drift (commit ab7602a):
  v5.0.0-H-4-Self-Inflict. § 13 Abs. 4 wurde mit § 13a verwechselt, MA-
  Schwelle 100 statt 250 fuer DSGVO-/BDSG-Track. Korrektur:
  - § 13 Abs. 4 Nr. 1: KEINE MA-Schwelle (E-Commerce-Info-Pflichten)
  - § 13 Abs. 4 Nr. 2: < 250 MA (DSGVO/BDSG)
  - § 13 Abs. 5: Reverse-Anspruch (KEIN Vertragsstrafen-Cap)
  - § 13a Abs. 2 + Abs. 3 (NEU als eigene Section): < 100 MA-Schutz +
    1.000-EUR-Vertragsstrafen-Cap

- **D-5** Top-50 row #9 Meta 251M date + breach conflation (commit dfd1d4d):
  04.09.2024 → 17.12.2024 (3,5 Mo. off; vermutl. Sept-2024 Meta-Passwort-
  Bussgeld konflatiert). Breach-Scope „533M Profile" → „Datenpannen 09/2018
  (~29M Konten) Art. 25/33 GDPR". Status secondary-only → cross-confirmed.

- **D-2** 9 dead /tdddg/ und /tddg/ URLs → /ttdsg/ (commit ca8e06d):
  BMJ behaelt den TTDSG-URL-Slug trotz Umbenennung 14.05.2024.
  Live-verifiziert via curl: /ttdsg/ HTTP 200, /tdddg/ + /tddg/ HTTP 404.
  9 URLs in 6 Files korrigiert + erklaerender Hinweis bei Volltext-Linien.

### Behoben (P1 — naechste Session)

- **D-3** TTDSG → TDDDG migration completion (commit 79059e3): 5 active
  citations in SKILL.md + 2 in AVV-standard-DE.md (incl. § 16 TTDSG →
  § 16 TDDDG). Trigger-Keywords: tdddg primary, ttdsg als Legacy-Alias
  (per advisor-recommendation fuer Historic-Query-Discoverability).

### Behoben (P2 — Cleanup)

- **C-2** EDPB Guideline-IDs canonicalisiert (commit e09fbf7): 38 unpadded
  IDs (8/2022, 2/2023, 1/2024) → zero-padded (08/2022, 02/2023, 01/2024).
  Verify: 0 unpadded post-replace, 88 zero-padded total.

### Offen (post-v5.0.2)

- **D-4** Duplicate statute structure: gesetze/ + de-statute-tier1/
  beide haben HinSchG/DDG/TDDDG/etc. mit divergierender Inhalte. Keine
  active-drift (beide sind technisch korrekt), aber Drift-Pressure fuer
  zukuenftige Edits. Strukturelle Entscheidung 1-2h — deferred.
- **C-1** Handover-Stat 45/4/1 → 44/5/1: cosmetic, in gitignored
  handover-Datei. Wenn TikTok 530M / CNIL 325M von secondary-only zu
  cross-confirmed promoted: 44/3/1+2 = 47/3/0.

### Hintergrund

P-1-Review-Report durable unter `aegis-precision/v5-adversarial-review-
2026-05-06.md` (gitignored, lokal). 13 substantive verified-OK Spot-
Checks bestaetigen dass Major-Claims ausserhalb dieser 5 Drifts (EuGH-
Schadensersatz-Daten, 1&1-Reduktion, SCC 2021/914-Versions, revDSG-
Cutoff, Stack-Pattern-Code-Syntax, YAML-Frontmatter) verifiziert
korrekt bleiben.

---

## [5.0.1] — 2026-05-06 — Health-check Frontmatter-Validation

Tooling-only patch — keine Inhalts-Aenderungen am Skill-Output.

### Hinzugefuegt

- `scripts/health-check.sh` Section 7: Frontmatter-Validation ueber alle
  167 reference-files mit YAML-Top-Block.
  - **verification-status** Whitelist enforced: `verified`,
    `partially-verified`, `secondary-source-derived`, `az-list-unverified`,
    `skeleton-only` (Zukunfts-Wert; aktuell unbenutzt — bewusst reserviert)
  - **last-checked** / **last-verified** muessen Format `YYYY-MM-DD` matchen
  - **source** muss http(s)-URL sein (YAML-Block-Scalar `|` / `>` skip)
  - **Placeholder-Drift-Detector**: faengt unausgefuelltes `<YYYY-MM-DD>`,
    `<primary-URL>`, `<Quelle>`, `<TBD>` im Frontmatter ab
- Validator parst NUR den ersten YAML-Block (zwischen erstem `---` und
  zweitem `---`); code-fenced template-Bloecke im Markdown-Body werden
  korrekt ignoriert (verhindert false-positives in INDEX/Skeleton-Files).
- Section-Labels von uneinheitlich `X/5` + `X/6` auf einheitlich `X/7`
  renummeriert (Cosmetic-Fix; alte Labels waren post-Section-Insertion-Drift).

### Validiert

- Alle 5 Sub-Checks per fault-injection getestet (invalid-status,
  bad-date, placeholder, non-URL-source, multi-issue-cluster).
- Aktuell **0 Frontmatter-Verstoesse** in 167 geprueften reference-files
  → Skill-Konsistenz post-v5.0.0 verifiziert.

### Hintergrund

Per advisor-recommendation (post-v5.0.0 next-step prioritization) als
P-5 "leichteste Haertung mit hoechstem Drift-Catch-Hebel" identifiziert.
Parallel zur P-1 adversarial-review-Analyse ausgefuehrt — kollidiert nicht
mit Content-Findings, da rein tooling-only.

Commit: af68d63

---

## [5.0.0] — 2026-05-05 — Massive Max-Out: Kanzlei-Tier Layer-Stack

> 4-Agent-Audit-Review + 10 parallel Subagent-Content-Generation +
> 13 Per-Phase-Commits in einer Session. Skill-Wachstum 5.6x in Zeilen
> (5300 → ~30000) und 3.9x in Files (~50 → 195). Operator-Mission:
> "skill so massiv ausbauen dass DE-Tech-Kanzleien ihn als ernsten threat sehen".

### Phase 0 — CRITICAL Drift-Fixes (commit 3387e53)

Sechs substanzielle Drift/Halluzinations-Befunde behoben **bevor** weiter
ausgebaut wurde (verify-not-trust pattern strict applied):

- **C-1**: AI-Act Art. 99 Abs. 5 Sanktion `1,5%` → `1%` in 4 Files
  (VERIFICATION-STATUS-Drift gefixt; vorher nur 1 von 4 sync'd)
- **C-2**: OLG Hamburg Az. typo `5 UKI 1/23` → `5 UKl 1/23` (verifiziert
  via landesrecht-hamburg.de NJRE001588999)
- **C-3**: Phase 5h naming-collision aufgeloest — Art-9-Workflow zu
  Phase 5i, B2C/B2B-Funnel bleibt 5h (chronologische Erstvergabe)
- **C-4**: Goldbärenbarren-Halluzinations-Korrektur — `I ZR 246/15`
  (2014, physikalisch unmoeglich) + `I ZR 125/14` (2014) waren beide
  falsch. Echtes Urteil ist **BGH I ZR 192/12 vom 12.12.2013** (TV-
  Werbung-Kinder, NICHT Werbe-Beigaben/Werbeartikel-Kennzeichnung)
- **C-5**: BGH XI ZR 188/22 Sachverhalt-Mismatch (Bankrecht-NZB, nicht
  FernUSG-Coaching) — Citation entfernt, ersetzt durch bare § FernUSG
- **C-6**: BGH I ZR 169/17 source-URL Copy-Paste-Fix

### Phase 1 — HIGH Drift-Fixes (3 commits)

- **H-1 TTDSG → TDDDG migration** (commit ea285c3): ~26 occurrences in
  7 Files. Historische Kontexte (DSK-OH-2021-Name) bleiben erhalten.
- **H-2**: VERIFICATION-STATUS NIS2 + CRA Re-Klassifikation
- **H-3**: 9 leere Stack-Pattern-Folder fill (commit da07b08)
- **H-4**: § 13 Abs. 4 Nr. 2 UWG (KMU-Schutzschild) + Abs. 4 Nr. 1 +
  Abs. 5 vollstaendig in `gesetze/UWG/paragraphs.md`
- **H-5**: DSFA-template C-300/21 + § 35 BDSG (Schadensersatz-
  Erwartungswert-Tabelle 5 Klassen post-EuGH-Linie)
- **H-6**: SKILL.md Phasen-Liste sync — 5 fehlende Phasen ergaenzt
  (3.5, 3.6, 5d.1, 5g.4, 6b)
- **H-7**: OLG Koeln 6 U 8/22 Pattern-Cleanup
- **H-8**: 37 gesetze-Files Frontmatter-Disclaimer mass-update
  (verified / partially-verified / secondary-source-derived 3-Variant-
  Schema)
- **H-9**: NIS2-Umsetzungsgesetz Datums-Drift (war "in Kraft seit
  Oktober 2024", ist Stand 2026-05-05 noch im Bundestags-Verfahren)

### Phase 2 — Massive Parallel Subagent-Fill (10 Agenten, 7 Phase-Commits)

Strikte provenance-discipline (jede Az./Citation = primary-source-URL
inline, WebFetch-Verification, NIE Modell-Memory).

#### Hinzugefuegt — Tier-1 Content-Layers

**E1 — references/eu-eugh-dsgvo-schadensersatz.md** (commit 112c404)
- 24 verifizierte EuGH-Urteile zu Art. 82 DSGVO (11 Tier-1 + 13 Tier-2)
- 1 NOT_VERIFIED-Eintrag (C-687/23 vermutlich Operator-Tippfehler)
- 2 Datums-Korrekturen vs Operator-Brief
- 22 Use-Case-zu-Urteil-Mapping fuer Skill-Output
- 223 Zeilen

**E2 — references/eu-edpb-guidelines.md** (commit 7e28b8b)
- 41 verifizierte EDPB-Guidelines (Target war 30+)
- 6 Recommendations + 4 Top-Opinions + WP29-Endorsed-Set
- 10-Cluster-Themen-Index
- HALLUZINATIONS-CORRECTIONS direkt im File: Spec hatte 7 nicht-
  existente Guideline-IDs (03/2024, 04/2024, 04/2025, 05/2025,
  06/2025, 04/2023, 05/2023). Agent verifiziert + ausgewiesen
- 505 Zeilen

**E3 — references/de-dsk-beschluesse.md** (commit 4d644f5)
- 29 verifizierte DSK-Beschluesse + Orientierungshilfen in 8 Clustern
  (M365/Cloud, Beschaeftigte/HinSchG/KI, Auskunft/Schadensersatz/
  Bussgeld, Drittland, Cookies/Werbung, Sektor, Data-Breach,
  Standardisierung)
- 7 Spec-Punkte als NOT_VERIFIED gelistet (Halluzinations-Resistance)
- Mapping-Tabelle Audit-Finding zu DSK-Authority-Citations
- 346 Zeilen

**E4 — references/de-aufsichtsbehoerden-taetigkeitsberichte-2024.md** (commit 7e28b8b)
- 5 Behoerden vollstaendig (BfDI 33. TB, BayLDA 14. TB, LfDI BW 40. TB,
  HmbBfDI 33. TB, LDI NRW 30. TB)
- Bussgeld-Statistik 2024 mit Punktzahlen (53/626k LfDI BW;
  20/1,2M HmbBfDI; 12.490 Eingaben LDI NRW)
- 6 Cross-Behoerden-Cluster (KI, Beschaeftigtendaten, Video, Werbe-
  Targeting, Gesundheitsdaten, Loeschfristen)
- 310 Zeilen

**E6 — references/az-auffuellung-batch1.md** (commit 6fa1879)
- 53 voll-verifizierte zusaetzliche Az. in 8 Sektionen (Az.-DB von 87 auf 140+)
- Quality-over-Quantity: 53 voll-verifiziert > 100 sloppy
- Sektion B: BAG-§-26-BDSG + Arbeitszeit + KI inkl. BAG 1 ABR 22/21
  13.09.2022 (Arbeitszeiterfassung-Pflicht post-CCOO)
- Sektion H: AGG-Beweislast bei KI-Tools inkl. BAG 8 AZR 300/24
  Equal-Pay-Paarvergleich
- 5 Az.-Leads explizit als unverifiziert markiert
- 1 Az. (OLG Stuttgart 4 U 157/24) wegen dejure-Negativ-Treffer
  verworfen — dokumentiert als Lesson-Learned
- 468 Zeilen

**E7 — references/templates-avv-layer/** (commit 4151df3)
- 10 Templates, 1861 Zeilen total
- AVV-Standard-DE, AVV-EN-international, SCC-Module-2 + 3,
  UK-IDTA, CH-revDSG-Anhang, TOM-Katalog, Sub-Processor-List,
  Audit-Klausel-Varianten, Joint-Controller-Vertrag Art. 26
- SCC/IDTA als verbatim-uebernehmen-Hinweis markiert (rechtsverbindlich
  Original-Text einbinden, dieser Layer liefert Annexe + Konfigurations-
  Hinweise)

**E8 — references/de-bussgeld-argumentations-layer.md** (commit 4151df3)
- 598 Zeilen, 52 KB
- 11 Bemessungsfaktoren Art. 83 Abs. 2 verbatim
- EDPB Guidelines 04/2022 v2.1 (5-Schritte + Low/Medium/High-Ranges)
- DSK 2019 Bussgeldkonzept (Groessenklassen A-D, Tagessatz)
- EuGH C-807/21 Deutsche Wohnen + LG Bonn 11.11.2020 1&1 (NICHT
  Bertelsmann — Skill-Memory-Drift gefixt)
- 15 Mitigations + 10 Aggravations
- Top-50 EU-Bussgelder strukturiert (45 cross-confirmed, 4 secondary,
  1 primary)
- Verteidigungs-Strategien post-C-807/21
- 6-Block-Skill-Output-Pattern fuer Memo-Generierung

**E9 — references/stack-patterns/{astro,vue,svelte,nest,express,laravel,rails,django,strapi}/** (commit da07b08)
- 9 leere Stack-Folder vollstaendig befuellt: 29 Files, 7406 Zeilen
- Stack-native Code-Snippets (TS/JS/PHP/Ruby/Python)
- 226 placeholder-Marker, 84 Cross-Refs zu Skill-Files, 29 AEGIS-
  Scanner-Cross-Refs
- Schließt Capability-Lueecke aus Audit-Verify-C: Audit gegen non-
  Next.js-Stacks fiel vorher in leere Reference

**E10 — Frontmatter Mass-Update** (commit 7f83392)
- 37 gesetze-Files mit YAML-Frontmatter erweitert
- 3 Varianten: 4 verified, 2 partially-verified, 31 secondary-source-
  derived
- Frontmatter-Schema standardkonform (verification-status +
  skill-output-disclaimer + last-verified)
- VERIFICATION-STATUS.md erweitert um Frontmatter-Disclaimer-Pattern-
  Documentation + Skill-Side-Konsumption-Workflow

#### Hinzugefuegt — DE-Statute Tier-1 Skeleton mit Quarantine-Marker

**E5 — references/de-statute-tier1/** (commit da07b08)
- 25 fehlende DE-Spezialgesetz-Folder als strukturierter Skeleton
- 52 Files (paragraphs.md + audit-relevance.md je Statute) + INDEX.md +
  VERIFICATION-NOTES.md
- 4696 Zeilen
- 25 Statute: HWG, AMG, MPDG, DiGAV, LFGB, GwG, KWG, ZAG, WpHG, ArbZG,
  NachwG, AGG, BetrVG, HinSchG, VVG, PAngV, VerpackG, ElektroG, DDG,
  TDDDG, VDuG, RDG, FernUSG, UrhG-UrhDaG, GeschGehG

**KRITISCHER VERIFIKATIONS-CAVEAT (agent-self-flagged + advisor-
protocol-resolved)**:
- Subagent hatte WebFetch-Issues (gesetze-im-internet.de DNS-unreachable)
- Wortlaut in paragraphs.md ist close-paraphrase (ausser AMG §21+§95
  dejure-verifiziert)
- Top-Az.-Listen in audit-relevance.md sind aus Domain-Wissen erstellt
  und NICHT primary-source-verifiziert
- 1 halluziniertes Az. im Spot-Check erkannt: "BGH 12 ZR 35/23"
  (FernUSG, falsches Az.-Format) — bereits behoben

**Quarantaene-Strategie**:
- Alle 50 Content-Files tragen Frontmatter `verification-status:
  az-list-unverified`
- VERIFICATION-NOTES.md dokumentiert Pre-Integration-Pflicht-Pfad
- Skill-Output-Generator druckt entsprechenden Disclaimer

### Geaendert

- TTDSG -> TDDDG durchgehend in audit-patterns.md, aegis-integration.md,
  bgh-urteile.md, abmahn-templates.md, checklisten.md, dsgvo.md,
  it-recht.md, stack-patterns/INDEX.md (historische Kontexte erhalten)
- VERIFICATION-STATUS.md: NIS2 + CRA + DSA-articles + AI-Act-articles
  von skeleton-only auf secondary-source-derived re-klassifiziert
- SKILL.md Phasen-Liste vollstaendig sync mit audit-patterns.md
- DSFA-template um EuGH-Schadensersatz-Linie + § 35 BDSG-Spezifika
  erweitert
- UWG/paragraphs.md erweitert um vollstaendigen § 13 Abs. 4 Nr. 1 +
  Abs. 4 Nr. 2 + Abs. 5 (KMU-Schutzschild)
- gesetze/UWG/paragraphs.md Audit-Mapping erweitert um KMU-Privileg-
  Eintrag

### Statistik

- **References File-Count**: ~50 -> 195 (3.9x)
- **References Zeilen**: ~5300 -> ~29.581 (5.6x)
- **Top-level reference files**: 11 -> 17
- **Templates**: 13 -> 23 (+10 AVV-Layer)
- **Statute folders**: 28 + 25 neue de-statute-tier1
- **Stack-pattern folders mit content**: 10 -> 19 (alle populiert)
- **Verifizierte Az.-Eintraege**: 63 -> ~140 (87 originale + 53 neue) +
  29 DSK-Beschluesse + 41 EDPB-Guidelines + 5 Behoerden-Berichte +
  Top-50 Bussgelder + ~50 Statute-§§-Listen (Gesamt ~315 distinct
  legal-references mit primary/secondary-source-verifiziert)
- **Halluzinations-Korrekturen direkt im skill dokumentiert**: 6
  (Goldbaerenbarren-Az., 5 UKI/UKl typo, EDPB-Phantom-Guidelines,
  Bertelsmann-vs-1&1-Bussgeld-Memory, XI ZR 188/22 Sachverhalt-Mismatch,
  AI-Act-Sanktionsdrift)

### Acceptance-Kriterien

- Health-check passes nach jedem Commit (13 Commits, alle gruen)
- Scrub-gate clean fuer alle Commits
- Brand-leak-check 0 Treffer in allen neuen Files
- Az.-Provenance-Disziplin durchgesetzt (alle neuen Az. mit Source-URL
  oder explizit als unverifiziert markiert + Frontmatter-Disclaimer)

### Bekannte Luecken (defer auf v5.0.0-rc.2)

- DE-Statute-Tier-1 Top-Az.-Listen: alle az-list-unverified, brauchen
  separaten Verifikations-Cycle gegen juris.de + dejure.org
- DE-Statute paragraphs.md Wortlaut: close-paraphrase, brauchen
  Volltext-Verifikation gegen gesetze-im-internet.de
- 5 Az.-Leads in az-auffuellung-batch1.md: Tenor nur sekundaer-Snippet,
  brauchen Volltext-Check
- C-687/23 EuGH-Az: NOT_VERIFIED, vermutlich Operator-Tippfehler
- Health-check-Erweiterung um Frontmatter-Validation pending v5.0.0-rc.2

### Estimated Pre-Integration-Effort fuer "Kanzlei-fearable":

- Pre-integration-cycle fuer DE-Statute Tier-1 Top-Az.-Listen: 8-12h
- Volltext-Verifikation paragraphs.md: 4-6h
- Battle-Test gegen Test-Mandate (D-Annex-B): 2-3h
- README + Documentation-Bump: 1-2h
- **Total**: 15-23h fuer v5.0.0-rc.2 Stable-Release

---

## [4.2.0] — 2026-05-03 — File-Upload-Compliance + Art-9-Beweis-Workflow + Spa/Wellness-Branche

> Externe Audit-Agent-Uebergaben:
> - File-Upload-Sprint 2026-05-03 (Multi-Step-Form-Konfigurator-Audit, 8 distincte Compliance-Klassen)
> - Art-9-Workflow-Audit 2026-05-03 (Multi-Tenant-Health-SaaS, branchen-uebergreifende Beweispflicht-Patterns)
>
> Az.-Provenance: KEINE neuen Az. ohne Source-URL. Alle Updates nutzen ausschliesslich §-Zitate
> (immer verifizierbar) + ErwGr 35 + bereits in `bgh-urteile.md` verifizierte EuGH/BGH-Az.
> Az.-Recherche-Vorschlaege im Handover-Doc bleiben fuer spaetere Verifikation offen.

### Hinzugefuegt — Section 1: File-Upload-Compliance (Handover-1)

**`references/audit-patterns.md`**:
- Phase 5d.1 DIRECT-FILE-UPLOAD-COMPLIANCE (V4-Sub-Pattern)
  - 11 Pflicht-Checks (Schema-Migration / localStorage / base64-Crash / processFilesPayload / Path-Traversal / SVG-XSS / Filename-PII / Customer-Receipt / Disk-DoS / Email-Cap / VVT)
  - 7 Verify-Commands (curl-Probes + Browser-Tests)
  - 10 Rechts-Anker (Art. 5/13/16/25/30/32 DSGVO + § 202c StGB + BGB § 242)
  - Schadens-Range pro Severity-Klasse
- Phase 4 Drift-Style 4 (AGB-vs-DSE-Tech-Stack-Inkonsistenz)
  - 3 Storage-Implementation-Drift-Verify-Patterns (Object-Storage-Behauptung, LUKS-Behauptung, Bytes-in-DB-vs-Filesystem)
  - Cross-Doc-Konsistenz-Audit-Workflow

**`references/dsgvo.md`**:
- VVT-Trigger-Pattern bei neuen Verarbeitungstaetigkeiten (7 Ausloeser + Pre-Deploy-Gate-Workflow)

**`references/checklisten.md`**:
- Checkliste 12: Direkt-File-Upload Compliance (5 Bereiche, ~28 Items)

**`references/templates/VVT-template-file-upload.md`** (neue Datei):
- Vollstaendiges VVT-Template fuer Direct-File-Upload mit Art. 9-Bewertung + TOMs-Inventar

**`SKILL.md`**:
- Schritt 7 Pre-Anwalt-Architektur-Review-Pattern (Process-Section): Architektur-Review-Pass VOR brutaler-anwalt bei Sprints mit neuen Code-Pfaden

### Hinzugefuegt — Section 2: Art-9-Beweis-Workflow + Spa/Wellness-Branche (Handover-2)

**`references/audit-patterns.md`**:
- Phase 5h ART-9-BEWEIS-WORKFLOW-AUDIT (V4-Pattern, branchen-agnostisch)
  - 5h.1 Beweis-Modi-Audit (3 akzeptierte Modi: Tablet-eES, Papier+Hash, Mitarbeiter-Abtipp+Co-Sig)
  - 5h.2 Crypto-at-Rest-Pflicht (AES-256-GCM, AAD-Binding, Key-Versioning, Recovery-Doc)
  - 5h.3 Aufbewahrungsfristen-Validierung (Wellness 3J / Heilpraktiker 10J / Personenschaden 30J)
  - 5h.4 Audit-Log-Pflicht-Events (create/view/export/revoke/delete-Metadaten/decrypt_failure/scan_hash_mismatch)
  - 5h.5 Falsche-Rechtsgrundlage-Detection (§ 22 BDSG-Misuse-Pattern)
  - 5h.6 Synthesizer-Output mit €-Range (15.000-80.000 KMU-Skala bis 20 Mio EUR / 4%)

**`references/branchenrecht.md`**:
- Neue Sektion „Spa / Wellness / Kosmetik / Massage" (positioniert nach Heilberufe)
  - Branchen-Klassifikations-Tabelle (Wellness / Med-Spa / Aerztlich) mit jeweiliger Rechtsfolge
  - 8 Pflicht-Pruefungen + 7 typische Verstoesse + Az.-Anker (mit `[ungeprueft]`-Marker fuer manuelle Verifikation)
  - Cross-Branche-Hinweise (Hotel-Spa, KI-Auswertung, Online-Booking)

**`references/templates/DSFA-template.md`**:
- Sektion 8 „Spezifika fuer Art-9-Verarbeitungen" (8.1-8.6: Rechtsgrundlage / Beweis-Modi / Crypto-TOMs / Aufbewahrung / Audit-Log / Public-Form-Validierung)

**`references/dsgvo.md`**:
- Verstoss-Tabelle „Haeufige Verstoesse bei Art-9-Verarbeitung" (8 Verstoesse mit konkreten KMU-€-Ranges)

**`SKILL.md`**:
- Schritt 6 Sprint-Workflow (Pre + Re-Audit) im Quick-Start

### Geaendert

- CHANGELOG v4.1 Brand-Leak entfernt (Section-Description anonymisiert auf „DACH-Studio-Brutal-Audit")

### Acceptance-Kriterien

- Re-Audit der File-Upload-Implementation: F1 (AGB-Drift), F4 (Customer-Receipt), F8 (Filename-PII) als verified detektiert
- Re-Audit Art-9-Sprint: alle 8 Beweis-Workflow-Findings durch Phase 5h-Pruefkatalog erfassbar
- Az.-Provenance: 0 ungesourcte neue Az. (alle Updates verwenden nur §-Zitate)

### Bekannte Lucken (defer)

- Az.-Whitelist-Loader als SessionStart-Hook (PR-3 aus v4.1)
- VVT-Pflicht-Check in checklisten.md (PR-5 aus v4.1)
- Server-Log-Retention Cross-Doc-Check (B-009 aus v4.1)
- Performance-Versprechen-Verifikations-Pattern (B-014 aus v4.1)
- Konkrete Az.-Anker fuer Spa/Wellness + Art-9-Beweispflicht (Recherche-Vorschlaege im Handover-Doc — vor Aufnahme in `bgh-urteile.md` primary-source-Verifikation pflicht per SKILL.md HARD-CONSTRAINT §5.e)

---

## [4.1.0] — 2026-05-03 — Brutal-Audit DACH-Studio-Round-2 (15 Skill-Gaps)

> DACH-Studio-Brutal-Audit 2026-05-03 (adversarial agent, 33 Findings).
> Skill-Luecken aus Round-1 (2026-05-02) systematisch geschlossen.

### Hinzugefuegt

**references/audit-patterns.md**:
- Phase 3.5: Marketing↔AGB↔DSE Konsistenz-Audit (PR-1)
  - Trigger-Wording-Diff-Audit mit Grep-Patterns fuer Refund-Trigger, Tarif-
    Inklusivleistungen, Zeit-Versprechen, Performance-Versprechen
  - Cross-Page-Feature-Claim-Audit (VS_OTHERS-Tabellen-Check)
  - Output-Format "DRIFT-STYLE-4"
  - Anlass: B-001 (Anwalt-Pool) + B-003 (Refund-Trigger) im Brutal-Audit 2026-05-03
- Phase 3.6: Az.-Citation-Provenance-Check (PR-2+PR-4)
  - Grep-Pattern fuer alle Az.-Zitate im Repo
  - Whitelist-Check-Regel (Safe/Unverifiziert/Nicht-in-Whitelist/Falsch-Zitierung)
  - Fallback: Gesetzes-§ bei unverifizierbarer Az.

**references/bgh-urteile.md**:
- FALSCH-ZITIERUNGS-REGISTER: BGH I ZR 137/12 als Impressum-Beleg → FALSCH
  (tatsaechlich: Teil-Berufsuebungsgemeinschaft, Medizin-Recht). Brutal-Audit
  2026-05-03 B-033 hat das via WebSearch verifiziert.
- AG Muenchen 142 C 9786/25 (13.02.2026): KI-Logos kein Urheberrechtsschutz.
  Verifiziert via dejure.org, anwalt.de, rewis.io.
- OLG Duesseldorf I-20 W 2/26 (02.04.2026): KI-Bild-Bearbeitung Foto, § 16 UrhG.
  Verifiziert via alro-recht.de.

### Bekannte Lucken (aus 15 Skill-Gap-Items des Brutal-Audits, defer)

- PR-3: Az.-Whitelist-Loader als SessionStart-Hook (MEMORY.md-Integration)
- PR-5: checklisten.md VVT-Pflicht-Check (Art. 30 DSGVO)
- B-009: Server-Log-Retention Cross-Doc-Check
- B-012: DOI-Token-TTL vs. DSE-Angabe Cross-Check
- B-014: Performance-Versprechen-Verifikations-Pattern (Lighthouse-CI gegen Live-URL)
- B-020: VVT-Awareness-Audit (Art. 30 Pflicht-Check in Phase 4)
- B-021: DSB-Erwaehnungs-Audit (Art. 37 Pflicht-Check in Phase 4)

---

## [4.0.0-rc.1] — 2026-05-02 — Million-Euro-Tier-Maxout

> **Release-Candidate** fuer Million-Euro-Tier (HANDOVER-MILLION-EURO-TIER-2026-05-02.md).
> Coverage-Maxout EU/DE-Recht 2024-2026 + Provenance-Skala + Battle-Test Round 1/3.
> NICHT bundle-ready fuer OSS-Release ohne LO-Authorisierung — `secondary-source-derived`
> Files brauchen v4.0.0-rc.2 Primary-Source-Verifikations-Pass.
>
> **Status**: Health-Check 6/6 ✓ · 60 Az. mit 100% Source-Coverage · 3 Findings dokumentiert
> + gefixt · Battle-Test 1-of-5-Apps mit honest defer-note · 14 EU/DE-Verordnungen
> ergaenzt (5 verified + 9 secondary-source-derived) · 23 DE-Spezialgesetze (10 verified
> + 13 secondary-source-derived) · 5 neue Branchen · 10 stack-patterns ergaenzt.

### Phase A — Selbstanalyse (siehe AUDIT-2026-05-02.md)

- 96 Findings dokumentiert (70 Per-File + 12 Gap-vs-Recht + 9 Gap-vs-Praezedenz + 5 Methodik).
- Halt-Condition >=50 mit 96 (Reserve 92%) erfuellt.

### Phase B — Coverage-Maxout

#### B.1 — EU-Verordnungen Tiefe + Komplettierung (5 verified + 9 skeleton)

- `gesetze/EU-Verordnungen/AI-Act-2024-1689/` — 6 detail-Files (`hochrisiko-annex-iii.md`, `gpai-pflichten.md`, `transparenz-art-50.md`, `sanktionen-art-99.md` ✅, `uebergangsfristen.md` ✅, `audit-relevance.md`).
- `gesetze/EU-Verordnungen/DSA-2022-2065/` — 5 detail-Files (`notice-and-action.md` ✅, `trusted-flaggers.md`, `vlop-vlose.md` ✅, `small-platform-pflichten.md`, `audit-relevance.md`).
- `gesetze/EU-Verordnungen/DORA-2022-2554/` — articles.md ✅ + audit-relevance.md.
- `gesetze/EU-Verordnungen/MiCA-2023-1114/` — articles.md (partial-verified) + audit-relevance.md.
- `gesetze/EU-Verordnungen/Data-Act-2023-2854/` — articles.md ✅ + audit-relevance.md.
- `gesetze/EU-Verordnungen/ePrivacy-RL-2002-58/` — articles.md + audit-relevance.md.
- 9 Skeleton-Folder (DMA, DGA, NIS2, eIDAS-2024, CER-RL, ProdHaftRL-2024, CSDDD-2024, CSRD-2022, CRA-2024).

#### B.2 — DE-Spezialgesetze + Tier-1 audit-relevance

- `gesetze/HinSchG/articles.md` ✅ + `gesetze/LkSG/articles.md` ✅ + `gesetze/StGB/relevante-paragraphen.md`.
- `gesetze/JuSchG-JMStV/articles.md` + `gesetze/GlueStV/articles.md` + `gesetze/TKG/articles.md`.
- `gesetze/MedTech/MDR-2017-745.md` + `IVDR-2017-746.md` + `DiGAV.md`.
- `gesetze/Finance/PSD2.md` ✅ + `ZAG.md` + `KWG.md`.
- `gesetze/NIS2UmsuCG-BSIG/articles.md` (skeleton) + `KritisDachG/articles.md` (skeleton).
- 9 Tier-1 audit-relevance.md (DSGVO, BDSG, TDDDG, DDG, BGB, UWG, HGB-AO, VSBG, BFSG).

#### B.3 — Branchenrecht Erweiterung 24 → 29

- 5 neue Sections in `branchenrecht.md`: MedTech/DiGA/Health-Apps, Public-Sector/E-Government, Telekommunikation/VoIP/Messaging, Streaming/Medien/Verlag, Kinder-/Jugendschutz Online.

#### B.4 — Stack-Patterns 7 → 17

- 10 neue Files: nextjs/{env-driven-tracking, dynamic-rendering-headers, api-route-bearer-auth}, react/{cookie-banner-pattern, consent-gate-pattern}, auth/{auth0-tom, clerk-tom}, tracking/{google-analytics-consent, posthog-consent}, ai/{anthropic-dpa}.

#### B-Verify — Spot-Check 12 high-stakes Claims (3 Findings + Korrekturen)

- ✅ AI-Act Art. 99 Stufe 1 (35M/7%), Stufe 2 (15M/3%), Timeline (alle 5 Stichdaten), Data-Act Art. 25 (12.01.2027), DSA Art. 16, DSA VLOP-45M-MAU, DSA Art. 74 (6%), HinSchG (50/250-MA-Schwellen), PSD2 SCA (30 EUR).
- ❌ **AI-Act Art. 99 Stufe 3**: alter Eintrag „1,5%" → korrekt **„1%"** (verifiziert via artificialintelligenceact.eu). Fix angewendet.
- ⚠ **DORA Art. 19 Erstmeldungs-Frist**: alter Eintrag „24h ab Kenntnis" unvollstaendig → vollstaendig **„4h ab Klassifizierung als major UND 24h ab Kenntnis"** (Joint-RTS/ITS JC 2024/33). Fix angewendet.
- ⚠ **MiCA Sanktionen Art. 86**: Modell-Wissen-Drift → Sanktions-Vorschriften sind Art. 111 ff., nicht Art. 86. Spezifische Hoehen-Citation aus dem File entfernt + Hinweis-Marker fuer Primaerquellen-Verifikation. Anwender werden im File explizit aufgefordert, vor Mandanten-Citation Volltext zu pruefen.
- Master-Manifest: `references/gesetze/VERIFICATION-STATUS.md` mit per-File-Status.
- Skill-Output-Regel in SKILL.md §5(f.1) ergaenzt: bei `secondary-source-derived` Pflicht-Disclaimer im Skill-Output.

#### B-Az — Source-Coverage 100% (Health-Check passing)

- 14 EuGH/BGH-Klassiker mit Source-URLs ergaenzt: Schrems II C-311/18, Planet49 C-673/17, Fashion-ID C-40/17, Meta-Plattformen C-252/21, Oesterr. Post C-300/21, Bulg. Steuerbehoerde C-340/21, Auskunftsrecht-Kopie C-487/21, Smartlaw I ZR 113/20, Cookie-Einwilligung I ZR 7/16, DSGVO-Schadensersatz VI ZR 1370/20, Werbeeinwilligung Bestandskunden I ZR 218/19, Druckkostenzuschuss KZR 65/12, Heilmittelwerbung I ZR 232/16, LG Muenchen Google Fonts beide Aktenzeichen.
- 6 Behoerden-Bussgelder mit primaer-quelle-Sources: Notebooksbilliger.de (LfD Niedersachsen 08.01.2021), H&M (Taylor Wessing + LTO Oktober 2020), Deutsche Wohnen (Datenschutz-Berlin PDF 30.10.2019), Meta/Facebook 1,2 Mrd. (DPC Ireland + EDPB 22.05.2023), TikTok 345 Mio. (DPC Ireland 15.09.2023).
- ❌ **Vodafone-9,55-Mio.-Drift** (kritisch): alter Eintrag faktisch falsch. 9,55 Mio. EUR war 1&1 Telecom 2019, NICHT Vodafone. Eintrag in zwei aufgeteilt: 1&1 Telecom 9,55 Mio. (BfDI 2019) + Vodafone 45 Mio. (BfDI 03.06.2025, neuer DE-DSGVO-Rekord).
- 2 Spot-Checks auf den 14 Klassikern bestaetigt: Smartlaw + Planet49 Tenor matchen.
- Health-Check `scripts/health-check.sh` angepasst: Pattern-Sections (`### Wenn ...`) werden nicht mehr als Az. gezaehlt, tolerierte Eintraege (VERDACHT-HALLUZINATION + Verfahren-anhaengig) werden ausgenommen. Status: 60 echte Az. / 59 sourced + 3 toleriert = 0 Issues.

### Phase C (deferred to v4.0.0-rc.2)

5 → 7 Personas (Regulator-Perspective + Fresh-Skeptic) + Schadenshoehen-Kalkulator + Abmahn-Anwalt-DB + Live-Probe-Recipes-Zentralisierung + 7 fehlende Templates.

### Phase D — Battle-Test Round 1/3 (siehe BATTLE-TEST-2026-05-02.md)

- **Round 1**: AEGIS-Repo Selbst-Audit via Phase 5f. 12 Pflicht-Checks → 8 ✅ / 4 ⚠ / 0 ❌. 4 LOW-Findings produziert (RDG-Liability-Klausel, URL-Logging-Pruefung, pentest-Rate-Limit, Reporter-Disclaimer-Konsistenz). Skill-Anwendbarkeit auf OSS-CLI-Scanner bestaetigt.
- **Skill-Lesson**: N/A-Klassifikation pro Check noetig (Static-Mode-Tools haben SSRF/DNS-Rebinding/Rate-Limit als N/A). Lesson in `audit-patterns.md` Phase 5f integriert mit „Anwendbarkeit-Klassifikation"-Section + N/A-Bedingungen + 4-Spalten-Output-Format.
- **Round 2 + 3 (deferred to v4.0.0-rc.2)**: ein Hospitality-AI-Chatbot-Target (Phase 5e) + ein DACH-Brand-Re-Audit-Target (Phase 5g).

### Phase E — Quality-Gates final

- Health-Check `scripts/health-check.sh` erweitert um **6/6 Az-Cross-File-Konsistenz**: detektet bekannte verworfene Az. (OLG Hamm 4 U 75/23) + Halluzinations-Verdaechtige (LG Berlin 16 O 9/22) als aktive Citations (tolerant gegen Provenance-Notes / Lesson-Kontexte / „existiert nicht"-Marker).
- Pipefail-Bug in `grep -v` ohne Match in Subshell gefixt mit `|| true`.
- Status: **6/6 Checks ✓ EXIT 0**.

### Phase F — Sanitize-Pass (vorbereitet, Push pending LO-Auth)

- Brand-Hygiene: 0 Treffer fuer alle bekannten Codenames (Liste in `scripts/health-check.sh` Brand-Leak-Pattern; nicht hier zitieren).
- Templates anonymisiert: 0 Treffer.
- README + LICENSE + CHANGELOG OSS-bundle-ready.
- **NICHT push** ohne LO-Authorisierung (Handover-Hard-Constraint).

### Verification-Status (offen — auf v4.0.0-rc.2)

- B.1/B.2 Files mit `verification-status: secondary-source-derived` Master-Manifest in `references/gesetze/VERIFICATION-STATUS.md`. Empirische Error-Rate Spot-Check: ~25-33%.
- Top-10 neue Az. (C-621/22 IAB Europe, C-634/21 SCHUFA Score, C-26/22 SCHUFA, VI ZR 100/22 Facebook-Scraping, VI ZR 1180/21 Schufa-Auskunftspflicht, OLG Hamburg LAION 2024, C-46/23, C-394/23 Mousse) — defer wegen Halluzinations-Risiko bei Batch-Add aus Modell-Wissen (entspricht Vodafone/1&1-Drift-Lesson). Pflicht: primary-source pro Az. einzeln verifizieren.
- Phase D Round 2 + 3 — defer auf separate Sessions mit Live-Probe-Tools.
- Phase C komplett (7 Personas + Sub-Module + 7 Templates) — defer.

---

## [Unreleased] — Phase B Coverage-Maxout (2026-05-02) — EU/DE-Recht 2024-2026

Phasen B.1-B.4 der `HANDOVER-MILLION-EURO-TIER-2026-05-02.md`-Roadmap abgeschlossen.
Phase E.1 als Pre-Phase-B-Gate: Health-Check Brand-Leak-Check jetzt 0 Treffer.

### Added (Phase E.1 — Pre-Phase-B-Cleanup)
- 5 Cross-File-Drifts gefixt (F-001 Brand-Leak + F-008/F-088 OLG Hamm-Az.-Drift in 2 Files + F-013/F-089 LG Berlin-Az.-Drift + F-042 TMG/DDG-Datums-Drift).

### Added (Phase B.1 — EU-Verordnungen)
- `gesetze/EU-Verordnungen/AI-Act-2024-1689/` — 6 detail-Files (hochrisiko-annex-iii.md, gpai-pflichten.md, transparenz-art-50.md, sanktionen-art-99.md, uebergangsfristen.md, audit-relevance.md).
- `gesetze/EU-Verordnungen/DSA-2022-2065/` — 5 detail-Files (notice-and-action.md, trusted-flaggers.md, vlop-vlose.md, small-platform-pflichten.md, audit-relevance.md).
- `gesetze/EU-Verordnungen/DORA-2022-2554/`, `MiCA-2023-1114/`, `Data-Act-2023-2854/`, `ePrivacy-RL-2002-58/` — articles.md + audit-relevance.md je Folder.
- 9 Skeleton-Folder mit defer-markers (DMA, DGA, NIS2, eIDAS-2024, CER-RL, ProdHaftRL-2024, CSDDD-2024, CSRD-2022, CRA-2024).

### Added (Phase B.2 — DE-Spezialgesetze)
- `gesetze/HinSchG/articles.md`, `LkSG/articles.md`, `StGB/relevante-paragraphen.md` (§§ 202a-d, 263a, 269, 303a-b), `JuSchG-JMStV/articles.md`, `GlueStV/articles.md`, `TKG/articles.md`.
- `gesetze/MedTech/MDR-2017-745.md`, `IVDR-2017-746.md`, `DiGAV.md`.
- `gesetze/Finance/PSD2.md`, `ZAG.md`, `KWG.md`.
- `gesetze/NIS2UmsuCG-BSIG/articles.md`, `KritisDachG/articles.md` (Skelette, Bundestags-Abstimmungen ausstehend).
- 9 Tier-1 audit-relevance.md (DSGVO, BDSG, TDDDG, DDG, BGB, UWG, HGB-AO, VSBG, BFSG).

### Added (Phase B.3 — Branchenrecht)
- 5 neue Branchen-Sections in `branchenrecht.md`: MedTech/DiGA/Health-Apps, Public-Sector/E-Government, Telekommunikation/VoIP/Messaging, Streaming/Medien/Verlag, Kinder-/Jugendschutz Online.

### Added (Phase B.4 — Stack-Patterns)
- 10 stack-patterns: nextjs/{env-driven-tracking, dynamic-rendering-headers, api-route-bearer-auth}, react/{cookie-banner-pattern, consent-gate-pattern}, auth/{auth0-tom, clerk-tom}, tracking/{google-analytics-consent, posthog-consent}, ai/{anthropic-dpa}.

### Fixed (Phase B-Verify — High-stakes-claims-Spot-Check 2026-05-02)
- **AI-Act Art. 99 Stufe 3 Sanktion**: Mein File `sanktionen-art-99.md` zitierte „1,5%" globaler Jahresumsatz. **Korrekt = 1%** (verifiziert via artificialintelligenceact.eu DE-Volltext + EN-Volltext). Fix angewendet.
- **DORA Art. 19 Erstmeldungs-Frist**: File hatte „max. 24h ab Kenntnis" — unvollstaendig. **Vollstaendig = spaetestens 4h ab Klassifizierung als „major" UND max. 24h ab Kenntnisnahme** (Joint-RTS/ITS JC 2024/33). Frist mit NIS2 harmonisiert. Fix angewendet.

### Verification-Status (offen — markiert in jeweiligem Frontmatter)
- B.1/B.2 Files enthalten weitere unverifizierte Modell-Wissen-Claims (article numbers, dates, sanctions). Spot-Check 12 high-stakes Claims durchgefuehrt: AI-Act Art. 99 (Stufen 1+2 ✅, Stufe 3 ❌ 1.5%->1% gefixt), AI-Act Timeline ✅, Data-Act Art. 25 ✅, DORA Art. 19 (unvollstaendig — 4h-Klassifizierungs-Frist ergaenzt), DSA Art. 16 ✅, MiCA Art. 86 vs Art. 111 ❌ (Sanktions-Spezifika entfernt, Hinweis-Marker), DSA VLOP-45M-MAU ✅, HinSchG 50/250 ✅, LkSG § 24 (vollstaendiger Tabelle mit 400M-Schwelle), DSA Art. 74 6% ✅, PSD2 SCA 30 EUR ✅. Empirische Error-Rate ~25-33%.
- Master-Manifest: `references/gesetze/VERIFICATION-STATUS.md` mit per-File-Status (verified / secondary-source-derived / skeleton-only).
- Skill-Output-Regel in SKILL.md §5(f.1) ergaenzt: bei `secondary-source-derived` Pflicht-Disclaimer im Output.

### Added (Phase B-Az — Source-Coverage)
- 14 EuGH/BGH-Klassiker mit Source-URLs ergaenzt: Schrems II C-311/18, Planet49 C-673/17, Fashion-ID C-40/17, Meta-Plattformen C-252/21, Oesterr. Post C-300/21, Bulg. Steuerbehoerde C-340/21, Auskunftsrecht-Kopie C-487/21, Smartlaw I ZR 113/20, Cookie-Einwilligung I ZR 7/16, DSGVO-Schadensersatz VI ZR 1370/20, Werbeeinwilligung Bestandskunden I ZR 218/19, Druckkostenzuschuss KZR 65/12, Heilmittelwerbung I ZR 232/16, LG Muenchen Google Fonts beide Aktenzeichen.
- 6 Behoerden-Bussgelder mit primaer-quelle-Sources: Notebooksbilliger.de (LfD Niedersachsen), H&M (Taylor Wessing + LTO), Deutsche Wohnen (Datenschutz-Berlin PDF), Meta/Facebook 1,2 Mrd. (DPC Ireland + EDPB), TikTok 345 Mio. (DPC Ireland).
- **Korrektur Vodafone-Drift**: alter Eintrag „Vodafone 9,55 Mio. €" war faktisch falsch (das war 1&1 Telecom). Eintrag in zwei aufgeteilt: 1&1 Telecom 9,55 Mio. (BfDI 2019) + Vodafone 45 Mio. (BfDI 03.06.2025, neuer DE-DSGVO-Rekord).
- **2 Spot-Checks** auf den 14 Klassikern bestaetigt: Smartlaw + Planet49 Tenor matchen WebSearch-Treffer.
- **Health-Check** angepasst (`scripts/health-check.sh`): Pattern-Sections (`### Wenn ...`) werden nicht mehr als Az. gezaehlt, tolerierte Eintraege (VERDACHT-HALLUZINATION + Verfahren-anhaengig) werden ausgenommen. Status: 60 echte Az. / 59 sourced + 3 toleriert = **0 Issues**.

### Deferred to v4.0.0-rc.2
- Top-10 neue Az.: C-621/22 IAB Europe, C-634/21 SCHUFA Score, C-26/22 SCHUFA, VI ZR 100/22 Facebook-Scraping, VI ZR 1180/21 Schufa-Auskunftspflicht, OLG Hamburg LAION 2024, C-46/23, C-394/23 Mousse, etc. Reason: primary-source-Verifikation pro Az. Pflicht — kein Batch-Add aus Modell-Wissen (entspricht Lesson aus Vodafone/1&1-Drift).
- Vollstaendige Primaerquellen-Verifikation aller B.1/B.2 `secondary-source-derived` Files.

---

## [Unreleased] — Phase A Audit (2026-05-02) — Million-Euro-Tier-Selbstanalyse

Phase A der `HANDOVER-MILLION-EURO-TIER-2026-05-02.md`-Roadmap abgeschlossen.
Strikte Selbstanalyse, KEINE Fixes — Output ist `AUDIT-2026-05-02.md`.

### Added
- `AUDIT-2026-05-02.md` — Phase-A-Selbstanalyse mit 96 dokumentierten Findings:
  - 70 in A.1 Per-File-Audit (35 References einzeln auseinandergenommen)
  - 12 in A.2 Gap-Liste vs. 2024-2026 EU/DE-Recht (DMA / DGA / Data Act / CRA / eIDAS 2.0 / MiCA / DORA / CER-RL / ProdHaftRL / CSDDD / CSRD fehlen komplett; AI-Act / DSA nur basic)
  - 9 in A.3 Gap vs. aktuelle Praezedenzfaelle (29 unsourced Az. + 11 EuGH + 6 BGH + 9 OLG/LG aus Mindest-Set fehlen; 200+ Az.-Ziel)
  - 5 in A.4 Methodik-Luecken (5->7 Persona, Schadenshoehen-Kalkulator, Abmahn-Anwalt-DB, Live-Probe-Recipes-Zentralisierung, Health-Check-Erweiterungen)
- Halt-Condition aus Handover (>=50 Findings) erfuellt mit 96 (Reserve 92%).

### Documented (nicht gefixt — fix-Gate Phase B+)
- Brand-Leak in `audit-patterns.md` Z. 681 (Domain-Nennung eines frueheren Audit-Targets) (F-001)
- Cross-File-Drift `OLG Hamm 4 U 75/23` (verworfen, aber in 3 Files noch zitiert: `bgh-urteile.md` Patterns-Section, `audit-patterns.md` Phase 5g, `strafrecht-steuer.md` Z. 181) (F-008+F-088)
- Cross-Section-Drift `LG Berlin 16 O 9/22` (in `bgh-urteile.md` als Halluzination markiert, aber Patterns-Section Z. 360 zitiert noch) (F-013+F-089)
- Aktualitaet-Drift `it-recht.md` Z. 12 ("TMG bis 28.5.2024 gueltig" = falsch, korrekt 13.05.2024) + Z. 247 (AI-Act-Daten ungenau) (F-042+F-043)

### Priorisierungs-Empfehlung
- Phase E.1 (Pre-Phase-B-Gate): Brand-Leak + 4 Cross-File-/Aktualitaet-Drifts fixen, damit Health-Check 0 Issues meldet bevor Phase-B-Coverage-Arbeit startet.
- Phase B.1: AI-Act-Tiefe + DSA-Tiefe + DORA + MiCA + Data Act zuerst (Anwendbarkeit-Aktualitaet 2024-2025).
- Phase C: 7-Persona + Schadenshoehen-Kalkulator + Abmahn-Anwalt-DB.
- Phase E (final): Source-Coverage 100% (29->0 unsourced) + Az.-Set 66->200+ + Health-Check-Erweiterungen.

---

## [Unreleased] — Roadmap zu v4.0.0

Naechste Schritte (mehrere Sessions, siehe `MAXOUT-PROGRESS.md` falls vorhanden):

- [ ] `references/gesetze/` — strukturierte Auszuege fuer leere Folders (HinSchG, NIS2UmsuCG-BSIG, KritisDachG, StGB §§ 202a-d, ePrivacy-RL, DMA, ODR, eIDAS, StPO, IHK-DSK-EDSA-Guidelines) + 6 audit-relevance.md fuer befuellte Folder (BDSG, TDDDG, DDG, BGB, HGB-AO, UWG, VSBG, BFSG)
- [ ] `references/stack-patterns/` — 22 weitere Files: vue/, astro/, laravel/, rails/, django/, express/, nest/, strapi/ (frameworks), auth/auth0+clerk+custom-jwt, payment/paddle+mollie+lemonsqueezy+paypal, tracking/google-analytics+posthog+umami+mixpanel+fathom, ai/anthropic-dpa+replicate+self-hosted-llm, react/cookie-banner+consent-gate, nextjs/env-driven-tracking+dynamic-rendering+api-bearer-auth
- [ ] `references/bgh-urteile.md` Source-URL-Coverage 39/67 → 67/67 (28 Az. ohne Source pflegen, primary-source bevorzugt; nach v3.3.0-Spot-Check sind Halluzinations-Verdaechtige bereinigt)
- [ ] `references/abmahn-templates.md` — DSA-Notice + BFSG-Anhoerung + AI-Act-Behoerden-Anhoerung + Crypto-MiCA + HinSchG
- [ ] `references/aegis-integration.md` — Update auf AEGIS v0.17.x Module-Map
- [ ] `references/international.md` — Schweiz nFADP (revDSG) + Oesterreich DSG-Layer + Liechtenstein
- [ ] `references/vertragsrecht.md` — § 312k Pflicht-Klauseln-Komplettliste + FairVertrG 2022 + B2B vs B2C Abgrenzungs-Pattern
- [ ] `references/strafrecht-steuer.md` — § 202a-d StGB Volltext + GoBD-Praxis
- [ ] OSS-Release als MIT-Submodule unter AEGIS-Repo (User-authorized)
- [ ] OOC-Anti-Overfit-Verification (cross-project audit comparison)

---

## [3.4.0] — 2026-05-01 — Audit-Korrektur + Live-E2E-Verify-Lessons

Erweiterungen aus dem Live-Fix-Cycle desselben Audit-Targets (eine Session
nach v3.3.0). Skill wird jetzt durch echten End-to-End-Verify gehaertet,
nicht mehr nur durch statische Audit-Pattern.

### Changed
- **audit-patterns.md Phase 5g DKIM-Check** auf Multi-Selector-Pattern erweitert.
  Ehemalige Pflicht-Annahme „TXT auf `default._domainkey` ist Standard" hat
  bei All-Inkl-Hosting einen False-Positive produziert: All-Inkl generiert
  beim DKIM-Aktivierungs-Klick einen eigenen Selector im Format
  `kasYYYYMMDDHHMMSS._domainkey`, der einen Wildcard-CNAME `*._domainkey` durch
  Specific-over-Wildcard-Regel ueberschreibt. Lesson: NIE nur `default` testen,
  sondern (1) sample-mail-header `DKIM-Signature: ... s=<selector> ...` lesen,
  (2) mit DIESEM Selector `dig +short TXT <selector>._domainkey.<domain>`,
  (3) Multi-Selector-Probe als Fallback (`default`, `mail`, `s1`, `k1`,
  `kas...`, `selector1`, `google`).

- **bgh-urteile.md** Audit-Korrektur: Finding "DKIM defekt" wurde im operativen
  Audit-Re-Run zum FALSE-POSITIVE umklassifiziert nach DNS-Sicht-Klärung
  (User-Screenshot zeigte korrekten DKIM-TXT-Record auf hoster-spezifischem
  Selector). Das ist eine wertvolle Lesson für brutaler-anwalt-Skill:
  audit-side-Verify per `dig` allein ist nicht ausreichend — Operator-DNS-
  Settings-View ist die definitive Quelle.

### Added
- **audit-patterns.md Phase 5g** Operator-View-Pflicht-Check ergaenzt:
  „Bei DKIM-Verdacht NICHT nur `dig`, sondern auch Operator-DNS-Settings-View
  einsehen — Specific-over-Wildcard-CNAME-Konstellationen koennten den
  `dig`-Output verschleiern."

- **NEUER Pattern in audit-patterns.md Phase 5d Origin-Strict-Match**: Multi-
  Surface-Regression-Discovery. Im Live-Fix-Cycle wurden 3 weitere API-Routes
  (`contact`, `widerruf`, `consent-log`) mit demselben startsWith-Origin-Bug
  entdeckt — ueber den initial-gepruefte newsletter hinaus. Skill-Pflicht-
  Check: `grep -rEn "function isValidOrigin|origin\.startsWith" src/app/api/
  src/lib/` — alle API-Routes muessen einen einzigen shared validator
  importieren, **kein** lokal-defined Variant.

- **NEUER Pattern Phase 5d File-Storage in Production-Container**:
  process.cwd()-basiertes File-Storage funktioniert lokal, kann aber in
  Docker-Production-Container schreib-Permissions failen. Pflicht: Default-
  Path mit `os.tmpdir()` als Production-Fallback + ENV-Override fuer
  persistent volume. Detail: in audit-patterns.md Phase 5d „Folder-/Slug-
  Sanitization"-Zeile bei Bedarf erweitern.

- **NEUER Pattern Phase 5g granulare Try-Catch**: Newsletter-DOI-Endpoint
  hatte initial einen Bug — kein granulares Try-Catch um Mail-Send,
  resultiert in HTTP 500 wenn Mail fail. Best-Practice: Persist-Fail = 500
  (User soll nicht denken Anmeldung war OK), Mail-Fail = 200 + Log + retry-
  Moeglichkeit (User kann erneut anmelden). Beispiel-Vorbild: konfigurator/
  route.ts mit try-catch um sendKonfiguratorEmails.

### Skill-Lesson auf Meta-Ebene
**Static-Audit + Live-E2E-Verify ist ein Pflicht-Paar.** Static-Audit allein
produziert False-Positives (DKIM-Wildcard-CNAME-Verschleierung) UND uebersieht
Multi-Surface-Regressions (3 weitere Origin-Bugs). Brutaler-anwalt-Skill v3.4
empfiehlt jetzt explizit: nach jedem Audit ein End-to-End-Verify am echten
Live-System mit echten Test-Tokens / Test-Mails / DNS-Probes.

### AGB-Audit-Pattern (NEU in audit-patterns.md Phase 4 vorgeschlagen für v3.5)
Der gleiche Audit-Cycle deckte 4 AGB-Inkonsistenzen + 3 fehlende state-of-the-
art-Klauseln auf. Skill-Erweiterung fuer naechste Version: Phase 4 DSE-Drift-
Audit-Matrix sollte um „AGB-Konsistenz-Pass" erweitert werden mit Pflicht-
Pruefungen:
- Frist-Konflikt-Check (mehrere Werktage-/Kalendertage-Fristen — wann genau, was triggert)
- Zahlungs-Reihenfolge-Check (Vor/nach Vertragsunterschrift, vor/nach Demo)
- Rücktrittsrecht-vs-Mängelrechte-Verhältnis-Klausel (B2B parallel-Schutz)
- Höhere-Gewalt-Klausel (Drittanbieter-Ausfälle: Hosting/CDN/Email/AI)
- KI-Verordnung-Art.-50-Klausel (ab 02.08.2026 Pflicht für KI-Inhalte)
- Preisanpassungs-Klausel mit CPI-Cap (BGH XI ZR 26/20-konform)

---

## [3.3.0] — 2026-05-01 — Audit-driven Maxout (DACH-Brand-Audit)

### Added
- **audit-patterns.md** Phase 5d — KONFIGURATOR-/MULTI-STEP-FORM-AUDIT: 14 Pflicht-Checks (Origin-Strict, Honeypot, CSRF, Rate-Limit, Zod, Server-Pricing, Folder-Sanitization, File-Upload-Polyglot, PII-Pre-Submit-Hygiene, DSE-Konfigurator-Block, TTL-Loesch-Konzept, Eingangsbestaetigung, Pre-DSGVO-Hinweis, Email-Pflichtfeld-Trennung) + 6 Verify-Curl-Probes + Az.-Anker.
- **audit-patterns.md** Phase 5e — AI-CHATBOT-/LLM-DSGVO-AUDIT: 14 Pflicht-Checks (Vendor-AVV/DPA, Drittland-DSE, Pre-Consent-Loading, Prompt-Logging-Doku, PII-Auto-Redaction, Auskunftsrecht-Routing, System-Prompt-Anti-Leak, Prompt-Injection-Defense, AI-Act-Transparenz, Anti-Hallucination-Disclaimer, Response-Filter, Rate-Limit, Origin-Check, Konversations-TTL, Children-Schutz) + 5 Verify-Curl-Probes + Az.-Anker (Art. 50 EU AI Act).
- **audit-patterns.md** Phase 5f — SCANNER-/AUDIT-TOOL-SELBST-AUDIT: 12 Pflicht-Checks (RDG-Disclaimer, FP/FN-Liability, Eingabe-URL-Logging, Active-Probes-Authorisierung, SSRF-Defense, DNS-Rebinding-Defense, Rate-Limit, Output-Sanitization, Drittstellen-Hinweis, FP/FN-Tracking, User-Consent-Hinweis, Output-Disclaimer-pro-Finding) + 5 Verify-Curl-Probes + Az.-Anker (BGH I ZR 113/20 Smartlaw, § 202a-c StGB).
- **audit-patterns.md** Phase 5g — EMAIL-/SMTP-OUTBOUND-COMPLIANCE-AUDIT: 6 Mail-Authentifizierungs-Checks (SPF/DKIM-TXT-NICHT-CNAME/DMARC-mit-Reporting/BIMI/MX/Reporting-Adresse) + 12 Outbound-Compliance-Checks (3rd-Party-AVV, IP-Reputation, Bestandskunden, DOI, Bestaetigungs-Mail-Werbung, Unsubscribe, List-Unsubscribe-Header, Footer-Impressum, Consent-Beweis-Doku, Cold-Outreach, Bounce-Handling, TLS) + 7 Verify-Commands (dig + nc + Inbox-Header-Check) + Az.-Anker.

### Changed
- **SKILL.md** §5(c) Halluzinations-Indikatoren erweitert um V3.3-Lesson: WebSearch-Treffer mit „aehnlichem Sachverhalt" sind NICHT ausreichend — Pflicht-WebFetch zur Az.-Volltext-Verifikation. Anlass: Audit 2026-05-01 entdeckte 2 Halluzinationen (OLG Hamm 4 U 75/23 + LG Berlin 16 O 9/22). Beide WebSearch-Vorschlaege waren initial falsch — erst WebFetch-Volltext zeigte korrektes Az. (OLG Hamm 11 U 88/22, 20.01.2023, lennmed.de Source).
- **bgh-urteile.md** OLG Hamm 4 U 75/23 → ersetzt mit verifiziertem **OLG Hamm 11 U 88/22 (20.01.2023)** + Source lennmed.de + Provenance-Note.
- **bgh-urteile.md** LG Berlin 16 O 9/22 → markiert als VERDACHT-HALLUZINATION + auf BGH I ZR 218/07 + § 7 UWG-Rechtsprechung umgeleitet.
- **bgh-urteile.md** KG Berlin 5 U 87/19 Duplikat konsolidiert (eine Section mit secondary-source-verified Source bleibt).
- **branchenrecht.md** neue Branche **Webdesign-Agentur / Marketing-Agentur** (post-2026-05-01-Audit-Lessons): 11 Pflicht-Checks + Trigger + Az.-Anker (BGH I ZR 113/20, I ZR 218/07, I ZR 161/24, OLG Hamm 11 U 88/22).
- **scripts/health-check.sh** pipefail-Bug gefixt: `grep -l` mit no-match → exit 1 propagiert mit `set -euo pipefail` → Script abbruch. Fix: Subshell + `|| true` + Klammern. Brand-Leak + Templates-Check liefern jetzt korrekt 0 Treffer.

### Audit-Validierung (battle-tested 2026-05-01)
Phasen 5d/5e/5f/5g auf einer Live-DACH-Brand-Site (Webdesign-Agentur, B2B-primaer, Konfigurator + Mistral-Chatbot + AEGIS-Scanner) angewandt. Ergebnis: **10 Findings produziert** (3 KRITISCH: Newsletter-Single-Opt-In + DSE-Drift + Newsletter-Origin-Bug + DKIM-CNAME-Defekt; 3 HOCH: DMARC-`p=none` + BFSG-Pflicht-Seite-404 + CSP-frame-src-Maps-Drift; 4 NIEDRIG/MITTEL). DEVIL'S ADVOCATE ergaenzte Sammelklage-Vektor + AI-Act-Future-Pflicht. LIVE-PROBE-Matrix: 17 PASS / 4 FAIL / 1 not-tested. Phase 5g war highest-ROI mit 3 hochwertigen Findings (DKIM/DMARC/Newsletter-SOI). Audit-Output liegt operator-side im jeweiligen Repo-`strategy/`-Folder.

---

## [3.2.0] — 2026-05-01 — Sanitization + OSS-Release-Vorbereitung

### Added
- `references/templates/` mit 11 anonymisierten Snippets:
  - `DSFA-template.md`, `VVT-template.md`, `COMPLIANCE-AUDIT-TRAIL-template.md`
  - `AffiliateDisclaimer.tsx.example`
  - `proxy-strict-dynamic.ts.example`
  - `data-retention-cron.ts.example`, `data-retention-workflow.yml.example`
  - `UmamiScript.tsx.example`, `security.txt.example`
  - `DSE-Section-UGC.md.example`, `LostFoundReportForm-consent.tsx.example`
- `CHANGELOG.md` (diese Datei)
- `README.md` mit RDG-Disclaimer + Install-Hinweisen + Contribution-Guidelines
- `LICENSE` (MIT)

### Changed (Sanitization — brand-agnostisch)
- `audit-patterns.md`: 11 brand-spezifische Refs auf generic Lessons-Bezeichner umgestellt (`operativ-Audit 2026-04-27`, `V3.1-Audit-Vorfall 2026-04-30`, `UGC-Plattform-Audit 2026-05-01`).
- `SKILL.md` §5(a) + §5(g): Brand-Refs durch neutrale Beschreibung ersetzt.
- `dsgvo.md`, `checklisten.md`, `branchenrecht.md`, `bgh-urteile.md`,
  `aegis-integration.md`: alle internen Codenamen entfernt.
- Lehrbuch-Beispiele auf `references/templates/`-Pfade umgebogen statt direkt
  konkrete Operator-Repos zu zitieren (Strategie: teaching-value erhalten,
  Operator-Identitaet entfernen).

### Migrationspfad fuer abhaengige Skills
- Wer auf `compliance/DSFA-2026.md` / `compliance/VVT-2026.md` /
  `<operator-customer-build>/src/proxy.ts` o.ae. Pfade in vorherigen
  Skill-Versionen verlinkt hatte: bitte auf
  `references/templates/DSFA-template.md` /
  `references/templates/VVT-template.md` /
  `references/templates/proxy-strict-dynamic.ts.example` umstellen.

---

## [3.1.0] — 2026-05-01 — V3.1-Lessons + UGC-PII-Audit

### Added
- `audit-patterns.md` Phase 5c — UGC-PUBLIC-PII-AUDIT (post-V3.1-Audit-Lessons): 6-stufige Pflicht-Checks fuer Vermisst-/Marketplace-/Forum-Plattformen.
- `audit-patterns.md` Phase 5b — BFSG-AUDIT (B2C E-Commerce, BFSG seit 28.06.2025).
- `audit-patterns.md` Phase 6b — Deployment-Codename-Leak-Check (CSP / Public-Text / Repo-Grep, 3 Surfaces).
- `audit-patterns.md` Stand-Datum-Hygiene-Check.
- `dsgvo.md` DSFA-Trigger-Liste + VVT-KMU-Best-Practice.
- `checklisten.md` Checkliste 3b AGB-B2C Pflicht-Klauseln-Komplettliste + Checkliste 3c Affiliate.
- `bgh-urteile.md` EuGH C-131/12 Google Spain + BGH I ZR 169/17 (§ 36 VSBG).

### Changed
- SKILL.md §5(g): V3.1-Lessons (Pre-Deploy-Gate, Verify-Command-Pflicht bei DSE-Aenderungen mit operativer Dimension, Code-Var-Names-Verbot in Public-Text).

---

## [3.0.0] — 2026-04-30 — Az.-Provenance zero-tolerance

### Changed
- SKILL.md §5: Az.-Provenance-Pflicht eingefuehrt (zero-tolerance fuer halluzinierte Az.).
- `bgh-urteile.md`: Source-Pflicht — jeder Eintrag braucht Source-URL.
- 6 halluzinierte Az.-Nummern aus geshipptem Compliance-Doc entfernt + per follow-up-commit nach Primaerquellen-Verifikation korrigiert.

---

## [2.0.0] — 2026-04-29 — V3 mit DSE-Drift-Audit

### Added
- DSE-Drift-Audit-Matrix (Style 1 Auslassung + Style 2 Falschangabe) in `audit-patterns.md` Phase 4.
- 8-Phasen-HUNTER-Workflow.
- Multi-Container-Shared-Host-Risiko-Pattern.

---

## [1.0.0] — 2026-04-27 — Initial brutaler-anwalt

### Added
- Adversarial Multi-Persona-Modell: HUNTER + CHALLENGER + SYNTHESIZER.
- 4 Modi: SCAN / HUNT / SIMULATE / CONSULT.
- Reference-Files: `audit-patterns.md`, `dsgvo.md`, `it-recht.md`,
  `vertragsrecht.md`, `checklisten.md`, `branchenrecht.md`, `bgh-urteile.md`,
  `abmahn-templates.md`, `aegis-integration.md`, `international.md`,
  `strafrecht-steuer.md`.
- AEGIS-Integration (Mapping AEGIS-Findings → Anwalts-Kritikalitaet).
- RDG-Disclaimer-Pflicht im Output.
