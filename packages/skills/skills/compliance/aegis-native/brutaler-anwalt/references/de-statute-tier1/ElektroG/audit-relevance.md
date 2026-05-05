---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: ElektroG Audit-Relevance — E-Commerce-Pflichten Hersteller, Marketplace, Rücknahme.
---

# ElektroG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites mit Verkauf an DE-Endkunden:
- Smart-Devices / IoT
- Wearables / Smart-Watches / Fitness-Tracker
- Smart-Home / Beleuchtungs-Mittel
- Power-Banks / Mobile-Akkus
- Spielzeug-mit-Strom (Drohnen, RC-Cars, Elektro-Roller)
- Computer / Mobile-Telephone / Headphones
- Marketplace-Operator
- Refurbished-Electronics-Shop

## Trigger im Code/UI / Doku

- **Fehlende EAR-WEEE-Registrierungsnummer** in Impressum / Footer → § 6
- **Marketplace ohne Verkäufer-EAR-Verifikation** → § 6 Abs. 7
- **Online-Shop > 400 qm Lager ohne Rücknahme-Hinweis** im Checkout → § 17
- **Produktbeschreibung ohne WEEE-Symbol-Information** → § 18
- **Versand ohne Retoure-Label-Option** → § 17 Abs. 2
- **Rücknahme nur bei 1:1-Tausch** ohne 0:1-Option für ≤ 25 cm → § 17 Abs. 1 Nr. 2

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| EAR-Registrierung fehlt | § 6 + § 29 | bis 100.000 € | § 29 Abs. 2 ElektroG |
| Garantie-Hinterlegung fehlt | § 9 + § 29 | bis 100.000 € | § 29 Abs. 2 ElektroG |
| Rücknahme-Pflicht-Verstoß | § 17 + § 29 | bis 100.000 € | § 29 Abs. 2 ElektroG |
| Informations-Pflicht-Verstoß | § 18 + § 29 | bis 10.000 € | § 29 Abs. 2 ElektroG |
| Marketplace-Verstoß | § 6 Abs. 7 + § 29 | bis 100.000 € | § 29 Abs. 2 ElektroG |

UWG-§-3a-Abmahnung-Risiko: Verbraucherzentralen + Wettbewerber sehr aktiv (typische Streitwerte 5.000-25.000 €).

## Top-Az.

- **BGH I ZR 153/16** „Eldis" — Pflicht zur Rücknahme klargestellt
- **BGH I ZR 91/13** — WEEE-Hinweis als Marktverhaltensregelung (UWG § 3a)
- **OLG Köln 6 U 138/22** — Marketplace-Verantwortung

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/VerpackG/` analoge Marketplace-Verifikations-Pflicht für Verpackungen
- `references/gesetze/UWG/audit-relevance.md` § 3a Rechtsbruch
- `references/gesetze/BattG/` Batteriegesetz (parallele Pflichten für Akkus)
- `references/gesetze/EU-Verordnungen/Battery-VO-2023-1542/` ab 18.08.2025 Pflichten
- `references/audit-patterns.md` Phase 6 für Compliance-Doku

## Praktischer Audit-Checklist

- [ ] EAR-WEEE-Reg-Nummer in Impressum / Footer / AGB
- [ ] WEEE-Symbol auf Verpackung + Geräte
- [ ] Hersteller-Kennzeichnung gem. § 7
- [ ] Garantie-Hinterlegung bei Stiftung EAR (Bürgschaft)
- [ ] Rücknahme-Hinweis in Checkout + Produkt-Detailseite (bei ≥ 400 qm)
- [ ] Retoure-Label für Online-Rücknahme
- [ ] Informations-Page über getrennte Sammlung + Schadstoff-Effekte
- [ ] Marketplace: EAR-Verifikations-API für Verkäufer-Onboarding
- [ ] Refurbished-Geräte: separate Klärung Erst-Inverkehrbringer-Status
