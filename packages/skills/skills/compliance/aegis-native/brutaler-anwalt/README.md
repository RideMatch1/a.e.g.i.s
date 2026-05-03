# brutaler-anwalt

> Adversarial DE/EU Compliance-Auditor fuer Web-/SaaS-Projekte.
> Multi-Persona-Self-Verification (HUNTER + CHALLENGER + SYNTHESIZER + DEVIL'S
> ADVOCATE + LIVE-PROBE) gegen False-Positives + uebersehene Risiken.
> Sachlich-praezise Schadens-Diagnose mit %-Wahrscheinlichkeit, €-Range, §-Beleg
> und Az.-Source-URL.

**License:** MIT
**Version:** 4.2.0 (siehe [`CHANGELOG.md`](./CHANGELOG.md))
**Status:** File-Upload-Compliance + Art-9-Beweis-Workflow + Spa/Wellness-Branche integriert.
Health-Check 6/6 ✓ · 60 Az. mit 100% Source-Coverage · 14 EU/DE-Verordnungen + 23 DE-Spezialgesetze + 17 stack-patterns.
**`secondary-source-derived`-Files in `references/gesetze/` brauchen Primary-Source-Verifikation
vor Mandanten-Citation** (siehe `references/gesetze/VERIFICATION-STATUS.md`).

---

## ⚠️ Disclaimer (RDG)

Dieser Skill ist eine **technisch-indikative Compliance-Pruef-Hilfe**.
Er ist **keine Rechtsdienstleistung** im Sinne von § 2 RDG
(BGH I ZR 113/20 Smartlaw, 09.09.2021) und ersetzt **nicht** die Beratung
durch einen zugelassenen Rechtsanwalt fuer IT-/Datenschutzrecht.

Fuer verbindliche Auskuenfte zu konkreten Sachverhalten ist anwaltliche
Beratung erforderlich. Az.-Belege im Output muessen vor Verwendung in
Schriftsaetzen anwaltlich gepruefte Primaerquellen sein (siehe SKILL.md §5
Az.-Provenance-Pflicht).

---

## Was der Skill kann

### Pflicht-Audit-Surfaces

- **Header-Audit** (HSTS, CSP, Referrer-Policy, Permissions-Policy)
- **HTML-Live-Probe** (Cookie-Banner, Mixed-Content, Public-Static-Files)
- **Impressum-Audit** (§ 5 DDG)
- **DSE-Audit** (DSGVO Art. 13, Drittland, AVV, Drift-Style 1+2)
- **Cookie-/Consent-Audit** (§ 25 TDDDG)
- **Branchen-Layer** (BORA, HWG, LMIV, MPDG, GlueStV, JuSchG, FernUSG, ...)
- **CSP-Code-Cross-Check** (3-Surface-Pattern: Repo + CSP-Header + Public-Text)
- **UGC-PII-Audit** (Public-Profile, Marketplace, Lost-Found)
- **AGB B2C** (Pflicht-Klauseln-Komplettliste)
- **BFSG** (B2C E-Commerce ab 28.06.2025)
- **GoBD/AO** (Aufbewahrungs-Cron + Compliance-Frist 6/10 Jahre)
- **Auth-Flow** (bcrypt-cost, MFA, Audit-Log, Session-Cookie-Attribute)
- **Newsletter-DOI** (Confirmation-Token, Unsubscribe-Link)

### Output

- **Konsolidierte Risiko-Bewertung** (% Abmahn-Wahrscheinlichkeit, €-Range)
- **Findings-Tabelle** (verified / disputed / compounded)
- **Anwalts-Anhang pro Finding** (HUNTER-Befund + CHALLENGER-Test + Risiko-Vektor + Fix)
- **Abmahn-Simulation** (bei Wahrsch. > 60% oder Modus SIMULATE)
- **Audit-Trail** (Doku-Vorlage in `references/templates/COMPLIANCE-AUDIT-TRAIL-template.md`)

### Modi

- `SCAN` — Vollscan eines Projekts
- `HUNT` — Spezifische Luecke / Sachverhalt
- `SIMULATE` — Abmahn-/Behoerden-Simulation
- `CONSULT` — Dokument-Pruefung (AGB, AVV, DSE)

---

## Use-Cases

