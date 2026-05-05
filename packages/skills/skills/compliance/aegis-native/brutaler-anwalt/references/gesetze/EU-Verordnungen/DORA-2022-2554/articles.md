---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2554
last-checked: 2026-05-02
purpose: DORA (Digital Operational Resilience Act) — IKT-Risikomanagement fuer Finanzbranche.
verification-status: verified
skill-output-disclaimer: "Top-Layer-verifiziert (eur-lex.europa.eu) — Art. 19-Frist-Kaskade + Anwendbarkeit primaer-verifiziert"
last-verified: 2026-05-05
---

# DORA — VO 2022/2554

> **Anwendbar seit 17.01.2025.** Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2554
> Verordnung ueber digitale operationelle Resilienz im Finanzsektor.

## Anwendungsbereich (Art. 2)

Gilt fuer:
- Kreditinstitute (KWG-Erlaubnis)
- Zahlungsdienstleister (PSD2)
- E-Geld-Institute
- Wertpapierfirmen (WpHG)
- Krypto-Asset-Service-Provider (CASP, MiCA)
- Zentralverwahrer
- Versicherer + Rueckversicherer
- Pensionsfonds
- Ratingagenturen, Datenbereitstellungsdienste
- Crowdfunding-Dienstleister
- IKT-Drittanbieter (subsidiaer)

**KMU-Privileg**: kleine oder unverflochtene Wertpapierfirmen sind teilweise befreit (Art. 16).

## Art. 5-15 — IKT-Risikomanagement

### Art. 5 — Governance

- Geschaeftsleitung bestaetigt + ueberwacht IKT-Risikomanagement-Rahmen
- Persoenliche Verantwortlichkeit der Geschaeftsleitung

### Art. 6 — IKT-Risikomanagement-Rahmen

Pflicht-Inhalte:
- Strategie, Ziele, Policies
- Risk-Tolerance-Statement
- Incident-Response-Plan
- Backup + Recovery-Plan
- Klassifikation der IKT-Funktionen

### Art. 7 — IKT-Systeme + Kontrollen

- Inventarisierung kritischer IKT-Systeme
- Verschluesselung at-rest + in-transit
- Zugriffskontrolle (RBAC, MFA, Privilege-Management)
- Capacity-Management

### Art. 8-9 — Identifikation + Schutz

- Asset-Inventar
- Threat-Intelligence-Feed
- Verwundbarkeits-Management

### Art. 10 — Detection

- Real-time Monitoring
- Anomaly-Detection
- Logging Pflicht (mind. 12 Monate Aufbewahrung)

### Art. 11 — Response + Recovery

- Recovery-Time-Objective (RTO)
- Recovery-Point-Objective (RPO)
- Business-Continuity-Plan
- Disaster-Recovery-Plan

### Art. 12 — Backup-Policies

- Mind. 1 Kopie offline / immutable
- Test der Wiederherstellbarkeit jaehrlich

### Art. 13 — Lerne-aus-Vorfaellen

- Post-Incident-Review
- Lessons-Learned-Doku

### Art. 14 — Kommunikation

- Krisenkommunikations-Plan
- Behoerden-Kommunikations-Pflicht

## Art. 17-23 — IKT-Vorfall-Meldung

### Art. 17 Abs. 1 — Klassifikation

Vorfall-Klassifizierung nach:
- Anzahl betroffener User
- Dauer der Stoerung
- Geographische Reichweite
- Daten-Verlust
- Wirtschaftliche Auswirkung

### Art. 19 — Meldepflichten

| Stufe | Frist | Empfaenger |
|---|---|---|
| **Erstmeldung** | spaetestens **4h** ab Klassifizierung als „major" UND max. **24h** ab Kenntnisnahme des Vorfalls | Zustaendige Behoerde (BaFin in DE) |
| **Zwischenbericht** | binnen **72h** ab Erstmeldung | BaFin |
| **Abschlussbericht** | binnen **1 Monat** ab Loesung des Vorfalls | BaFin |

> Konkretisiert in den Joint-RTS/ITS der ESAs (JC 2024/33, finalisiert 17.07.2024).
> Fristen wurden mit NIS2 harmonisiert.

## Art. 24-27 — Threat-Led Penetration Testing (TLPT)

Fuer wichtige Finanzdienstleister: alle 3 Jahre TLPT (TIBER-EU-konform).

## Art. 28-44 — IKT-Drittanbieter-Risiko

### Art. 28 — Drittanbieter-Strategie

Geschaeftsleitung verantwortlich fuer Auswahl, Steuerung, Ueberwachung von IKT-Drittanbietern.

### Art. 30 — Vertragspflichtinhalte

Bei jedem IKT-Drittanbieter-Vertrag:
- Beschreibung Funktionen
- Service-Level-Agreement
- Datenstandort
- Sub-Outsourcing-Bedingungen
- Audit-Rechte
- Exit-Strategie
- Sicherheitsanforderungen

### Art. 31 — Kritische IKT-Drittanbieter

EU-Kommission designiert „kritische" IKT-Drittanbieter (z.B. Hyperscaler AWS / Azure / GCP).
Diese unterliegen direkter EU-Aufsicht.

## Art. 45-49 — Information Sharing

Cybersecurity-Informationen koennen unter Finanzdienstleistern ausgetauscht werden (in Tatbestaenden geregelt).

## Sanktionen

DE-Umsetzung in BaFin-Zustaendigkeit + KWG / WpHG / VAG nach Branche:
- bis 1% Jahresumsatz fuer schwere Verstoesse (Art. 50)
- bis 10% bei Wiederholung
- Plus: Veroeffentlichung des Verstosses

## Audit-Relevanz fuer Skill

DORA betrifft Finanzdienstleister-Sites direkt. KMU-Vibecoder als Operator selten Finanz-Lizenz, aber als Sub-Auftragsverarbeiter (z.B. SaaS fuer Banken) → DORA-Pflichten kaskadieren via Vertrag (Art. 30).

Skill-Output bei Finanz-Branche-Detection:
```
**Finding**: Site bietet Service an Finanzdienstleister → DORA-Sub-Auftragsverarbeiter
**Pflicht**: Vertrag muss Art. 30 DORA-Klauseln erfuellen
**Audit**: AVV / DPA gegen Art. 30-Pflichtinhalt mappen
```

## Source

- [eur-lex.europa.eu — VO 2022/2554](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2554)
- [BaFin — DORA-Aufsicht](https://www.bafin.de/DE/Aufsicht/RisikenManagement/Cyber/cyber_node.html)
- [Lamfalussy ESA — DORA RTS](https://www.eba.europa.eu/regulation-and-policy/operational-resilience)
