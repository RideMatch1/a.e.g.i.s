---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022L2555
last-checked: 2026-05-02
purpose: NIS2-Richtlinie — Cybersecurity-Pflichten kritischer Sektoren.
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen eur-lex.europa.eu Volltext verifizieren"
last-verified: 2026-05-05
---

# NIS2-RL — RL 2022/2555

> **Umsetzungsfrist 17.10.2024.** DE-Umsetzung: NIS2UmsuCG (Stand 2026-05: Bundestags-Verfahren laufend, BSIG bleibt subsidiaer).
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022L2555

## 18 Sektoren (Anhang I + II)

**Hochkritisch** (Anhang I):
- Energie (Strom, Oel, Gas, Fernwaerme)
- Transport (Luft / Bahn / Wasser / Strasse)
- Banken
- Finanzmarktinfrastruktur
- Gesundheit (Krankenhaeuser, Hersteller, Forschung)
- Trinkwasser, Abwasser
- Digitale Infrastruktur (DNS, TLD-Registries, Cloud, Rechenzentren)
- Verwaltung von IKT-Diensten (B2B Managed Service Provider)
- Oeffentliche Verwaltung
- Raumfahrt

**Andere kritische** (Anhang II):
- Post + Kurier
- Abfallwirtschaft
- Chemikalien
- Lebensmittel-Produktion + Vertrieb
- Verarbeitende Industrie (Medizinprodukte, Computer/Elektronik, Maschinen, KFZ, Sonstige)
- Forschung
- Anbieter digitaler Dienste (Online-Marktplatz, Suchmaschinen, Social Networks)

## Schwellwerte

| Status | Schwelle |
|---|---|
| **Wesentliche Einrichtung** | Grossunternehmen (>= 250 MA ODER >= 50 Mio. EUR) in Anhang I |
| **Wichtige Einrichtung** | Mittlere Unternehmen (>= 50 MA ODER >= 10 Mio. EUR) in Anhang I+II |
| **Nicht betroffen** | Kleinunternehmen (< 50 MA + < 10 Mio. EUR) |

## Pflichten

### Risikomanagement (Art. 21)

10 Mindestmassnahmen:
- Risk-Assessment + Sicherheitskonzept
- Incident-Response-Plan
- Business-Continuity (Backup, Notfallplaene)
- Supply-Chain-Sicherheit (Lieferanten-Bewertung)
- Sicherheit bei Erwerb / Entwicklung / Wartung
- Cyberhygiene-Policies + Schulungen
- Kryptographie + Verschluesselung
- Personalsicherheit, Zugangskontrolle, Asset-Management
- Multi-Faktor-Authentifizierung
- Sichere Kommunikation (verschluesselt)

### Meldepflichten (Art. 23)

| Stufe | Frist | Empfaenger |
|---|---|---|
| Erstmeldung | **24 Stunden** | BSI |
| Folgebericht | **72 Stunden** | BSI |
| Abschlussbericht | **1 Monat** | BSI |

### Governance (Art. 20)

- Persoenliche Haftung der Geschaeftsleitung
- Pflicht-Schulungen Geschaeftsleitung

### Sub-Auftragsverarbeiter (Art. 21 Abs. 3)

Lieferanten-Sicherheits-Anforderungen vertraglich.

## Sanktionen (Art. 34)

- Wesentliche Einrichtungen: bis **10 Mio. EUR oder 2% Jahresumsatz**
- Wichtige Einrichtungen: bis **7 Mio. EUR oder 1,4% Jahresumsatz**
- Geschaeftsleitung-Haftung bei Verstoss

## DE-Umsetzung Status

NIS2UmsuCG-Entwurf liegt im Bundestag (Stand 2026-05). Bis Inkrafttreten:
- BSIG (alt) gilt subsidiaer
- Direkte Wirkung der RL 2022/2555 ueber Vertragsverletzungsverfahren-Risiko (EU-KOM hat Verfahren eroeffnet bei verspaeteter Umsetzung mehrerer MS)

## Audit-Relevanz

Wenn Site/Operator unter NIS2-Sektor faellt + Schwellwert erfuellt: kompletter NIS2-Stack.
Wenn als Sub-Auftragsverarbeiter: Vertragsklauseln Art. 21 Abs. 3 erfuellen.

## Source

- [eur-lex.europa.eu — RL 2022/2555](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32022L2555)
- [BSI NIS2-Page](https://www.bsi.bund.de/DE/Themen/Regulierte-Wirtschaft/NIS-2/nis-2_node.html)
- [BMI NIS2UmsuCG](https://www.bmi.bund.de/SharedDocs/gesetzgebungsverfahren/DE/Themen/IT-Cyber/nis2umsucg.html)
