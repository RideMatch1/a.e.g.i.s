# Anhang E3 — UK International Data Transfer Addendum (IDTA)

**Version**: v1.0 (2026-05-05)
**Rechtsgrundlage**: International Data Transfer Addendum to the EU Commission Standard Contractual Clauses, gemäß § 119A Data Protection Act 2018 (UK), in Kraft seit 21. März 2022; Genehmigung durch UK Parliament am 21. März 2022, anwendbar seit 21. September 2022 (Übergangsphase bis 21. März 2024 für Altverträge).
**Anwendungsfall**: Übermittlung personenbezogener Daten unter UK GDPR aus dem Vereinigten Königreich in ein Drittland ohne UK-Angemessenheitsbeschluss. Wird als **Addendum zu den EU-SCC 2021/914** verwendet — die EU-SCC bilden den Hauptklauselsatz, das IDTA passt sie an die UK-Rechtslage an.
**Disclaimer**: Keine Rechtsberatung im Sinne § 2 RDG / kein "Legal Advice" nach SRA Code of Conduct. Vor Verwendung anwaltliche Prüfung — insbesondere zur Wahl zwischen IDTA und UK Addendum to EU SCCs sowie zur TIA (UK ICO Guidance).
**Quellen**: ICO Guidance — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/

---

## Variant Selection — Welche Form wählen?

Das UK-Regime kennt **zwei** alternative Mechanismen:

| Variante | Wann wählen? |
|----------|--------------|
| **A. UK International Data Transfer Agreement (IDTA)** | Stand-alone-UK-Vertrag — wenn keine EU-SCC im Vertragsverhältnis vorliegen oder ein UK-only-Empfänger gewünscht ist. Eigenständige Klausel-Struktur. |
| **B. UK International Data Transfer Addendum to the EU SCCs** | **Empfohlen für Multi-Jurisdiktions-Setups (EU + UK)**: die EU-SCC 2021/914 werden weiterverwendet, das Addendum modifiziert sie für das UK-Recht. Effizient bei vielen Vendoren. |

**Empfehlung**: Variante B (Addendum) bei bestehenden EU-SCC-Verträgen — minimale Doppelarbeit. Dieser Anhang folgt **Variante B**.

---

## Part 1 — Tables

### Table 1 — Parties and Signatures

| Field | Exporter | Importer |
|-------|----------|----------|
| Start date | <Datum Vertragsbeginn> | (entsprechend) |
| Parties' details — full legal name | <Datenexporteur — Firma> | <Datenimporteur — Firma> |
| Trading name (if different) | <…> | <…> |
| Main address | <Adresse UK> | <Adresse Drittland> |
| Official registration number (if any) | <Companies-House-Nr.> | <…> |
| Key Contact — full name + role | <…> | <…> |
| Key Contact — contact details (email + phone) | <…> | <…> |
| Signatures | <Unterschrift im Hauptvertrag> | <Unterschrift im Hauptvertrag> |

### Table 2 — Selected SCCs, Modules and Selected Clauses

| Field | Selection |
|-------|-----------|
| Addendum EU SCCs | ☐ Version of EU SCCs the Addendum applies to | EU SCCs Decision 2021/914 of 4 June 2021 |
| Module in operation | ☐ Module 1 (Controller→Controller) <br> ☑ Module 2 (Controller→Processor) <br> ☐ Module 3 (Processor→Sub-Processor) <br> ☐ Module 4 (Processor→Controller) |
| Clause 7 — Docking Clause | ☐ activated / ☑ not activated |
| Clause 9 — Sub-processors | ☑ Option 2 — General authorisation, 30 calendar days notice |
| Clause 11 — Optional Independent Dispute Resolution | ☐ activated / ☑ not activated |
| Clause 17 — Governing Law | Law of the laws of <England and Wales / a relevant EU Member State> |
| Clause 18 — Choice of Forum | <Courts of England and Wales / Member State courts> |
| Annex 1A | Per Annex I.A of the EU SCCs Module 2 — see `AVV-anhang-SCC-module2-controller-processor.md` |
| Annex 1B | Per Annex I.B as above |
| Annex II (TOMs) | Per `AVV-anhang-TOMs.md` |
| Annex III (Sub-processors) | Per `AVV-anhang-Sub-Processor-List.md` |

### Table 3 — Appendix Information (UK-spezifische Felder)

| Field | Entry |
|-------|-------|
| Annex 1A: List of Parties | (siehe Annex I.A der zugrundeliegenden EU SCCs) |
| Annex 1B: Description of Transfer | (siehe Annex I.B der zugrundeliegenden EU SCCs) |
| Annex II: Technical and Organisational Measures | (siehe `AVV-anhang-TOMs.md`) |
| Annex III: List of Sub-processors (Module 2 / 3 only) | (siehe `AVV-anhang-Sub-Processor-List.md`) |

