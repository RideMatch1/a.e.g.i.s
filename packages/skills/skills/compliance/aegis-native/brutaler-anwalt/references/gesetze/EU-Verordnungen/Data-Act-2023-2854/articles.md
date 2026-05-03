---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R2854
last-checked: 2026-05-02
purpose: Data Act — B2B-Datenzugang + Cloud-Wechsel-Pflichten.
---

# Data Act — VO 2023/2854

> **Anwendbar ab 12.09.2025.** Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R2854

## Kernregelungen

### Kapitel II — Daten-Zugang fuer Nutzer (Art. 3-7)

Hersteller von **vernetzten Produkten** (IoT, Smart-Devices) muessen:
- Daten die durch Nutzung des Produkts entstehen, dem Nutzer kostenlos zugaenglich machen
- Daten in maschinenlesbarem Format teilen
- Daten an dritten Empfaenger (mit Nutzer-Zustimmung) teilen

**Audit-Trigger**: Site bietet IoT-Produkt + Online-Daten-Portal — pruefe Data-Access-Endpoint vorhanden.

### Kapitel III — B2B-Datenzugang (Art. 8-12)

Bei vertraglicher Vereinbarung Daten-Bereitstellung:
- Klauseln muessen FRAND (Fair, Reasonable, Non-Discriminatory) sein
- Verbot „missbraeuchlicher" Klauseln (analog AGB-Recht)
- Streit-Beilegungs-Verfahren EU-weit

### Kapitel IV — Daten-Zugang fuer Behoerden (Art. 14-22)

Behoerden koennen Daten von Privatunternehmen anfordern fuer:
- Notfaelle (Naturkatastrophen, Pandemien)
- Oeffentliche Aufgaben (statistische Erhebungen, Forschung)

### Kapitel V — Cloud-Wechsel (Art. 23-31)

**Pflicht-Inhalte fuer Cloud-Service-Vertraege**:
- Wechsel-Pflicht zu anderem Provider
- Datenexport in maschinenlesbarem Format
- Wechselkosten transparent + zeitlich begrenzt
- Wechsel-Dauer: typ. < 30 Tage

**Switching-Kosten**:
- ab **2027-01-12** Switching-Kosten = 0 (Art. 25 Abs. 5)
- Vorher: Stufenweise Reduktion

**Audit-Trigger**: SaaS-Vertrag pruefen ob Wechsel-Klauseln im AGB.

### Kapitel VI — Cloud-Interoperabilitaet (Art. 32-34)

Cloud-Provider muessen API-Standards einhalten + Cross-Cloud-Datenfluss ermoeglichen.

### Kapitel VII — Cybersecurity-Schutz (Art. 35-36)

EU-NLF (Non-Personal-Data-Free-Flow) Erweiterung — Personal + Non-Personal-Data zusammen mit DSGVO-konformen Schutzmechanismen.

## Sanktionen (Art. 40)

Mitgliedstaaten setzen Sanktionen — DE: BNetzA + BfDI fuer DSGVO-Aspekte:
- bis 4% globaler Jahresumsatz (analog DSGVO Stufe 2)

## Audit-Relevanz

### Surface 1 — IoT-Hersteller / vernetzte Produkte

Pflicht-Endpoint fuer User-Daten-Export.

### Surface 2 — Cloud-Anbieter (SaaS)

Vertragsklauseln nach Art. 23-31:
- Datenexport-Endpoint
- Wechsel-Klausel
- Wechsel-Kosten transparent (ab 2027 = 0)
- Dauer < 30 Tage
- Maschinenlesbares Format

### Surface 3 — B2B-Vertraege mit Datenflusss

Klausel-Audit:
- FRAND-Klauseln
- Keine missbraeuchlichen Klauseln (Art. 13)
- Streit-Beilegung dokumentiert

## Audit-Pattern

```
**Finding**: SaaS-AGB enthaelt KEINE Wechsel-Klausel oder >30-Tage-Wechsel-Dauer
**Wahrsch.**: 50% ab 2025-09 (BfDI/BNetzA-Pruefungen 2026+)
**Kritikalitaet**: 🟡 HOCH
**§**: Art. 25 Data Act
**€-Range**: 50.000-500.000 (KMU, fahrlaessig, ohne KMU-Privileg im Data Act)
**Fix**:
- AGB-Klausel ergaenzen: „Bei Vertragskuendigung stellen wir Ihre Daten in maschinenlesbarem Format (JSON/CSV) bereit. Migration zu anderem Anbieter ist binnen 30 Tagen abzuschliessen. Switching-Kosten ab 12.01.2027 entfallen vollstaendig (Art. 25 Abs. 5 Data Act)."
- Datenexport-Endpoint implementieren
- Wechsel-Doku in Customer-Portal
```

## Source

- [eur-lex.europa.eu — VO 2023/2854](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32023R2854)
- [European Commission — Data Act FAQ](https://digital-strategy.ec.europa.eu/de/policies/data-act)