- **Pre-Launch-Audit** vor jedem Production-Deploy einer DACH-Site
- **Quartals-Compliance-Check** fuer bestehende Sites (DSE-Drift, neue Az.)
- **Pre-Push-Hook** in CI fuer DSE-relevante Aenderungen
- **Mandanten-Pre-Pruefung** durch Agenturen / Inhouse-Compliance-Officer
- **Konkurrenz-Recon** (was wuerde ein Abmahn-Anwalt bei mir finden?)

---

## Installation

### Variante 1: als Claude-Code-Skill (lokal)

```bash
# In ~/.claude/skills/ als Submodule clonen oder direkt kopieren
cd ~/.claude/skills/
git clone https://github.com/RideMatch1/a.e.g.i.s.git aegis-skills
ln -s aegis-skills/skills/brutaler-anwalt brutaler-anwalt
```

### Variante 2: als Submodule unter AEGIS

```bash
# Wenn du AEGIS bereits geklont hast
cd <aegis-repo>
git submodule add <skill-repo-url> skills/brutaler-anwalt
```

### Aktivierung

Nach Installation in einem neuen Conversation-Start:

```
/anwalt
```

oder direkt mit Modus + Topic:

```
/anwalt scan          # Default SCAN auf aktuelles Repo
/anwalt hunt cookie   # HUNT auf Cookie-Banner
/anwalt simulate      # Abmahn-Brief-Simulation
/anwalt consult agb   # CONSULT-Modus mit AGB
```

### Auto-Trigger (Keywords)

Aktiviert automatisch bei diesen Keywords im User-Prompt:
`dsgvo, datenschutz, impressum, cookie, abmahnung, compliance, agb, avv,
drittland, einwilligung, ttdsg, tdddg, ddg, tmg, uwg, nis2, ai-act, gobd, dsa,
urheber, marke, ePrivacy, drittlandtransfer, schrems, eugh, bgh, abmahnanwalt,
datenpanne, betroffenenrechte, art-13, art-15, art-83, scc, tia, dsfa, vvt,
dpo, dsb, fashion-id, planet49`

---

## Verzeichnis-Struktur

```
brutaler-anwalt/
├── SKILL.md                          # Skill-Definition + Personas + Auto-Loading
├── README.md                         # diese Datei
├── LICENSE                           # MIT
├── CHANGELOG.md                      # Versions-Historie
└── references/
    ├── audit-patterns.md              # 8-Phasen-HUNTER + V3.1-Lessons
    ├── dsgvo.md                       # DSGVO-Auszug + DSFA-Trigger + VVT-KMU
    ├── it-recht.md                    # DDG/TMG/NIS2/AI-Act/DSA/HinSchG/BFSG
    ├── vertragsrecht.md               # AGB / BGB / SaaS / Lizenz
    ├── checklisten.md                 # Pflicht-Listen pro Surface
    ├── branchenrecht.md               # BORA/HWG/LMIV/MPDG/GlueStV/JuSchG/FernUSG/PetCare/...
    ├── bgh-urteile.md                 # BGH/EuGH/OLG-Beleg-DB mit Source-URL
    ├── abmahn-templates.md            # Abmahn-Brief-/Behoerden-Anhoerung-Vorlagen
    ├── aegis-integration.md           # AEGIS-Scanner-Findings → Anwalts-Bewertung
    ├── international.md               # CCPA / UK-GDPR / DSG / Schrems-II
    ├── strafrecht-steuer.md           # StGB §202a/263a/269 + GoBD/AO
    ├── templates/                     # 12 anonymisierte Lehrbuch-Snippets (inkl. VVT-File-Upload + DSFA-Art-9)
    ├── gesetze/                       # Strukturierte Gesetzes-Auszuege (Phase 2 WIP)
    └── stack-patterns/                # Tech-Stack-spezifische Patterns (Phase 2 WIP)
```

---

## Provenance-Disziplin

Dieser Skill folgt einer **zero-tolerance**-Politik gegen halluzinierte
Az.-Nummern (siehe SKILL.md §5):

1. Jede Az. im Output muss aus `references/bgh-urteile.md` (mit Source-URL)
   stammen ODER in der aktuellen Session per WebSearch primaer-quellen-verifiziert
   sein.
2. Verdaechtige Az.-Pattern (Placeholder-Nummern, Az.-Jahr-Mismatch, frische
   2024-2026-Az. ohne Source) werden VOR Output mit WebSearch geprueft.