### Table 4 — Ending the Addendum (Termination Right)

> Welche Partei darf das Addendum gemäß Section 19 beenden, wenn der ICO eine "approved Addendum" Änderung publiziert?
>
> ☐ Importer — Datenimporteur
> ☐ Exporter — Datenexporteur
> **☑ neither Party — keine einseitige Beendigung; Änderungen werden einvernehmlich vereinbart**

---

## Part 2 — Mandatory Clauses

> Vollständiger Text der "Mandatory Clauses" gemäß ICO IDTA Template — wortwörtlich zu übernehmen. Volltext-Quelle: ICO-Veröffentlichung "International Data Transfer Addendum to the EU Commission Standard Contractual Clauses" vom 21. März 2022.
>
> Kurzgliederung der Mandatory Clauses:
>
> 1. **Entering into the Addendum** — Vertragsschluss-Mechanik
> 2. **Interpretation** — Definitionen (UK Data Protection Laws, ICO, etc.)
> 3. **Hierarchy** — Vorrangregel: Addendum > EU SCCs (für UK-Datenübermittlungen)
> 4. **Incorporation and Changes to the EU SCCs** — Modifikationen an Klauseln 6, 8, 13, 14, 17, 18 der EU SCCs
> 5. **Amendments to this Addendum** — Änderungen nur bei ICO-Genehmigung oder beidseitiger Vereinbarung
> 6. **Variations on End-Date** — Beendigungsrecht bei publizierter ICO-Änderung
> 7. **Notices** — Mitteilungen schriftlich oder elektronisch
> 8. **Severability** — salvatorische Klausel
> 9. **Governing Law and Jurisdiction** — UK-Recht; Gerichtsstand England & Wales (oder Schottland / Nordirland)

---

## UK-spezifische Anpassungen ggü. EU SCCs

| EU SCC Klausel | UK-IDTA-Modifikation |
|----------------|----------------------|
| Klausel 6 (Beschreibung der Übermittlung) | Verweise auf "Member States" werden zu "United Kingdom" — soweit anwendbar |
| Klausel 8.7 (Sensible Daten) | Bezug auf UK GDPR Art. 9/10 statt EU GDPR |
| Klausel 13 (Aufsichtsbehörde) | ICO (Information Commissioner's Office) statt EU-Aufsichtsbehörde — Anschrift: Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF |
| Klausel 14 (Lokale Rechtsvorschriften) | Bezug auf Investigatory Powers Act 2016 + Schedule 21 DPA 2018 |
| Klausel 15 (Behördenanfragen) | UK-Verfahren (z. B. National Security Notice, Technical Capability Notice) |
| Klausel 17 (Anwendbares Recht) | UK-Recht (England & Wales, Schottland oder Nordirland) — nicht EU-Mitgliedstaatsrecht |
| Klausel 18 (Gerichtsstand) | UK-Gerichte |

---

## TIA für UK-Übermittlungen — UK ICO Guidance

UK ICO empfiehlt einen "**Transfer Risk Assessment (TRA)**" — funktional ähnlich dem TIA der EDPB, aber mit UK-spezifischen Bewertungen:

1. **Identifikation des Drittlandes** + UK-Angemessenheitsstatus prüfen (UK-Adequacy-Liste — z. B. EU/EWR, Israel, Schweiz, Argentinien, Japan, Südkorea, Neuseeland, Uruguay, Andorra, Färöer, Guernsey, Jersey, Isle of Man, Kanada (kommerziell)).
2. **Risikobewertung** der Empfängerlands-Rechtslage (Überwachungsgesetze, Rechtsschutz für Betroffene).
3. **Supplementary Measures** — technisch (E2E-Verschlüsselung), vertraglich (Anfechtungspflicht), organisatorisch (Pseudonymisierung).
4. **Restrisiko-Entscheidung**: Übermittlung zulässig / aussetzen / Empfänger wechseln.

UK ICO stellt ein **TRA-Tool** bereit: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/international-transfer-risk-assessments/

---

## Multi-Jurisdiction-Hinweis

Bei einem Vertrag, der **sowohl EU-DSGVO als auch UK GDPR** abdeckt (z. B. EU-Mutter mit UK-Tochter und gemeinsamem US-Vendor), gilt:

- **EU SCC 2021/914** Module 2 — primärer Klauselsatz
- **UK IDTA Addendum (Variante B)** — Erweiterung für UK-Datenübermittlungen
- **CH revFADP-Anhang** — falls auch Schweizer Daten umfasst (siehe `AVV-anhang-CH-revDSG.md`)

Ein einziger Vertragsbody mit drei kompatiblen Annexen — Single Source of Truth.

---

**Unterzeichnung**: gemeinsam mit den EU SCCs; gesonderte Unterschrift dieses Addendum nicht erforderlich, sofern die Tabellen 1–4 ausgefüllt und im Hauptvertrag inkorporiert sind.
