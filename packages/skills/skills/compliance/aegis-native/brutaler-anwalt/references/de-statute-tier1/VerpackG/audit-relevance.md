---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: VerpackG Audit-Relevance — E-Commerce-Hersteller-Pflichten, LUCID-Registrierung.
---

# VerpackG — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDEM B2C-Online-Shop / Direct-to-Consumer-Verkauf:
- Eigene Marke → Hersteller-Status sofort
- Drop-Shipping aus EU/Non-EU → Hersteller-Status (Erst-Importeur)
- Marketplace-Verkäufer (FBA, eBay, Etsy)
- Subscription-Box / Abo-Versand
- Refurbished-Goods + Versand-Verpackung

## Trigger im Code/UI / Doku

- **Online-Shop ohne LUCID-Nummer in AGB / Footer** → § 9 Verstoß (LUCID-Verifikation öffentlich)
- **Versand-Karton + Füllmaterial ohne Systembeteiligungs-Vertrag** → § 7
- **Einweg-Plastik-Flasche-Verkauf ohne Pfand-Logik** → § 31
- **Quartalsmeldung übergangen** → § 11 + § 34
- **„Wir geben Verpackungen weiter"** ohne § 9-Registrierung des ursprünglichen Herstellers → Marketplace-Pflicht
- **Service-Verpackungen** (Lieferdienst-Karton, To-Go-Bowl) ohne Systembeteiligung → § 7

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| LUCID-Registrierung fehlt | § 9 + § 34 | bis 200.000 € | § 34 Abs. 2 VerpackG |
| Mengen-Meldung verspätet/falsch | § 11 + § 34 | bis 200.000 € | § 34 Abs. 2 VerpackG |
| Systembeteiligung fehlt | § 7 + § 34 | bis 100.000 € | § 34 Abs. 2 VerpackG |
| Pfand-Pflicht-Verstoß | § 31 + § 34 | bis 10.000 € | § 34 Abs. 2 VerpackG |
| Marketplace lässt nicht-reg. Verkäufer zu | § 7a + § 34 | bis 200.000 € | § 34 VerpackG |
| Vermögensvorteils-Abschöpfung | § 34 Abs. 3 | zusätzlich Gewinn-Einzug | § 34 Abs. 3 |

UWG-§-3a-Abmahnung-Risiko: PR-aktive Wettbewerbszentrale + Deutsche Umwelthilfe (DUH) = häufige Abmahner.

## Top-Az.

- **OLG Köln 6 U 72/22** — LUCID-Registrierung als Markterzugangsvoraussetzung
- **OLG Hamburg 5 U 110/19** — Vertriebs-Verbot bei fehlender Systembeteiligung
- **DUH-Abmahnungen 2022-2024** — etliche Online-Shops abgemahnt wegen LUCID-Defiziten

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/UWG/audit-relevance.md` § 3a (Marktverhaltens-Reg)
- `references/gesetze/ElektroG/` analoge Hersteller-Pflichten für Elektrogeräte
- `references/gesetze/EU-Verordnungen/Single-Use-Plastics-RL-2019-904/` direkte EU-Vorgaben
- `references/audit-patterns.md` Phase 6 (Compliance-Doku)

## Praktischer Audit-Checklist

- [ ] LUCID-Nummer öffentlich einsehbar (Footer / Compliance-Page)
- [ ] Vertrag mit dualem System nachweisbar
- [ ] Quartalsmeldung-Prozess in Buchhaltung
- [ ] Vollständigkeitserklärung wenn Mengen-Schwellen überschritten
- [ ] Pfand-Logik im Checkout für Einweg-Plastik
- [ ] Marketplace-Filter: Verkäufer mit LUCID-Verifikation
- [ ] Service-Verpackungen separat erfasst + systembeteiligt
- [ ] AVV mit Logistik-Dienstleister regelt Verpackungs-Zuordnung
