---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689
last-checked: 2026-05-02
purpose: AI Act Anhang III — vollstaendige 8-Bereiche-Hochrisiko-Liste mit Audit-Trigger pro Use-Case.
---

# AI Act — Anhang III Hochrisiko-Use-Cases (vollstaendig)

> Anhang III der VO 2024/1689 listet die Use-Cases die als „Hochrisiko" gelten und damit
> Pflichten Art. 8-15 (Risikomanagement / Daten / Doku / Logging / Transparenz / Aufsicht /
> Genauigkeit) sowie Art. 27 (FRIA) ausloesen.
>
> Quelle: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689#anx_3

## Bereich 1 — Biometrik

### 1.a Remote Biometrische Identifizierung
- KI-Systeme zur biometrischen Fern-Identifikation natuerlicher Personen.
- **Audit-Trigger**: Site-API mit Face-Recognition / Voice-ID / Gait-Analysis gegen Datenbank.
- **Pflichten**: vollstaendige Annex-III-Pflichten + Art. 27 FRIA.

### 1.b Biometrische Kategorisierung
- KI zur Kategorisierung anhand sensitiver Merkmale (politische Meinung, religioese Ueberzeugungen, sexuelle Orientierung etc.).
- **Audit-Trigger**: User-Profiling-System mit demographic-inference-Outputs.

### 1.c Emotionserkennung
- KI zur Erkennung von Emotionen aus biometrischen Daten.
- **Audit-Trigger**: Sentiment-AI im Customer-Service-Chat / HR-Interview-Tools.
- **Hinweis**: am Arbeitsplatz + in Bildung Art. 5 Abs. 1 lit. f komplett verboten.

## Bereich 2 — Kritische Infrastruktur

### 2.a Sicherheitskomponenten in kritischen Infrastrukturen
- KI als Sicherheitskomponente in Verkehr, Wasser, Gas, Heizung, Strom, digitalen Infrastrukturen.
- **Audit-Trigger**: KRITIS-Sektor (NIS2/CER-RL-Bezug) mit AI-gestuetzter Anomalie-Erkennung / Verkehrssteuerung.

## Bereich 3 — Bildung und Berufsausbildung

### 3.a Zulassung / Bewertung in Bildungseinrichtungen
- KI zur Bewerber-Aufnahme oder Pruefungs-Auswertung.
- **Audit-Trigger**: EdTech-Plattform mit Auto-Grading, Adaptive-Learning-Score-Output.

### 3.b Zuteilung zu Bildungsstufen
- KI zur Zuweisung von Personen zu Bildungs- oder Berufsausbildungsstufen.

### 3.c Pruefungs-Gleichbehandlung
- KI zur Bewertung des Lernergebnisses bei Pruefungen.

### 3.d Pruefungs-Ueberwachung (Proctoring)
- KI zur Erkennung von Pruefungs-Betrug.
- **Audit-Trigger**: Online-Proctoring-Tool im EdTech / Zertifizierungs-Pruefungs-Kontext.

## Bereich 4 — Beschaeftigung und Personalverwaltung

### 4.a Bewerber-Screening / Recruiting-AI
- KI zur Auswahl, Filterung, Bewertung von Bewerbern.
- **Audit-Trigger**: ATS-Systeme mit AI-gestuetzter CV-Bewertung, Auto-Rejection-Pipelines.
- **Pflichten zusaetzlich**: § 26 BDSG (Beschaeftigtendaten) + BetrVG § 87 Abs. 1 Nr. 6 (Mitbestimmung).

### 4.b Befoerderung / Kuendigung / Aufgaben-Zuteilung
- KI zur Entscheidung ueber Befoerderung, Kuendigung, Aufgaben.
- **Audit-Trigger**: Performance-Tracking mit Auto-PIP-Trigger, Skill-Matching-AI.

### 4.c Verhaltens- / Persoenlichkeits-Bewertung
- KI zur Bewertung von Mitarbeiter-Verhalten oder Persoenlichkeit.

## Bereich 5 — Zugang zu wesentlichen privaten und oeffentlichen Diensten