3. Wenn nicht verifizierbar → Az. wird entfernt oder als `[ungeprueft]` markiert.

Hintergrund: ein halluziniertes Az. in einem Compliance-Doc kann die
Grundlage einer falschen Mandanten-Entscheidung sein. Als Skill ohne
RDG-Zulassung ist die einzige ehrliche Position: was nicht beweisbar ist,
wird nicht ausgegeben.

---

## Contribution-Guidelines

### Was beitragen?

- **Neue Az.-Eintraege** in `references/bgh-urteile.md` — mit Source-URL
  zur Primaerquelle (juris.bundesgerichtshof.de, curia.europa.eu, OLG-Portale)
- **Neue Branchen** in `references/branchenrecht.md` — mit Trigger-Pattern,
  Pflicht-Pruefungen, typischen Verstoessen, Az.-Belegen
- **Neue Stack-Patterns** in `references/stack-patterns/` — pro Framework /
  Auth-/Payment-/Tracking-/AI-Provider ein File mit Code-Snippet + DPA-Quelle
  + DSE-Wording-Vorlage
- **Neue Checklisten** in `references/checklisten.md` — fuer neue Compliance-Themen
- **Bugs in Audit-Pattern** — wenn der Skill ein Pattern uebersieht oder einen
  False-Positive produziert: Issue mit Repro-Beispiel

### Wie beitragen?

1. Pull-Request mit klarem Title (`add: BGH I ZR XXX/YY zu Cookie-Compliance`)
2. Pro Az.-Eintrag Pflicht-Felder: Az., Datum, Tenor (1-3 Saetze), Anwendung,
   Source-URL (Primaerquelle bevorzugt)
3. Bei Sekundaerquelle (dejure.org, openjur.de, etc.): Tag `[secondary-source-verified]`
4. CHANGELOG.md updaten
5. CI-Tests pass (Brand-Sanitization-Check, Az.-Provenance-Check)

### Was NICHT beitragen

- **Keine halluzinierten Az.** Wenn du eine Quelle nicht primaer auffindbar
  belegen kannst → entweder Sekundaerquelle mit Tag oder weglassen.
- **Keine Brand-spezifischen Snippets**. Templates muessen anonymisiert sein
  (`<placeholder>`-Pattern). Konkrete Code-Beispiele aus Live-Brands gehoeren
  in dein eigenes Repo, nicht hier.
- **Keine Rechtsberatung-Aussagen**. Reference-Files dokumentieren Recht,
  geben aber keine Beratungs-Empfehlung — der Skill-Output ist eine
  technisch-indikative Vor-Pruefung, keine Beratung.
- **Keine PRs ohne Provenance**. Az. + Source-URL ist Pflicht.

---

## Quellen-Acknowledgments

- **gesetze-im-internet.de** (Bundesministerium der Justiz) — gemeinfreie
  Werke nach § 5 UrhG, Pflicht-Quelle fuer DE-Gesetze
- **eur-lex.europa.eu** (Europaeische Union) — Creative Commons Attribution 4.0
  fuer EU-Verordnungen + Richtlinien
- **juris.bundesgerichtshof.de** — BGH-Entscheidungen-Datenbank
- **curia.europa.eu** — EuGH-Entscheidungen
- **edpb.europa.eu** — European Data Protection Board (Guidelines)
- **bsi.bund.de** — BSI (Mindestanforderungen IT-Sicherheit)

Sekundaerquellen (mit Provenance-Tag): dejure.org, openjur.de, rewis.io,
medien-internet-und-recht.de, IHK-Stellungnahmen, etablierte Anwalts-Blogs.

---

## Roadmap zu v4.0.0

Siehe [`CHANGELOG.md`](./CHANGELOG.md) Block `[Unreleased]`. Schwerpunkt:

- Maxout `references/gesetze/` (DSGVO, BDSG, TDDDG, BGB, UWG, ...)
- 100+ Az. in `references/bgh-urteile.md` (alle mit Source-URL)
- 30+ Stack-Pattern-Files
- 20+ Branchen in `references/branchenrecht.md`
- Out-of-Corpus-Validation gegen Live-Brands
- OSS-Release auf AEGIS-Repo (User-authorized)

---

## License

MIT — siehe [`LICENSE`](./LICENSE).
