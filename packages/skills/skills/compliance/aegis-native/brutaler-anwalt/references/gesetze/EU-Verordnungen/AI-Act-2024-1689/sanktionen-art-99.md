---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689
last-checked: 2026-05-02
purpose: AI Act Art. 99 — Sanktionsskala mit Anwendungs-Beispielen.
---

# AI Act — Art. 99 Sanktionen (3-Stufen-Skala)

> Art. 99 in Kraft seit 02.08.2025 (gestaffelt mit Hochrisiko-Pflichten).
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689#art_99

## Stufe 1 — Verbotene Praktiken (Art. 99 Abs. 3)

**Bis 35 Mio. EUR oder 7% globaler Jahresumsatz** (der hoehere Betrag).

**Auslöser**: Verstoss gegen Art. 5 (Verbotene KI-Praktiken):
- Subliminal-Manipulation
- Vulnerability-Exploitation
- Social Scoring
- Predictive Policing (rein KI-basiert)
- Untargeted Face-Image-Scraping
- Emotion-Recognition am Arbeitsplatz / in Bildung
- Biometrische Kategorisierung nach sensiblen Merkmalen
- Real-time Remote Biometric Identification (Strafverfolgung mit Ausnahmen)

## Stufe 2 — Andere Verstoesse (Art. 99 Abs. 4)

**Bis 15 Mio. EUR oder 3% globaler Jahresumsatz** (der hoehere Betrag).

**Aussloeser**: Verstoss gegen:
- Art. 6-15 (Hochrisiko-KI-Pflichten — Risikomanagement, Daten-Governance, Doku, Logging, Transparenz, Aufsicht, Genauigkeit)
- Art. 16-29 (Pflichten Anbieter / Importeur / Distributor)
- Art. 50 (Transparenz-Pflichten — Chatbot-Hinweis, Synthetic-Content-Watermark, Deep-Fake-Disclosure)
- Art. 51-55 (GPAI-Pflichten — Standard + System-Risk)
- Art. 31-39 (Behoerden-Pflichten + Pruefung)

## Stufe 3 — Falsche Informationen (Art. 99 Abs. 5)

**Bis 7,5 Mio. EUR oder 1% globaler Jahresumsatz** (der hoehere Betrag).

**Aussloeser**: bei der Bereitstellung von Informationen an die zustaendigen Behoerden:
- falsche Informationen
- unvollstaendige Informationen
- irrefuehrende Informationen

## Sanktions-Bemessungs-Faktoren (Art. 99 Abs. 7)

Aufsichtsbehoerden beruecksichtigen bei der Bemessung:

| Faktor | Effekt |
|---|---|
| Art / Schwere / Dauer / Folgen des Verstosses | erhoehend |
| Anzahl betroffener Personen + Schaden-Hoehe | erhoehend |
| Vorsatz vs Fahrlaessigkeit | Vorsatz erhoehend |
| Massnahmen zur Schadensminimierung | mildernd |
| Vorherige Verstoesse desselben Anbieters | erhoehend |
| Kooperation mit Aufsichtsbehoerde | mildernd |
| Kategorien betroffener Daten / Personen | erhoehend bei sensiblen |
| Art und Weise der Kenntniserlangung der Behoerde | mildernd bei Selbstanzeige |
| Einhaltung Verhaltensregeln / Zertifizierungen | mildernd |
| Finanzielle Vorteile aus dem Verstoss | erhoehend |

## KMU-Privileg (Art. 99 Abs. 6)

Fuer KMU + Startups (Begriffsbestimmung KOM-Empfehlung 2003/361/EG):
- Bei der Bemessung der Sanktion **muss** die Behoerde KMU-Status beruecksichtigen
- Niedriger Betrag der prozentualen Schwellen + absoluter Hoechstbetrag (je nach was niedriger ist)

## EU-AI-Act vs. DSGVO Art. 83 — Kombinations-Risiko

**WICHTIG fuer Skill-Output**: AI-Act-Verstoss UND DSGVO-Verstoss koennen kumulativ verfolgt werden.

Beispiel: AI-System mit Hochrisiko-Use-Case + keine FRIA (Art. 27) + keine Daten-Governance (Art. 10):
- AI-Act Art. 99 Abs. 4: bis 15 Mio. / 3%
- DSGVO Art. 83 Abs. 5 (wenn Art. 22 verletzt): bis 20 Mio. / 4%
- **Kombiniert: bis 35 Mio. / 7%** (in der Praxis kumulativ je nach Behoerden-Praxis).

## Audit-Output-Empfehlung (Skill)

Wenn HUNTER einen Hochrisiko-AI-Use-Case ohne Annex-III-Compliance findet:

```
## Schadens-Diagnose

| Verstoss | Stufe | EUR-Range KMU | Az. / Quelle |
|---|---|---|---|
| Hochrisiko-AI ohne Risikomanagement (Art. 9) | Art. 99 Abs. 4 | 50.000–500.000 | EU-VO 2024/1689 Art. 99 Abs. 4 + Abs. 6 KMU-Privileg |
| Kombinations-Risiko mit DSGVO Art. 22 | Art. 83 Abs. 5 | +50.000–250.000 | EuGH C-634/21 SCHUFA |
| Behoerden-Anhoerung-Verzoegerung | Art. 99 Abs. 5 | 25.000–150.000 | Art. 99 Abs. 5 |
```

## Source

- [eur-lex.europa.eu — VO 2024/1689 Art. 99](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689#art_99)
- [European Commission — AI Act Sanktionen FAQ](https://digital-strategy.ec.europa.eu/de/policies/regulatory-framework-ai)
- [KOM-Empfehlung 2003/361/EG (KMU-Definition)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32003H0361)
