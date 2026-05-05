---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: ZAG Audit-Relevance — PSD2-/SCA-Compliance, Acquiring, Open-Banking.
---

# ZAG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites mit:
- Eigenem Payment-Backend (NICHT durch Stripe/Adyen/Mollie als ZAG-Institut abgedeckt)
- Acquiring-Funktion (Karten-Akzeptanz für Drittanbieter)
- E-Geld-Issuance (Prepaid-Cards, FIAT-Stablecoins)
- Klarna-/Sofort-/PISP-Funktion
- Multi-Banking-App (AISP)
- Crypto-Exchange mit FIAT-Onramp

## Trigger im Code/UI

- **Eigene Payment-API ohne PSP** → § 10 ZAG-Lizenz nötig
- **Checkout ohne SCA / 3DS2** → § 53 + EBA-RTS-Verstoß
- **Direkte Bank-Konto-Konnektion ohne XS2A-API** → § 54
- **PSD2-„Screen Scraping"** statt API-Auth → § 54 Verstoß
- **Fehlende Vorfall-Meldekette < 4h** → § 56
- **Schwellenwert-Bypass für SCA** ohne Risk-Engine → § 53 + EBA-RTS

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Zahlungsdienste ohne Erlaubnis | § 10 + § 63 | Freiheitsstrafe bis 5 Jahre / Geldstrafe | § 63 ZAG |
| Fahrlässige Variante | § 63 Abs. 3 | bis 3 Jahre | § 63 ZAG |
| Sicherheitsvorfall-Meldung verfehlt | § 56 | bis 5 Mio € / 10 % Jahresumsatz | § 65 Abs. 4 ZAG |
| SCA-Verstoß | § 53 | bis 5 Mio € / 10 % Jahresumsatz | § 65 Abs. 4 ZAG |
| Open-Banking-Diskriminierung | § 54 | bis 5 Mio € / 10 % Jahresumsatz | § 65 Abs. 4 ZAG |

## Top-Az. / Verwaltungs-Anker

- **EuGH C-287/19 DenizBank** — SCA-Anwendungsbereich
- **BaFin Bekanntmachung 02/2018** — PSD2-Auslegung „Zahlungsdienst"
- **EBA RTS 2018/389** — technische Standards für SCA + sichere Kommunikation
- **BaFin Hinweise 2025** — DORA-Implementierung als ergänzende Pflicht

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/Finance/KWG.md` für Krypto-Verwahrgeschäft-Abgrenzung
- `references/gesetze/GwG/` für KYC-Pflichten (ZAG-Institute = GwG-Verpflichtete)
- `references/gesetze/EU-Verordnungen/PSD2-2015-2366/` für direkte EU-Vorgaben (vor PSD3)
- `references/gesetze/EU-Verordnungen/DORA-2022-2554/` für IT-Resilienz ab 17.01.2025
- `references/gesetze/EU-Verordnungen/MiCA-2023-1114/` für E-Geld-Token (EMT)
- `references/audit-patterns.md` Phase 5e für Checkout-/Payment-Surface

## SCA-Implementierungs-Hilfe

| Sektor | SCA-Pflicht | Ausnahme |
|---|---|---|
| E-Commerce-Checkout | 3DS2 / FIDO2 | < 30 € (LVT-Regel), Whitelist-Empfänger |
| Banking-App-Login | Wissen + Besitz | — |
| API-Zugang AISP/PISP | OAuth2 mit SCA-Layer | — |
| Wiederkehrende Zahlung | initial SCA, dann Wegfall | Mandate-Modell |
| Kontaktlos-Karten | < 50 € (max. 5x kumuliert) | — |

PSP wie Stripe / Adyen / Mollie übernehmen SCA-Implementation — Operator-Pflicht: korrekte Übergabe + Behandlung der Auth-Resultate.

## Hinweis PSD3 (Erwartet 2026/2027)

PSD3 + PSR werden ZAG ablösen. Erweiterte SCA-Anforderungen, härtere Open-Banking-Klauseln, NPSP-Lizenz-Schwelle. Operator sollten ZAG-Compliance bereits als Vorbereitung MiCA + PSD3 ausrichten.
