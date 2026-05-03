---
license: gemeinfrei nach § 5 UrhG (DE)
source: https://www.gesetze-im-internet.de/juschg/
last-checked: 2026-05-02
purpose: JuSchG + JMStV — Kinder-/Jugendschutz Online.
---

# JuSchG + JMStV — Audit-relevante Paragraphen

> JuSchG (Jugendschutzgesetz): https://www.gesetze-im-internet.de/juschg/
> JMStV (Jugendmedienschutz-Staatsvertrag): https://medienanstalt-nrw.de/themen/jugendschutz/jugendmedienschutz-staatsvertrag-jmstv.html

## Anwendungsbereich

JMStV gilt fuer:
- Online-Inhalte mit Verbreitung in DE
- Plattformen die User-Content veroeffentlichen
- Online-Spiele
- Streaming-Dienste

## Pflichten

### Alters-Kennzeichnung (§§ 5-12 JMStV)

Inhalte muessen entsprechend Alters-Stufe gekennzeichnet:
- Alle (ab 0)
- Ab 6, 12, 16, 18

### Schutz Minderjaehriger (§§ 4-5 JMStV)

- Verbot entwicklungsbeeintraechtigender Inhalte
- Pflicht zur technischen Zugangsbarriere (z.B. AGE-Gate, AVS)

### Werbung-Beschraenkung (§ 6 JMStV)

- Verbot Werbung an Kinder die zur Bestellung verleiten
- Trennungsgrundsatz (klare Werbe-Kennzeichnung)

### Anbieter-Pflichten (§ 7 JMStV)

- Beauftragter fuer Jugendmedienschutz (ab bestimmter Anbieter-Groesse)
- Doku-Pflicht
- Zusammenarbeit mit Aufsicht (KJM, BzKJ)

## Kinder-Cookies + DSA Art. 28

Cross-Layer:
- DSGVO Art. 8 — Einwilligung Kinder unter 16 Jahre nur durch Eltern
- DSA Art. 28 — Verbot personalisierter Werbung an Minderjaehrige basierend auf Profiling
- JMStV — entwicklungsbeeintraechtigende Inhalte mit Zugangsbarriere

## Audit-Trigger

Wenn Site Minderjaehrige adressiert:
- AGE-Gate vorhanden?
- DSGVO-Einwilligung Eltern bei < 16 Jahre?
- Trennungsgrundsatz Werbung/Content?
- DSA Art. 28-Konformitaet (kein Targeting basierend auf Profiling)?

## Sanktionen (§ 24 JMStV)

- bis 500.000 EUR pro Verstoss
- KJM kann Verbreitungs-Verbot

## Audit-Pattern

```
**Finding**: Plattform mit jugendlichem Zielpublikum + Profiling-Werbung
**Wahrsch.**: 50% (KJM/BzKJ-Pruefungen + DSA-Verbund)
**§**: DSA Art. 28 + § 6 JMStV + DSGVO Art. 8
**€-Range**: 50.000-500.000 EUR
**Fix**:
- AGE-Gate bei Onboarding
- Profiling-basierte Werbung deaktivieren fuer < 18-Jaehrige
- Eltern-Einwilligungs-Flow bei < 16-Jaehrigen
```

## Source

- [gesetze-im-internet.de — JuSchG](https://www.gesetze-im-internet.de/juschg/)
- [JMStV (Medienanstalt NRW)](https://medienanstalt-nrw.de/themen/jugendschutz/jugendmedienschutz-staatsvertrag-jmstv.html)
- [BzKJ Bundeszentrale fuer Kinder- und Jugendmedienschutz](https://www.bzkj.de/)
- [KJM Kommission fuer Jugendmedienschutz](https://www.kjm-online.de/)
