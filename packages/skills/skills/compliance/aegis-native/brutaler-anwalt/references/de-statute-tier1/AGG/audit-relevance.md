---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: AGG Audit-Relevance — Diskriminierungs-Schutz, KI-Bewerber-Screening, B2C-Algorithmen.
---

# AGG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites/SaaS für:
- HR-Tools / ATS / Bewerber-Tracking
- KI-/AI-basiertes Recruiting (CV-Parser, Pre-Screening)
- Job-Boards / Stellenausschreibungs-Plattformen
- E-Commerce mit Differential-Pricing
- Versicherungs-Tarif-Engines
- Kredit-/Bonitäts-Scoring
- Wohnraum-Plattformen (Vermietung)

## Trigger im Code/UI

- **Stellenausschreibung mit „junges Team"** → § 11 (Alter) + § 1
- **Stellenausschreibung „Muttersprachler" ohne sachlichen Grund** → § 11 (ethnische Herkunft)
- **CV-Parser bevorzugt bestimmte Universitäten** mit demografischer Skew → § 3 Abs. 2 (mittelbar)
- **Differential-Pricing nach Postleitzahl** mit Korrelation Migrationshintergrund → § 19 + § 3 Abs. 2
- **Kredit-Scoring blackbox** ohne Erklärbarkeit → § 22 + AI Act Annex III
- **Algorithmus, der Frauen-Daten unterrepräsentiert** → § 3 Abs. 2

## Verstoss-Klassen + Konsequenz

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Stellenausschreibung diskriminierend | § 11 + § 7 + § 15 | bis 3 Monatsgehälter (§ 15 Abs. 2) | § 15 Abs. 2 AGG |
| Beschäftigungs-Diskriminierung | § 7 + § 15 | materieller Schaden + Entschädigung | § 15 AGG |
| B2C-Massengeschäft-Diskriminierung | § 19 + § 21 | Beseitigung + Schadensersatz + Entschädigung | § 21 AGG |
| Versicherung-/Bank-Diskriminierung | § 19 + § 21 | wie oben | § 21 AGG |

**Beweislast-Hebel**: § 22 verschiebt Beweislast bei Indizien. Klägerin muss nur „Indizien" zeigen (Mail, Stellentext, Statistik) — Beklagte muss VOLL beweisen, dass keine Diskriminierung vorlag.

## Top-Az.

- **BAG 8 AZR 638/14** — Stellenausschreibung „junges, dynamisches Team" als Indiz § 22
- **BAG 8 AZR 285/16** — Geburtsdatum-Anforderung in Bewerbung
- **EuGH C-415/10 Meister** — Indizien-Rechtsprechung
- **EuGH C-188/15 Bougnaoui** — Religion / Kopftuch
- **BVerfG 1 BvR 916/15 (2018)** — „dritte Geschlechtsoption" + AGG-Bezug
- **BAG 8 AZR 21/19** — KI-/Algorithmus-Recruiting Indiz-Rechtsprechung wird sich entwickeln (kein abschließendes Az.)

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/EU-Verordnungen/AI-Act-2024-1689/` Annex III Nr. 4 (Beschäftigung als Hochrisiko-KI)
- `references/dsgvo.md` Art. 22 (automatisierte Entscheidung) + Art. 9 (besondere Kategorien)
- `references/gesetze/BetrVG/` § 95 (Auswahlrichtlinien) — KI-Tool kann mitbestimmungspflichtig sein
- `references/gesetze/BGB/` für allgemeines Diskriminierungsrecht in Verträgen
- `references/audit-patterns.md` Phase 5f für HR-Audit-Surface

## KI-Bewerber-Screening — kombinierte Compliance

Wenn Operator KI-System für Recruiting einsetzt:
1. **AI Act**: Hochrisiko-System (Annex III Nr. 4) — Pflichten Art. 9-15 ab 02.08.2026 vollständig
2. **AGG**: § 7 + § 22 Beweislastumkehr — Indiz reicht zur Verschiebung
3. **DSGVO Art. 22**: automatisierte Einzel-Entscheidung verboten ohne ausdrückliche Einwilligung / Vertragserforderlichkeit / gesetzliche Pflicht
4. **BetrVG § 87 Abs. 1 Nr. 6**: technische Einrichtung-Mitbestimmung
5. **BetrVG § 95**: Auswahlrichtlinien-Mitbestimmung

Operator muss alle 5 Spuren erfüllen. Absicherung: Bias-Test + Audit-Log + menschliche Letztentscheidung-Pflicht + Mitarbeiter-Vertrags-Klausel.

## Praktischer Audit-Checklist

- [ ] Stellenanzeigen-Generator filtert auf AGG-Risiko-Wortliste
- [ ] „m/w/d"-Suffix automatisch eingefügt
- [ ] CV-Parser-Bias-Test dokumentiert
- [ ] Algorithmus-Erklärbarkeit (XAI) für Entscheidung
- [ ] Mensch-im-Loop bei finaler Auswahl
- [ ] AGG-Schulung für Recruiter / People-Ops
- [ ] § 12 AGG: Schutz vor Belästigung im Betrieb (interne Whistleblower-Kanal)