### 5.a Anspruch auf Sozialleistungen
- KI zur Pruefung der Anspruchsberechtigung fuer staatliche Leistungen.

### 5.b Kreditwuerdigkeits-/Bonitaets-Bewertung
- KI zur Bonitaets-Einschaetzung.
- **Audit-Trigger**: Fintech-Apps mit Scoring-Algorithmus, Buy-Now-Pay-Later mit AI-Underwriting.
- **Pflichten zusaetzlich**: Art. 22 DSGVO (automatisierte Entscheidung) + Schufa-Linie EuGH C-634/21.

### 5.c Notruf-Triage
- KI zur Priorisierung in Notfalldiensten.

### 5.d Krankenversicherungs- und Lebensversicherungs-Risikobewertung
- KI zur Versicherungs-Risiko-Einschaetzung bei Lebens- und Gesundheitsversicherungen.
- **Audit-Trigger**: InsurTech mit Health-Score / Premium-Berechnung-AI.

## Bereich 6 — Strafverfolgung

### 6.a Polygraf / Lie-Detection (in dem Umfang, in dem es zulaessig ist)
### 6.b Beweis-Auswertung / Aussagen-Plausibilisierung
### 6.c Profiling fuer Strafverfolgungs-Zwecke
### 6.d Crime-Analytics
- **Audit-Trigger**: meist staatlich, kommerziell selten — wenn Site fuer LE-Dienstleister entwickelt → kompletter Annex-III-Stack + Art. 27 FRIA.

## Bereich 7 — Migration, Asyl, Grenzkontrollen

### 7.a Polygraf bei Grenze
### 7.b Risikobewertung Sicherheits-/Migrations-/Gesundheits-Risiken bei Einreise
### 7.c Asyl-Antrag-Vorbearbeitung
### 7.d Identitaets-Pruefung an Grenzen
- **Audit-Trigger**: nur staatlich oder zertifizierte Grenz-Service-Provider relevant.

## Bereich 8 — Justiz und demokratische Prozesse

### 8.a Recherche-/Auslegungs-AI fuer Justiz
- KI als Recherche- oder Auslegungs-Hilfe fuer Justizbehoerden.
- **Audit-Trigger**: Legal-Tech-Tools fuer Gerichte / Staatsanwaltschaft / Anwaelte mit AI-Drafting.
- **Hinweis**: kommerzielle Legal-Tech ist haeufig im Grenzbereich — pruefe Smartlaw-Linie BGH I ZR 113/20.

### 8.b Wahlen / Wahl-Empfehlungen / Wahlbeeinflussung
- KI zur Beeinflussung des Wahlverhaltens (auch Empfehlung).

---

## Audit-Mapping (Skill-Trigger pro App-Typ)

| App-Typ | Annex-III-Bereich | Pflichten |
|---|---|---|
| Recruiting-Plattform mit AI-CV-Screening | 4.a | Annex III + Art. 27 FRIA + § 26 BDSG + BetrVG § 87 |
| Telemedizin / Diagnose-AI | 5.b/5.d (Versicherung), evtl. 1.c (Emotion) | Annex III + ggf. MDR-Hochrisiko |
| Fintech mit Bonity-Scoring | 5.b | Annex III + Art. 22 DSGVO + EuGH C-634/21 SCHUFA |
| EdTech mit Auto-Grading / Proctoring | 3.a / 3.d | Annex III + DSGVO Art. 22 |
| KRITIS-Sektor mit AI-Anomalie | 2.a | Annex III + NIS2 + CER-RL |
| Customer-Service-Chat mit Sentiment | 1.c (Emotion) | Annex III (Bildung/Arbeit-Verbot pruefen) |

## Sanktion bei Hochrisiko-Verstoss

Art. 99 Abs. 4: bis 15 Mio. EUR oder 3% globaler Jahresumsatz — siehe `sanktionen-art-99.md`.

## Source

- [eur-lex.europa.eu — VO 2024/1689 Anhang III](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689#anx_3)
- [European Commission — AI Act Annex III FAQ](https://digital-strategy.ec.europa.eu/de/policies/regulatory-framework-ai)
