---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: WpHG Audit-Relevance — Wertpapierhandel, MiFID-II-Wohlverhalten, MAR-Insider/Manipulation.
---

# WpHG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites mit:
- Wertpapier-Trading (Aktien, Anleihen, ETFs)
- Robo-Advisor / Anlageberatung
- Crypto-Exchange (MiCA-Marktmissbrauch greift)
- Token-Emission mit Wertpapier-Eigenschaften
- Crowdinvesting / Beteiligungs-Plattform
- Investment-Tagesgeld mit aktiver Steuerung

## Trigger im Code/UI

- **„Geeignetes Investment für Sie"** ohne Geeignetheits-Frage-Flow → § 64
- **Onboarding ohne Risiko-/Ziel-Abfrage** bei Trading-Plattform → § 64
- **Telefon-Service ohne Aufzeichnung** → § 80
- **Token-Verkauf mit Renditeversprechen** ohne Prospekt → WpPG (Wertpapierprospektgesetz) + WpHG
- **Pump-Channel-Integration** in Trading-Plattform-Chat → § 33a Marktmanipulation-Risiko
- **„Fremde Stimmrechtsausübung"** ohne Compliance → § 26 Meldung-Pflicht

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Insiderhandel | § 119 + MAR Art. 14 | Freiheitsstrafe bis 5 Jahre; bes. schw. Fall 1-10J | § 119 WpHG |
| Marktmanipulation | § 119 + MAR Art. 15 | Freiheitsstrafe bis 5 Jahre; bes. schw. Fall 1-10J | § 119 WpHG |
| Wohlverhalten / Geeignetheit | § 33, § 64 + § 120 | bis 15 Mio € / 15 % Umsatz (jur. P.) | § 120 Abs. 18 WpHG |
| Aufzeichnungspflicht | § 80 + § 120 | bis 15 Mio € / 15 % Umsatz | § 120 Abs. 18 WpHG |
| Stimmrechtsmeldung | § 26 + § 120 | bis 15 Mio € | § 120 Abs. 18 WpHG |

## Top-Az.

- **BGH 4 StR 287/19** — Insiderhandel-Tatbestand bei Tipper/Empfänger-Kette
- **EuGH C-628/13 Lafonta** — Insiderinformations-Begriff (Präzision der Information)
- **BaFin Bekanntmachung MAR** + ESMA Q&A — verbindliche Auslegung
- **BGH II ZR 287/14** — Anlageberatungs-Pflicht-Verletzung Schadensersatz

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/Finance/KWG.md` für Erlaubnispflicht (Wertpapierdienstleistung)
- `references/gesetze/EU-Verordnungen/MiFID-II-2014-65/` für direkte EU-Vorgaben
- `references/gesetze/EU-Verordnungen/MAR-2014-596/` für Marktmissbrauch direkt
- `references/gesetze/EU-Verordnungen/MiCA-2023-1114/` für Krypto-Markmissbrauch
- `references/audit-patterns.md` Phase 4 für Onboarding-Surface

## eWpG (elektronische Wertpapiere)

Seit 10.06.2021 (eWpG, Gesetz über elektronische Wertpapiere) können Wertpapiere als Krypto-Wertpapier emittiert werden. WpHG voll anwendbar.

## Sektor-Abgrenzung

| Token-Typ | Maßgebliches Recht |
|---|---|
| Utility-Token ohne Beteiligung/Gewinn-Versprechen | MiCA + ggf. KWG (Krypto-Verwahrung) |
| Security-Token (Beteiligung + Gewinn) | WpHG + WpPG + KWG + MiCA-Ausnahme (Art. 2 Abs. 4) |
| Stablecoin (FIAT-gebunden) | EMT/ART nach MiCA + ZAG/KWG |
| NFT (echtes Sammlerstück) | MiCA-Ausnahme (Art. 2 Abs. 3) — nur UWG/UrhG |
