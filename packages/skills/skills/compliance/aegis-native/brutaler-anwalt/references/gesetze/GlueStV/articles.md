---
license: oeffentlich-rechtlich (Staatsvertrag der Laender)
source: https://www.gluecksspiel-behoerde.de/glcksspielstaatsvertrag-2021
last-checked: 2026-05-02
purpose: GlueStV 2021 — Gluecksspielrecht Online.
verification-status: secondary-source-derived
skill-output-disclaimer: "⚠ Sekundaerquellen-Inhalt — vor Mandanten-Citation gegen GlueStV-Volltext / Aufsichtsbehoerde verifizieren"
last-verified: 2026-05-05
---

# GlueStV 2021 — Audit-relevante Paragraphen

> Gluecksspielstaatsvertrag 2021. Volltext: https://www.gluecksspiel-behoerde.de/glcksspielstaatsvertrag-2021
> GGL (Gluecksspielbehoerde der Laender) als Aufsicht: https://www.gluecksspiel-behoerde.de/

## Geltungsbereich

GlueStV gilt fuer:
- Online-Casinos
- Online-Sportwetten
- Online-Poker
- Lotterien
- Telefon-/SMS-Glücksspiele

NICHT erfasst: kostenlose Gewinnspiele ohne Einsatz.

## Erlaubnispflicht (§ 4 GlueStV)

Online-Gluecksspiel braucht **Erlaubnis** der GGL:
- Sitz in DE oder EU
- Erlaubnis-Verfahren bei GGL Halle
- Whitelist auf https://www.gluecksspiel-behoerde.de/de/whitelist

## Werbe-Beschraenkungen (§ 5 GlueStV)

- Verbot in Sport-Pause-Werbung (1h vor + nach Live-Sportereignis)
- Verbot Influencer-Werbung mit prominenten Personen
- Verbot Bonus-Werbung mit „kostenlos"-Versprechen
- Spielerschutz-Hinweise prominent
- Verbot Kinder-Adressierung

## Spielerschutz (§§ 6-9 GlueStV)

- Selbstausschluss-System OASIS (zentral)
- Einzahlungs-Limit 1.000 EUR / Monat (Default — anhebbar nach Bonity-Pruefung)
- Anbieter-uebergreifendes Limit
- Pflicht-Aufklaerungstexte

## Sanktionen

- Erlaubnis-Entzug
- Bussgeld bis 500.000 EUR
- Zugangs-Sperren durch ISPs
- Strafanzeige § 284 StGB (unerlaubtes Gluecksspiel)

## Audit-Trigger

Wenn Site Gluecksspiel-Funktion bietet:
- Ist Anbieter auf GGL-Whitelist?
- Spielerschutz-Hinweise prominent?
- OASIS-Anbindung implementiert?
- Werbung GlueStV-konform?

## Audit-Pattern

```
**Finding**: Gluecksspiel-Site ohne GGL-Erlaubnis-Nummer im Impressum
**Wahrsch.**: 90% (GGL aktive Pruefung + ISP-Zugangssperre + Strafanzeige § 284 StGB)
**§**: § 4 GlueStV + § 284 StGB
**€-Range**: bis 500.000 EUR + Strafanzeige
**Fix**:
- Erlaubnis bei GGL beantragen
- Erlaubnis-Nr. im Impressum
- OASIS-Anbindung
```

## Cross-Reference

- Branche Gluecksspiel: `references/branchenrecht.md`
- Strafrecht § 284: `references/strafrecht-steuer.md`

## Source

- [GGL — Gluecksspielbehoerde der Laender](https://www.gluecksspiel-behoerde.de/)
- [GlueStV 2021 Volltext](https://www.gluecksspiel-behoerde.de/glcksspielstaatsvertrag-2021)
- [OASIS-Sperrsystem](https://www.gluecksspiel-behoerde.de/de/oasis-sperrsystem)
