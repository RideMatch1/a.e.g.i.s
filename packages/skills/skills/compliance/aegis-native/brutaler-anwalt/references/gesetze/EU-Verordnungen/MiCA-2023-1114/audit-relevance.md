---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R1114
last-checked: 2026-05-02
purpose: MiCA — Audit-Trigger fuer Crypto/Web3-Sites.
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen eur-lex.europa.eu Volltext verifizieren"
last-verified: 2026-05-05
---

# MiCA — Audit-Relevance

## Auto-Loading-Trigger

```
URL-Pattern: *-crypto.*, *-defi.*, *-nft.*, *-token.*, *-exchange.*, *-wallet.*

Tech-Stack-Detection (package.json grep):
- ethers.js, viem, wagmi (Web3-Frontend)
- @solana/web3.js
- web3.js
- @walletconnect/*
- alchemy-sdk, @infura/sdk

Page-Content:
- "Token-Sale" / "ICO" / "STO" / "Mint"
- "Exchange" / "Trading" / "Swap"
- "Staking" / "Yield" / "Lending"
- Wallet-Connect-Button im Header
```

## Pflicht-Surfaces

### Token-Issuance

| Pflicht | Quelle |
|---|---|
| Token-Klassifikation: ART / EMT / Other | MiCA Art. 3 |
| White-Paper bei BaFin notifiziert | Art. 6 + KryptoWAEG |
| ART/EMT: BaFin-Erlaubnis | Art. 16-21 |
| Werbung-Compliance + Risikohinweis | Art. 30 |

### CASP-Status

| Pflicht | Quelle |
|---|---|
| BaFin CASP-Erlaubnis | Art. 59 + KryptoWAEG |
| KYC nach GwG § 10 | GwG + AMLR-VO 2024 |
| Travel-Rule (>= 1.000 EUR) | FATF + EU-Travel-Rule-VO |
| Risk-Disclosure | Art. 66 |
| Markt-Integritaets-Compliance | Art. 67-72 |
| Eigenkapital-Anforderungen | Art. 60-65 |

### Marketing-Site

| Pflicht | Quelle |
|---|---|
| Werbung an EU-Investoren = MiCA-Erlaubnis | Art. 16 (eng) |
| Risikohinweis sichtbar | Art. 66 |
| Keine Renditeversprechen ohne Hinweis | UWG § 5 + MiCA |

## Audit-Pattern

```
**Finding**: Token-Sale ohne notifiziertes White-Paper
**Wahrsch.**: 80% (BaFin-Pruefungen 2025+)
**Kritikalitaet**: 🔴 KRITISCH
**§**: Art. 6 MiCA + KryptoWAEG § 4
**€-Range KMU**: 100.000-5.000.000 EUR (5 Mio./5%-Stufe)
**Fix**:
- White-Paper nach Anhang I MiCA erstellen
- Bei BaFin notifizieren (kostenlos)
- Issuer-Identitaet + Smart-Contract-Audit beilegen
- Werbung erst nach Notifikation
```

## Cross-Reference

- Branche Crypto/Web3: `references/branchenrecht.md`
- AML / GwG: `references/strafrecht-steuer.md`

## Source

- [eur-lex.europa.eu — VO 2023/1114](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R1114)
- [BaFin MiCA](https://www.bafin.de/DE/Aufsicht/FinTech/MiCAR/micar_node.html)
