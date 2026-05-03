---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2554
last-checked: 2026-05-02
purpose: DORA — Audit-Trigger und Pflicht-Surfaces fuer Skill.
---

# DORA — Audit-Relevance

## Wann triggert dieser Skill den DORA-Layer?

Auto-Loading-Trigger:

```
1. Branchen-Detection:
   - URL-Pattern: *-bank.*, *-fintech.*, *-versicherung.*, *-trading.*, *-exchange.*
   - schema.org @type: BankOrCreditUnion, FinancialService, InsuranceCompany
   - Tech-Stack: Aktien-Trading-Frameworks, MiCA-CASP-spezifische SDKs

2. Customer-Indication:
   - Site bewirbt: "fuer Banken / Versicherer / Trading"
   - DPA-Liste enthaelt Finanz-Kunden

3. Compliance-Hint:
   - SOC 2 / ISO 27001 / BSI-Grundschutz-Erwaehnung
   - "BaFin-konform" / "DORA-konform" Marketing-Claim
```

## Pflicht-Surfaces nach Status

### Status A — Site selbst ist Finanzdienstleister

Vollstaendiger DORA-Stack:
- Art. 5-15 IKT-Risikomanagement
- Art. 17-23 Incident-Reporting (24h/72h/1M Fristen)
- Art. 24-27 TLPT (alle 3 Jahre)
- Art. 28-44 Drittanbieter-Risiko

### Status B — Site ist Sub-Auftragsverarbeiter fuer Finanzdienstleister

Pflichten kaskadieren via Vertrag (Art. 30 DORA):
| Vertragsklausel | Pflichtinhalt |
|---|---|
| SLA | Verfuegbarkeit + Response-Times definiert |
| Datenstandort | EU-Region oder Sondervereinbarung |
| Sub-Outsourcing | Operator-Vorab-Genehmigung |
| Audit-Rechte | Onsite-Audit + Document-Zugriff |
| Exit-Strategie | Migration-Pfad + Daten-Rueckgabe |
| Sicherheitsanforderungen | mind. ISO 27001 / SOC 2 / BSI-Grundschutz |
| Incident-Reporting | 24h-Erstmeldung an Operator |

### Status C — Site bietet Finanz-Themen-Beratung an

(z.B. Robo-Advisor, Fintech-Comparison-Tool):

Pflichten je nach KWG/WpHG-Status:
- Erlaubnispflicht KWG / WpHG / ZAG?
- Anlegerinformations-Pflichten

## Audit-Pattern (Skill-Output-Vorschlag)

```
**Finding**: SaaS bietet Hosted-Service fuer Versicherungs-Kunden ohne DORA-konformen Vertrag
**Wahrsch.**: 60% (BaFin-Pruefungen 2025+ angelaufen, Sub-Auftragsverarbeiter im Fokus)
**Kritikalitaet**: 🟡 HOCH
**§**: Art. 30 DORA + indirekt KWG / WpHG / VAG je nach Operator
**€-Range**: Vertragsstrafe bei Audit-Fail durch Operator + Reputations-Schaden
**Fix**:
- Vertragsklauseln gemaess Art. 30 DORA ergaenzen (SLA / Datenstandort / Sub-Outsourcing / Audit-Rechte / Exit / Sicherheit / Incident-Reporting)
- ISO 27001 / SOC 2-Zertifizierung anstreben (Audit-Trail)
- Sub-Liste an Finanz-Kunden offen-halten
```

## Cross-References

- ISO 27001 / BSI IT-Grundschutz: `references/it-recht.md`
- Branche Banking/Fintech/Versicherung: `references/branchenrecht.md`
- BaFin: https://www.bafin.de/

## Source

- [eur-lex.europa.eu — VO 2022/2554](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2554)
- [BaFin DORA-Page](https://www.bafin.de/DE/Aufsicht/RisikenManagement/Cyber/cyber_node.html)
