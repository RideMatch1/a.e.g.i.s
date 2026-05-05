---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R2847
last-checked: 2026-05-02
purpose: Cyber Resilience Act — Sicherheitspflichten fuer Produkte mit digitalen Elementen.
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen eur-lex.europa.eu Volltext verifizieren"
last-verified: 2026-05-05
---

# CRA — VO 2024/2847

> Schrittweise ab 11.12.2024 (Reporting), volle Anwendung **11.12.2027**.
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R2847

## Anwendungsbereich

Pflicht fuer **Produkte mit digitalen Elementen** = Hardware + Software die in EU vertrieben werden:
- IoT-Geraete (Smart-Home, Wearables, Industrial IoT)
- Software-Produkte (ausser SaaS — separate Cloud-Regeln)
- Komponenten (z.B. Microcontroller, Firmware, Libraries)

NICHT erfasst:
- SaaS / Cloud-Dienste (separat NIS2 / DORA)
- Free + Open-Source Software (FOSS) AUSSER kommerziell vertrieben
- Bereits-regulierte Produkte (Medizinprodukte, KFZ, Luftfahrt etc.)

## Klassifikation (Art. 6 + Anhang III + IV)

| Klasse | Beispiel | Compliance-Pfad |
|---|---|---|
| Default | LED-Lampen, viele IoT-Sensoren | Self-Assessment + CE-Mark |
| Important Class I | Browser, Passwort-Manager, VPN-Clients | Self-Assessment / Konformitaetspruefung |
| Important Class II | Smart-Cards, Hypervisors, Container-Runtime | Konformitaetspruefung Pflicht |
| Critical | Identity-Management Systems | volle Pruefung + Zertifizierung |

## Pflichten

### Cybersecurity-by-Design (Art. 13 + Anhang I)

- Default-Sicherheitskonfiguration
- Vulnerability-Management
- Authentifizierung + Zugriffskontrolle
- Verschluesselung
- Datenminimierung
- Update-Mechanismus

### Vulnerability-Reporting (Art. 14)

- Aktive Vulnerability-Pflicht
- 24-Stunden-Erstmeldung an ENISA + Behoerde
- Updates + Patches Pflicht

### Update-Verpflichtung (Art. 13 + Anhang I)

- Update-Bereitstellung waehrend Erwartungs-Lebensdauer
- Mind. 5 Jahre

## Sanktionen (Art. 64)

- Wesentliche Verstoesse: bis 15 Mio. EUR oder 2,5% globaler Jahresumsatz
- Sonstige Verstoesse: bis 10 Mio. EUR oder 2%
- Falsche Informationen: bis 5 Mio. EUR oder 1%

## Audit-Relevanz

Wenn Site-Operator IoT-Hardware oder Software-Produkt vertreibt: kompletter CRA-Stack.
Wenn nur SaaS: NICHT direkt CRA, aber NIS2 / DORA / DSGVO-Layer.

## Audit-Pattern

```
**Finding**: IoT-Hersteller ohne Vulnerability-Reporting-Prozess
**Wahrsch.**: 60% (ENISA + BSI Pruefungen ab 2025)
**§**: Art. 14 CRA
**€-Range KMU**: 50.000-2.000.000 EUR
**Fix**:
- security.txt nach RFC 9116
- Coordinated Vulnerability Disclosure Policy
- Update-Mechanismus-Doku
- 24h-ENISA-Reporting-Procedure
```

## Source

- [eur-lex.europa.eu — VO 2024/2847](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R2847)
- [ENISA CRA-Page](https://www.enisa.europa.eu/topics/cyber-resilience-act)
