---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: GwG Audit-Relevance — KYC, Krypto-Onboarding, Finance-Compliance.
---

# GwG — Audit-Relevance

## Auto-Loading-Trigger

Bei Sites/Apps mit:
- Crypto-Exchange / Custodial-Wallet
- DeFi-Frontend mit FIAT-Onramp
- Zahlungsdienst (PSD2 + ZAG)
- Banking / Neobank
- Versicherung-Vermittlung
- Immobilien-Marktplatz mit Transaktion
- Glücksspiel (online)
- Edelmetall-Online-Shop

## Trigger im Code/UI

- **Account-Erstellung mit nur E-Mail** bei Krypto-Custodial → § 10 + § 11 Verstoß
- **Fehlendes Video-Ident/Foto-Ident** → § 11 (Identifizierungs-Pflicht)
- **Keine PEP-Liste-Abfrage** im Onboarding → § 14 (verstärkte Sorgfaltspflicht)
- **Fehlendes Transaction-Monitoring** → § 10 Abs. 1 Nr. 5
- **Keine Verdachts-Melde-Funktion** → §§ 43-48
- **Aufbewahrung < 5 Jahre** → § 8
- **Wirtschaftlich-Berechtigter-Frage fehlt** im B2B-Onboarding → § 11 Abs. 5

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Sorgfaltspflicht-Verstoß | §§ 10-17 | bis 100.000 € | § 56 Abs. 2 GwG |
| Risikomanagement fehlt | §§ 4-9 | bis 100.000 € | § 56 Abs. 2 GwG |
| Schwerer/wiederholter Verstoß | div. | bis 1.000.000 € | § 56 Abs. 2 GwG |
| Krediti-/Finanz-Institut + schwer | div. | bis 5.000.000 € oder 10 % Jahresumsatz | § 56 Abs. 2 + 4. AMLD Art. 59 |
| Verdachts-Melde-Verstoß | §§ 43-48 | bis 1.000.000 € | § 56 Abs. 2 GwG |
| Veröffentlichung („Naming") | § 57 | Reputationsschaden | § 57 GwG |

## Top-Az. + Behörden-Praxis

- **BaFin Bußgeld N26 (2021)** — 4,25 Mio € Bußgeld + Anweisungen wegen GwG-Defiziten (öffentlich publiziert per § 57)
- **BaFin-Anweisung Bitpanda DE (2022)** — Wallet-Service-KYC-Defizite
- **BaFin Auslegungs- und Anwendungshinweise (AuA) GwG** — verbindliche Verwaltungs-Vorgabe; Update jährlich
- **FIU Jahresbericht** — typische Verdachts-Muster + Branchenrisiko-Profil

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/Finance/KWG.md` für Kredit-Institut-Erlaubnis
- `references/gesetze/Finance/ZAG.md` für PSD2-Identifizierung (SCA)
- `references/gesetze/EU-Verordnungen/MiCA-2023-1114/` für Krypto-Asset-Anbieter (CASP-Pflichten)
- `references/gesetze/EU-Verordnungen/AMLR-2024-1624/` (ab 2027 anwendbar; ersetzt teilweise GwG)
- `references/audit-patterns.md` Phase 4 für Onboarding-Surface
- `references/dsgvo.md` Art. 6 Abs. 1 lit. c (Rechtsgrundlage für KYC-Daten = rechtliche Verpflichtung)

## Krypto-Spezifika (§ 2 Abs. 1 Nr. 16)

- **Kryptoverwahrgeschäft** (§ 1 Abs. 1a Satz 2 Nr. 6 KWG) ist GwG-Verpflichtung — auch für Software-as-Custody
- **Travel Rule** (FATF Empfehlung 16): Sender + Empfänger ≥ 1.000 € müssen identifiziert werden — DE-Umsetzung über § 25g KWG (Krypto-Transferverordnung in EU AMLR übernommen)
- **Selbstverwahrung-Wallets** (Non-Custodial): Custodial-Plattform muss bei Transfer an externe Wallet zusätzliche Identifizierung vornehmen
