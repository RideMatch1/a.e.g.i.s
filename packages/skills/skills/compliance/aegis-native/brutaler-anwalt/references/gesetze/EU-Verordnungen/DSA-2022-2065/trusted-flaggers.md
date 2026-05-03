---
license: CC BY 4.0 (EUR-Lex)
source: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065
last-checked: 2026-05-02
purpose: DSA Art. 22 — Trusted Flaggers + priorisierte Notice-Bearbeitung.
---

# DSA — Art. 22 Trusted Flaggers

> Trusted Flaggers sind zertifizierte Organisationen die priorisierte Notice-Bearbeitung erhalten.
> Volltext: https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065#art_22

## Konzept

Pflicht fuer **Online-Plattformen** (nicht nur Hosting): Notices von Trusted Flaggers werden:
- **Prioritaer** behandelt
- **Unverzueglich** geprueft
- **Beschleunigt entschieden**

## Trusted-Flagger-Status (Art. 22 Abs. 2)

Verleihung durch DSC (Digital Services Coordinator) im Mitgliedstaat:

| Voraussetzung | Detail |
|---|---|
| Besondere Expertise | im jeweiligen Bereich (z.B. Kinder-Schutz / Hate-Speech / Markenrecht / Urheberrecht) |
| Repraesentation kollektiver Interessen | nicht einzeln-kommerziell |
| Unabhaengig von Plattformen | keine wirtschaftliche Verflechtung |
| Sorgfaeltige + objektive + genaue Notice-Submission | Track-Record nachweisbar |

## DE-Umsetzung

In DE: **Bundeszentrale fuer Kinder- und Jugendmedienschutz (BzKJ)** ist DSC fuer Jugendschutz-Bereich.

Quelle: https://www.bzkj.de/

Aktuelle DE Trusted Flagger 2026 (Stand 2026-05):
- jugendschutz.net (Kinder/Jugendmedien)
- klicksafe.de
- HateAid (Hate-Speech)
- Reporters ohne Grenzen (RoG, Pressefreiheit)
- Internet Watch Foundation (CSAM, mit DE-Reach)

Liste pflegt das BzKJ + EU-Kommission auf https://digital-strategy.ec.europa.eu/

## Audit-Checkliste

Wenn HUNTER eine UGC-Plattform untersucht:

```bash
# 1. Plattform hat priorisierten Notice-Pfad fuer Trusted Flaggers?
grep -rE "trusted.flagger|priorit\w+ notice" src/api/

# 2. Plattform stellt Liste der Trusted Flaggers in AGB bereit?
curl -s https://example.com/agb | grep -ic "trusted flagger\|vertrauenswuerdiger hinweisgeber"

# 3. Reporting-Kanal explizit fuer Trusted Flaggers (e.g. dedizierter API-Endpoint)?
curl -X POST -H "X-Trusted-Flagger: BzKJ-2025-001" \
  https://example.com/api/dsa/notice/priority -i
```

## Auswirkung auf Plattform-Operations

Wenn Plattform > 50 MA + > 10 Mio. Umsatz (Online-Plattform-Status):
- Pflicht zur Trusted-Flagger-Akzeptanz
- Pflicht zur Reporting-Quartal (Art. 24 DSA)
- KMU-Privileg laeuft NICHT auf Trusted Flagger Pflicht (Art. 19 KMU-Privileg gilt nur fuer einige Pflichten)

## Sanktionen

Pflichtverletzung kann nach DDG §§ 18-22 + Art. 52 DSA mit bis 6% Jahresumsatz (VLOPs) bzw. bis 50.000 EUR (KMU-Plattformen) geahndet werden.

## Source

- [eur-lex.europa.eu — VO 2022/2065 Art. 22](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2065#art_22)
- [BzKJ — DSC fuer Jugendschutz](https://www.bzkj.de/)
- [Aktuelle DSC-Liste der EU](https://digital-strategy.ec.europa.eu/de/policies/dsa-dscs)
