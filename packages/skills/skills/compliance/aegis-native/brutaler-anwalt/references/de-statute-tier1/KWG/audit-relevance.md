---
license: gemeinfrei nach § 5 UrhG (DE)
verification-status: az-list-unverified (siehe VERIFICATION-NOTES.md — Az.-Listen aus Domain-Wissen, vor Skill-Integration gegen juris/dejure cross-checken)
purpose: KWG Audit-Relevance — Bank-/Finanzdienstleistungs-Erlaubnis, Krypto-Custody.
---

# KWG — Audit-Relevance

## Auto-Loading-Trigger

Bei JEDER Site mit:
- Krypto-Exchange / Custodial-Wallet
- Stablecoin-Issuance
- Brokerage / Trading-Plattform
- Wertpapier-Vertrieb
- Banking-/Neobank-Funktion
- Investment-Anwendung („Robo-Advisor")
- DeFi-Frontend mit Custody-Layer

## Trigger im Code/UI

- **„Wallet-Service" + private-key-control bei Plattform** → § 1 Abs. 1a Nr. 6 → § 32 Erlaubnis Pflicht
- **„Stake unsere Coins für Yield"** → ggf. Einlagengeschäft § 1 Abs. 1 Nr. 1 → § 32
- **„Wir vermitteln Investments"** → Anlagevermittlung § 1 Abs. 1a
- **Cloud-Auslagerung ohne MaRisk/BAIT-Klauseln** → § 25c
- **Geschäftsleiter wohnt außerhalb DE** → § 33 Erlaubnis-Versagung
- **Bonus-/Yield-Versprechen** für FIAT-Einzahlungen → ggf. § 32 Verstoß

## Verstoss-Klassen + €-Range

| Verstoss | § | Range | Quelle |
|---|---|---|---|
| Bankgeschäfte ohne Erlaubnis | § 32 + § 54 Abs. 1 | Freiheitsstrafe bis 5 Jahre / Geldstrafe | § 54 KWG |
| Fahrlässige Variante | § 54 Abs. 3 | bis 3 Jahre | § 54 Abs. 3 KWG |
| Organisatorische Verstöße | div. | bis 5.000.000 € oder 10 % Jahresumsatz | § 56 Abs. 6 KWG |
| Auslagerungs-Verstoß | § 25c | OwiG nach § 56 + BaFin-Anweisung | § 25c KWG |
| BaFin-Lizenzentzug | § 35 | Marktverbot | § 35 KWG |

## Top-Az. + BaFin-Praxis

- **BGH 4 StR 144/15** (28.05.2015) — § 54 KWG, Bankgeschäft-Begriff strikt
- **BaFin Wirecard-Verfahren** (2020-2025) — Erlaubnis-Auflagen + spätere Strafverfahren
- **BaFin Bekanntmachung Krypto-Verwahrgeschäft (2020)** — Auslegung § 1 Abs. 1a Nr. 6
- **BaFin Merkblätter MaRisk + BAIT** (regelmäßig aktualisiert) — verbindliche Verwaltungs-Vorgaben

## Cross-Reference (zu anderen Skill-Files)

- `references/gesetze/Finance/ZAG.md` für Zahlungsdienstleistung-Abgrenzung
- `references/gesetze/GwG/` für KYC-Pflichten (KWG-Verpflichtete sind GwG-Verpflichtete)
- `references/gesetze/EU-Verordnungen/MiCA-2023-1114/` für Krypto-Asset-Service-Provider (CASP) ab 30.12.2024
- `references/gesetze/EU-Verordnungen/DORA-2022-2554/` für IT-/Operational-Resilience ab 17.01.2025
- `references/gesetze/WpHG/` für Wertpapierdienstleistungen (MiFID-II-Umsetzung)
- `references/audit-patterns.md` Phase 4 für Onboarding/KYC-Surface

## Krypto-Lizenz-Pfade in DE (Stand 2026)

| Modell | Erforderlich |
|---|---|
| Custodial Wallet / Exchange | KWG § 32 (Krypto-Verwahrgeschäft seit 01.01.2020) + GwG-Verpflichteten-Status |
| MiCA CASP-Lizenz | EU 2023/1114 — ab 30.12.2024 für CASPs (Custody, Exchange, Trading-Platform) |
| DLT-Pilot-Regime | EU 2022/858 — temporär für tokenisierte Wertpapiere |
| Pure Software-as-a-Service (kein Custody) | KEINE KWG-Erlaubnis nötig (BaFin-Auslegung Einzelfall) |

**Übergangsregelung MiCA**: Bestehende DE-Krypto-Custody-Lizenzen nach KWG müssen bis 31.12.2025 zur MiCA-CASP-Lizenz upgraden.
