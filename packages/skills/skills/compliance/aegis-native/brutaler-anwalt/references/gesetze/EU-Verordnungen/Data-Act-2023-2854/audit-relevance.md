---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R2854
last-checked: 2026-05-02
purpose: Data Act — Audit-Trigger fuer SaaS / IoT / B2B-Datenfluss.
---

# Data Act — Audit-Relevance

## Auto-Loading-Trigger

```
1. SaaS-Detection:
   - Subscription-Modell + Customer-Daten-Speicherung
   - „Pricing"-Page mit Plan-Tabelle
   - Tech-Stack: Stripe-Subscription, Paddle, etc.

2. IoT-Detection:
   - Smart-Device-Hersteller-Site
   - „Connected Product" / „IoT" / „Smart Home"
   - Hardware-Komponente in Product-Range

3. B2B-Daten-Hub-Detection:
   - Site bewirbt: "Data-Sharing", "API-First", "Integration-Hub"
   - Tech-Stack: Apollo, REST-API-Gateway-Tools
```

## Pflicht-Surfaces

### Surface 1 — SaaS-AGB (Cloud-Wechsel-Pflicht)

| Check | Verify |
|---|---|
| Wechsel-Klausel vorhanden | grep AGB nach „Wechsel" / „Migration" |
| Datenexport-Endpoint dokumentiert | grep AGB nach „Export" / „Download" |
| Wechsel-Dauer < 30 Tage | AGB-Lese |
| Switching-Kosten (vor 2027) transparent | AGB-Lese |
| Maschinenlesbares Format (JSON/CSV) | API-Doku |

### Surface 2 — IoT-Daten-Portal

| Check | Verify |
|---|---|
| User-Daten-Export-Endpoint | API-Probe |
| Daten-Sharing mit Drittem (mit User-Zustimmung) | UI-Audit |
| Maschinenlesbares Format | Format-Check |

### Surface 3 — B2B-Vertraege

| Check | Verify |
|---|---|
| FRAND-Klauseln | Vertrags-Lese |
| Keine missbraeuchlichen Klauseln | AGB-Lese |
| Streit-Beilegungs-Klausel | AGB-Lese |

## Audit-Pattern

```
**Finding**: SaaS-Provider ohne Datenexport-Endpoint
**Wahrsch.**: 60% (BfDI/BNetzA-Pruefungen + Verbraucherklagen)
**Kritikalitaet**: 🟡 HOCH (ab 2025-09 vollstaendig anwendbar)
**§**: Art. 23-25 Data Act + AGB-Recht §§ 305-310 BGB
**€-Range KMU**: 25.000-500.000 EUR
**Fix**:
- Datenexport-Endpoint implementieren (User-Account-Page)
- AGB-Klausel ergaenzen
- Wechsel-Pfad dokumentieren in Customer-Portal
```

## Cross-Reference

- AGB-Recht: `references/vertragsrecht.md`
- ePrivacy-Audit: `references/audit-patterns.md`

## Source

- [eur-lex.europa.eu — VO 2023/2854](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R2854)
